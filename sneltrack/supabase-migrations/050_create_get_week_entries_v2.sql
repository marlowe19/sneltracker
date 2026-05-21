-- Migration 050: Create get_week_entries_v2
-- Extends get_week_entries: members with role 'owner' in project_members see all
-- team entries for that shared project, matching what the project creator sees.
-- get_week_entries (v1) remains available for backward compatibility.

CREATE OR REPLACE FUNCTION get_week_entries_v2(
  p_user_name TEXT,
  p_week_start TIMESTAMPTZ,
  p_week_end TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  firestore_id TEXT,
  user_name VARCHAR(255),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  hourly_rate NUMERIC,
  project TEXT,
  project_name VARCHAR(255),
  billable BOOLEAN,
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  creation_method VARCHAR(50),
  is_running BOOLEAN,
  project_id UUID,
  is_project_owner BOOLEAN,
  is_project_member BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
BEGIN
  v_week_start := p_week_start;
  v_week_end := p_week_end;

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
    t.start_time,
    t.end_time,
    t.duration_ms,
    t.hourly_rate,
    t.firestore_project_id as project,
    p.name as project_name,
    t.billable,
    t.created_at,
    t.modified_at,
    t.creation_method,
    t.is_running,
    t.project_id,
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
    END as is_project_member
  FROM time_entries t
  LEFT JOIN projects p ON t.project_id = p.id
  WHERE
    t.start_time < v_week_end
    AND (
      t.end_time >= v_week_start
      OR t.end_time IS NULL
    )
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

COMMENT ON FUNCTION get_week_entries_v2 IS
'Fetches time entries for a week range for a user (v2).
v2 change: also returns team entries for shared projects where the user has
role=''owner'' in project_members, not only where they are the project creator.
Returns entries that overlap the week (start < week_end AND end >= week_start).
Active entries (end_time IS NULL) are always included.
get_week_entries (v1) remains available for backward compatibility.';
