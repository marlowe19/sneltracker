-- Migration 051: Create get_day_entries_v4
-- Extends get_day_entries_v3: members with role 'owner' in project_members see all
-- team entries for that shared project, matching what the project creator sees.
-- get_day_entries_v3 remains available for backward compatibility.

CREATE OR REPLACE FUNCTION get_day_entries_v4(
  p_user_name TEXT,
  p_day_date DATE
)
RETURNS TABLE (
  id UUID,
  firestore_id TEXT,
  user_name VARCHAR(255),
  user_display_name VARCHAR(255),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  duration_hours NUMERIC(10,2),
  hourly_rate NUMERIC,
  project TEXT,
  project_id UUID,
  project_name VARCHAR(255),
  billable BOOLEAN,
  is_project_owner BOOLEAN,
  is_project_member BOOLEAN,
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  creation_method VARCHAR(50),
  is_running BOOLEAN,
  has_activities BOOLEAN,
  current_activity_id UUID,
  activities JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
BEGIN
  v_day_start := p_day_date::TIMESTAMPTZ;
  v_day_end := (p_day_date + INTERVAL '1 day')::TIMESTAMPTZ;

  RETURN QUERY
  WITH visible_shared_projects AS (
    -- Shared projects where this user is the creator OR has role 'owner' in project_members
    SELECT p.id AS visible_project_id
    FROM projects p
    WHERE p.is_shared = true
      AND (
        p.owner_name = p_user_name
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_name = p_user_name
            AND pm.role = 'owner'
        )
      )
  )
  SELECT
    t.id,
    t.firestore_id,
    t.user_name,
    u.name::VARCHAR(255) as user_display_name,
    t.start_time,
    t.end_time,
    t.duration_ms,
    ROUND((t.duration_ms::NUMERIC / (1000 * 60 * 60)), 2) as duration_hours,
    t.hourly_rate,
    t.firestore_project_id as project,
    t.project_id,
    p.name as project_name,
    t.billable,
    -- is_project_owner: true if user is the creator of the project
    CASE
      WHEN p.id IS NULL THEN false
      WHEN p.owner_name = p_user_name THEN true
      ELSE false
    END as is_project_owner,
    -- is_project_member: true if user is any member of the project
    CASE
      WHEN p.id IS NULL THEN false
      WHEN p.is_shared = true AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_name = p_user_name
      ) THEN true
      ELSE false
    END as is_project_member,
    t.created_at,
    t.modified_at,
    t.creation_method,
    t.is_running,
    -- Automatically detect if entry has activities (even if flag is false)
    CASE
      WHEN ta_agg.activities IS NOT NULL AND jsonb_array_length(ta_agg.activities) > 0 THEN true
      ELSE COALESCE(t.has_activities, false)
    END as has_activities,
    t.current_activity_id,
    COALESCE(ta_agg.activities, '[]'::jsonb) as activities
  FROM time_entries t
  LEFT JOIN projects p ON t.project_id = p.id
  LEFT JOIN users u ON t.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ta.id,
        'time_entry_id', ta.time_entry_id,
        'activity_type', ta.activity_type,
        'hourly_rate', ta.hourly_rate,
        'start_time', ta.start_time,
        'end_time', ta.end_time,
        'duration_ms', ta.duration_ms,
        'billable', ta.billable,
        'display_order', ta.display_order,
        'user_id', ta.user_id,
        'created_at', ta.created_at,
        'modified_at', ta.modified_at
      ) ORDER BY ta.display_order ASC, ta.start_time ASC
    ) as activities
    FROM timer_activities ta
    WHERE ta.time_entry_id = t.id
  ) ta_agg ON true
  WHERE t.start_time >= v_day_start
    AND t.start_time < v_day_end
    AND (
      -- User's own entries (any project or no project)
      t.user_name = p_user_name
      OR
      -- Any user's entries in shared projects where user is creator or owner-role member
      t.project_id IN (SELECT visible_project_id FROM visible_shared_projects)
    )
  ORDER BY t.start_time ASC;
END;
$$;

COMMENT ON FUNCTION get_day_entries_v4 IS
'Fetches time entries for a specific day for a user (v4).
v4 change: also returns team entries for shared projects where the user has
role=''owner'' in project_members, not only where they are the project creator.
Includes activities as JSONB array directly in the result (same as v3).
Automatically detects entries with activities by checking timer_activities table.
get_day_entries_v3 remains available for backward compatibility.';
