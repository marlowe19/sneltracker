-- Migration 028: Create get_user_projects_with_stats_v2 with member_role field
-- Adds the current user's role from project_members table to enable role-based access checks
-- This allows the application to check if a user has "owner" role in shared projects
-- v1 remains available for backward compatibility

CREATE OR REPLACE FUNCTION get_user_projects_with_stats_v2(p_user_name TEXT)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  hourly_rate NUMERIC(10,2),
  budget_hours NUMERIC(10,2),
  is_shared BOOLEAN,
  is_default BOOLEAN,
  owner_name TEXT,
  member_hourly_rate NUMERIC(10,2),
  is_owner BOOLEAN,
  member_role TEXT,  -- ✅ NEW: User's role from project_members
  member_count INT,
  total_hours NUMERIC(10,2),
  is_over_budget BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_projects AS (
    -- Get all projects user has access to
    SELECT 
      p.id,
      p.name,
      p.hourly_rate,
      p.budget_hours,
      p.is_shared,
      p.is_default,
      p.owner_name,
      pm.hourly_rate as member_hourly_rate,
      pm.role::TEXT as member_role,  -- ✅ FIX: Cast VARCHAR(50) to TEXT to match return type
      (p.owner_name = p_user_name) as is_owner
    FROM projects p
    LEFT JOIN project_members pm 
      ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE 
      -- User's own projects
      (p.owner_name = p_user_name AND p.is_shared = false)
      OR 
      -- Shared projects where user is owner
      (p.owner_name = p_user_name AND p.is_shared = true)
      OR 
      -- Shared projects where user is member
      (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  project_hours AS (
    -- Calculate total hours per project (all-time)
    SELECT
      t.project_id,
      ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2) as total_hours
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE 
      -- Apply same visibility rules as reports
      (up.is_shared = false AND t.user_name = p_user_name)
      OR (up.is_shared = true AND up.is_owner = true)
      OR (up.is_shared = true AND up.is_owner = false AND t.user_name = p_user_name)
    GROUP BY t.project_id
  ),
  project_member_counts AS (
    -- Count members per shared project
    SELECT
      pm.project_id,
      COUNT(*)::INT as member_count
    FROM project_members pm
    INNER JOIN user_projects up ON pm.project_id = up.id
    GROUP BY pm.project_id
  )
  SELECT
    up.id,
    up.name,
    up.hourly_rate,
    up.budget_hours,
    up.is_shared,
    up.is_default,
    up.owner_name,
    up.member_hourly_rate,
    up.is_owner,
    up.member_role,  -- ✅ NEW: Include member_role in result
    COALESCE(pmc.member_count, 0),
    COALESCE(ph.total_hours, 0)::NUMERIC(10,2),
    -- Simple flag for over budget (useful for sorting/filtering)
    (up.budget_hours > 0 AND COALESCE(ph.total_hours, 0) > up.budget_hours) as is_over_budget
  FROM user_projects up
  LEFT JOIN project_hours ph ON up.id = ph.project_id
  LEFT JOIN project_member_counts pmc ON up.id = pmc.project_id
  ORDER BY up.name;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION get_user_projects_with_stats_v2 IS 
'Get all projects for a user with statistics (hours, progress, etc.) - v2.
Includes member_role field indicating the current user''s role in project_members table (owner/member).
Returns null for member_role if user is not a member (e.g., for their own non-shared projects).
This enables role-based access checks in the application layer.
v1 remains available for backward compatibility.';

