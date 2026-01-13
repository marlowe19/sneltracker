-- Migration 032: Update get_day_entries_v2 to include activity fields
-- Adds has_activities and current_activity_id to the function return

CREATE OR REPLACE FUNCTION get_day_entries_v2(
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
  current_activity_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
BEGIN
  -- Calculate day boundaries (start of day to end of day)
  v_day_start := p_day_date::TIMESTAMPTZ;
  v_day_end := (p_day_date + INTERVAL '1 day')::TIMESTAMPTZ;

  RETURN QUERY
  WITH user_owned_shared_projects AS (
    -- Get project IDs (UUIDs) of shared projects owned by this user
    SELECT p.id AS owned_project_id
    FROM projects p
    WHERE p.owner_name = p_user_name 
      AND p.is_shared = true
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
    -- Check if user is owner of the project
    CASE 
      WHEN p.id IS NULL THEN false
      WHEN p.owner_name = p_user_name THEN true
      ELSE false
    END as is_project_owner,
    -- Check if user is a member of the project (for shared projects)
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
    t.has_activities,
    t.current_activity_id
  FROM time_entries t
  LEFT JOIN projects p ON t.project_id = p.id
  LEFT JOIN users u ON t.user_id = u.id
  WHERE t.start_time >= v_day_start
    AND t.start_time < v_day_end
    AND (
      -- User's own entries (any project or no project)
      t.user_name = p_user_name
      OR
      -- Any user's entries in shared projects owned by this user
      t.project_id IN (SELECT owned_project_id FROM user_owned_shared_projects)
    )
  ORDER BY t.start_time ASC;
END;
$$;

-- Update comment
COMMENT ON FUNCTION get_day_entries_v2 IS 
'Fetches time entries for a specific day for a user (v2 - with activities support).
Includes has_activities and current_activity_id fields for timer activity feature.';


