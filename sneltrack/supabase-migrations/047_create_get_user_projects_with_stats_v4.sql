-- Migration 047: Create get_user_projects_with_stats_v4
-- Extends v3: members with role 'owner' in project_members see all team hours,
-- matching what the project creator (owner_name) sees.
-- v1, v2, v3 remain available for backward compatibility.

CREATE OR REPLACE FUNCTION get_user_projects_with_stats_v4(p_user_name TEXT)
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
  member_role TEXT,
  member_count INT,
  total_hours NUMERIC(10,2),
  is_over_budget BOOLEAN,
  status VARCHAR(32)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_projects AS (
    SELECT
      p.id,
      p.name,
      p.hourly_rate,
      p.budget_hours,
      p.is_shared,
      p.is_default,
      p.owner_name,
      p.status,
      pm.hourly_rate as member_hourly_rate,
      pm.role::TEXT as member_role,
      (p.owner_name = p_user_name) as is_owner
    FROM projects p
    LEFT JOIN project_members pm
      ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE
      (p.owner_name = p_user_name AND p.is_shared = false)
      OR (p.owner_name = p_user_name AND p.is_shared = true)
      OR (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  project_hours AS (
    SELECT
      t.project_id,
      ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2) as total_hours
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE
      (up.is_shared = false AND t.user_name = p_user_name)
      -- Creator OR member with owner role sees all team hours
      OR (up.is_shared = true AND (up.is_owner = true OR up.member_role = 'owner'))
      -- Regular members (role != 'owner', NULL-safe) see only their own hours
      OR (up.is_shared = true AND up.is_owner = false AND up.member_role IS DISTINCT FROM 'owner' AND t.user_name = p_user_name)
    GROUP BY t.project_id
  ),
  project_member_counts AS (
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
    up.member_role,
    COALESCE(pmc.member_count, 0),
    COALESCE(ph.total_hours, 0)::NUMERIC(10,2),
    (up.budget_hours > 0 AND COALESCE(ph.total_hours, 0) > up.budget_hours) as is_over_budget,
    COALESCE(up.status, 'active') as status
  FROM user_projects up
  LEFT JOIN project_hours ph ON up.id = ph.project_id
  LEFT JOIN project_member_counts pmc ON up.id = pmc.project_id
  ORDER BY up.name;
END;
$$;

COMMENT ON FUNCTION get_user_projects_with_stats_v4 IS
'Get all projects for a user with statistics (hours, progress, etc.) - v4.
v4 change: members with role=''owner'' in project_members see all team hours,
matching what the project creator sees. Regular members still see only their own hours.
Includes member_role, status fields.
v1, v2, v3 remain available for backward compatibility.';
