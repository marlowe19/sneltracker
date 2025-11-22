-- Migration 011: Add billable field to time_entries table
-- Allows users to mark entries as billable (declarabel) or unbillable (niet-declarabel)

-- Add billable column to time_entries table
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN time_entries.billable IS 
'Indicates whether the time entry is billable (declarabel) or unbillable (niet-declarabel). Defaults to true.';

-- Update get_day_entries function to include billable field
DROP FUNCTION IF EXISTS get_day_entries(TEXT, DATE);

CREATE OR REPLACE FUNCTION get_day_entries(
  p_user_name TEXT,
  p_day_date DATE
)
RETURNS TABLE (
  id UUID,
  firestore_id TEXT,
  user_name VARCHAR(255),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_ms BIGINT,
  hourly_rate NUMERIC,
  project TEXT,
  project_name VARCHAR(255),
  billable BOOLEAN,
  created_at TIMESTAMP,
  modified_at TIMESTAMP,
  creation_method VARCHAR(50),
  is_running BOOLEAN,
  project_id UUID,
  is_project_owner BOOLEAN,
  is_project_member BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_day_start TIMESTAMP;
  v_day_end TIMESTAMP;
BEGIN
  -- Calculate day boundaries (start of day to end of day)
  v_day_start := p_day_date::TIMESTAMP;
  v_day_end := (p_day_date + INTERVAL '1 day')::TIMESTAMP;

  RETURN QUERY
  WITH user_owned_shared_projects AS (
    -- Get project IDs (UUIDs) of shared projects owned by this user
    -- This uses the idx_projects_owner_shared index
    SELECT p.id AS owned_project_id
    FROM projects p
    WHERE p.owner_name = p_user_name 
      AND p.is_shared = true
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
    END as is_project_member
  FROM time_entries t
  LEFT JOIN projects p ON t.project_id = p.id
  WHERE t.start_time >= v_day_start
    AND t.start_time < v_day_end
    AND (
      -- User's own entries (any project or no project)
      -- Uses idx_time_entries_user_start index
      t.user_name = p_user_name
      OR
      -- Any user's entries in shared projects owned by this user
      -- Uses idx_time_entries_project_id index
      t.project_id IN (SELECT owned_project_id FROM user_owned_shared_projects)
    )
  ORDER BY t.start_time ASC;
END;
$$;

-- Update comment
COMMENT ON FUNCTION get_day_entries IS 
'Fetches time entries for a specific day for a user.
Returns:
1. All entries where user_name matches (user''s own work)
2. All entries in shared projects owned by the user (team member work)

Returns both project (Firestore ID) and project_id (Supabase UUID) for compatibility.
Includes is_project_owner and is_project_member flags for UI permissions.
Includes billable field to indicate if entry is billable (declarabel) or unbillable (niet-declarabel).
Joins on project_id (UUID foreign key) to get project_name.
Uses Supabase UUID as primary identifier (clean cutover from Firestore).
Optimized with indexes for fast execution (~20-50ms typical).';

