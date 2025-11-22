-- Create function to get day entries for a user
-- Replaces getTimeEntries() from Firestore
-- Returns entries for a specific day including:
--   - User's own entries (project is null or not shared)
--   - Shared project entries where user is owner (all entries)
--   - Shared project entries where user is member (only user's entries)

DROP FUNCTION IF EXISTS get_day_entries(TEXT, DATE);

CREATE OR REPLACE FUNCTION get_day_entries(
  p_user_name TEXT,
  p_day_date DATE
)
RETURNS TABLE (
  id UUID,
  firestore_id TEXT,
  user_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  hourly_rate NUMERIC,
  project TEXT,
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  creation_method TEXT,
  is_running BOOLEAN
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
  WITH accessible_projects AS (
    -- Get all projects user has access to with ownership/membership info
    SELECT 
      p.firestore_id as project_firestore_id,
      p.id as project_id,
      p.is_shared,
      (p.owner_name = p_user_name) as is_owner
    FROM projects p
    LEFT JOIN project_members pm 
      ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE 
      -- User's own projects (non-shared)
      (p.owner_name = p_user_name AND p.is_shared = false)
      OR 
      -- Shared projects where user is owner
      (p.owner_name = p_user_name AND p.is_shared = true)
      OR 
      -- Shared projects where user is member
      (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  user_entries AS (
    -- User's own entries (no project or project is not shared)
    SELECT 
      t.id,
      t.firestore_id,
      t.user_name,
      t.start_time,
      t.end_time,
      t.duration_ms,
      t.hourly_rate,
      t.project,
      t.created_at,
      t.modified_at,
      t.creation_method,
      t.is_running
    FROM time_entries t
    WHERE t.user_name = p_user_name
      AND t.start_time >= v_day_start
      AND t.start_time < v_day_end
      AND (
        -- No project assigned
        t.project IS NULL
        OR
        -- Project is not shared (user's own project)
        NOT EXISTS (
          SELECT 1 FROM projects p 
          WHERE p.firestore_id = t.project AND p.is_shared = true
        )
      )
  ),
  shared_project_entries AS (
    -- Shared project entries
    SELECT 
      t.id,
      t.firestore_id,
      t.user_name,
      t.start_time,
      t.end_time,
      t.duration_ms,
      t.hourly_rate,
      t.project,
      t.created_at,
      t.modified_at,
      t.creation_method,
      t.is_running
    FROM time_entries t
    INNER JOIN accessible_projects ap ON t.project = ap.project_firestore_id
    WHERE t.start_time >= v_day_start
      AND t.start_time < v_day_end
      AND (
        -- If user is owner, get all entries in the project
        (ap.is_owner = true)
        OR
        -- If user is member, only get their own entries
        (ap.is_owner = false AND t.user_name = p_user_name)
      )
  )
  -- Combine both result sets, remove duplicates, and sort by start_time
  SELECT 
    id,
    firestore_id,
    user_name,
    start_time,
    end_time,
    duration_ms,
    hourly_rate,
    project,
    created_at,
    modified_at,
    creation_method,
    is_running
  FROM (
    SELECT DISTINCT ON (firestore_id) *
    FROM (
      SELECT * FROM user_entries
      UNION ALL
      SELECT * FROM shared_project_entries
    ) combined_entries
    ORDER BY firestore_id, start_time ASC
  ) unique_entries
  ORDER BY start_time ASC;
END;
$$;

