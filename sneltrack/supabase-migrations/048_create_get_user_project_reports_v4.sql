-- Migration 048: Create get_user_project_reports_v4
-- Extends v3: members with role 'owner' in project_members see all team
-- time/expense data and member breakdowns, matching what the creator sees.
-- v1, v2, v3 remain available for backward compatibility.

CREATE OR REPLACE FUNCTION get_user_project_reports_v4(
  p_user_name TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  project_id UUID,
  project_name VARCHAR(255),
  project_hourly_rate NUMERIC(10,2),
  member_hourly_rate NUMERIC(10,2),
  is_shared BOOLEAN,
  owner_name TEXT,
  is_default BOOLEAN,
  is_owner BOOLEAN,
  entry_count BIGINT,
  total_duration_ms BIGINT,
  billable_duration_ms BIGINT,
  unbillable_duration_ms BIGINT,
  total_expenses NUMERIC(10,2),
  members JSONB
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
      p.is_shared,
      p.owner_name,
      p.is_default,
      p.owner_id,
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
  time_stats AS (
    SELECT
      t.project_id,
      COUNT(*)::BIGINT as entry_count,
      SUM(t.duration_ms)::BIGINT as total_duration_ms,
      SUM(CASE WHEN COALESCE(t.billable, true) = true THEN t.duration_ms ELSE 0 END)::BIGINT as billable_duration_ms,
      SUM(CASE WHEN COALESCE(t.billable, true) = false THEN t.duration_ms ELSE 0 END)::BIGINT as unbillable_duration_ms
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE
      t.start_time >= p_start_date
      AND t.start_time < p_end_date
      AND (
        (up.is_shared = false AND t.user_name = p_user_name)
        -- Creator OR member with owner role sees all team entries
        OR (up.is_shared = true AND (up.is_owner = true OR up.member_role = 'owner'))
        -- Regular members (role != 'owner', NULL-safe) see only their own
        OR (up.is_shared = true AND up.is_owner = false AND up.member_role IS DISTINCT FROM 'owner' AND t.user_name = p_user_name)
      )
    GROUP BY t.project_id
  ),
  expense_stats AS (
    SELECT
      e.project_id,
      SUM(e.price)::NUMERIC(10,2) as total_expenses
    FROM expenses e
    INNER JOIN user_projects up ON e.project_id = up.id
    WHERE
      e.date >= p_start_date::DATE
      AND e.date < p_end_date::DATE
      AND (
        (up.is_shared = false AND e.user_name = p_user_name)
        OR (up.is_shared = true AND (up.is_owner = true OR up.member_role = 'owner'))
        OR (up.is_shared = true AND up.is_owner = false AND up.member_role IS DISTINCT FROM 'owner' AND e.user_name = p_user_name)
      )
    GROUP BY e.project_id
  ),
  member_expenses AS (
    SELECT
      e.project_id,
      e.user_name,
      SUM(e.price)::NUMERIC(10,2) as member_expenses
    FROM expenses e
    INNER JOIN user_projects up ON e.project_id = up.id
    WHERE
      e.date >= p_start_date::DATE
      AND e.date < p_end_date::DATE
      AND up.is_shared = true
      AND (up.is_owner = true OR up.member_role = 'owner')
    GROUP BY e.project_id, e.user_name
  ),
  member_totals AS (
    SELECT
      t.project_id,
      t.user_name,
      t.user_id,
      SUM(t.duration_ms)::BIGINT as total_duration_ms,
      SUM(CASE WHEN COALESCE(t.billable, true) = true THEN t.duration_ms ELSE 0 END)::BIGINT as billable_duration_ms,
      SUM(CASE WHEN COALESCE(t.billable, true) = false THEN t.duration_ms ELSE 0 END)::BIGINT as unbillable_duration_ms,
      COUNT(*)::BIGINT as entry_count
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE
      t.start_time >= p_start_date
      AND t.start_time < p_end_date
      AND up.is_shared = true
      AND (up.is_owner = true OR up.member_role = 'owner')
    GROUP BY t.project_id, t.user_name, t.user_id
  ),
  member_stats AS (
    SELECT
      mt.project_id,
      jsonb_agg(
        jsonb_build_object(
          'user_name', mt.user_name,
          'user_display_name', COALESCE(u.name, mt.user_name),
          'hours', ROUND((mt.total_duration_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC, 2),
          'billableHours', ROUND((mt.billable_duration_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC, 2),
          'unbillableHours', ROUND((mt.unbillable_duration_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC, 2),
          'entryCount', mt.entry_count,
          'expenses', COALESCE(me.member_expenses, 0)::NUMERIC(10,2)
        )
        ORDER BY mt.total_duration_ms DESC
      ) as members
    FROM member_totals mt
    LEFT JOIN member_expenses me ON me.project_id = mt.project_id AND me.user_name = mt.user_name
    LEFT JOIN users u ON u.id = mt.user_id
    GROUP BY mt.project_id
  )
  SELECT
    up.id,
    up.name,
    up.hourly_rate,
    up.member_hourly_rate,
    up.is_shared,
    up.owner_name,
    up.is_default,
    up.is_owner,
    COALESCE(ts.entry_count, 0)::BIGINT,
    COALESCE(ts.total_duration_ms, 0)::BIGINT,
    COALESCE(ts.billable_duration_ms, 0)::BIGINT,
    COALESCE(ts.unbillable_duration_ms, 0)::BIGINT,
    COALESCE(es.total_expenses, 0)::NUMERIC(10,2),
    COALESCE(ms.members, '[]'::jsonb)::JSONB
  FROM user_projects up
  LEFT JOIN time_stats ts ON up.id = ts.project_id
  LEFT JOIN expense_stats es ON up.id = es.project_id
  LEFT JOIN member_stats ms ON up.id = ms.project_id
  WHERE COALESCE(ts.entry_count, 0) > 0
  ORDER BY up.name;
END;
$$;

COMMENT ON FUNCTION get_user_project_reports_v4 IS
'Get project reports for a user within a date range (v4).
v4 change: members with role=''owner'' in project_members see all team data
and member breakdowns, matching what the project creator sees.
Regular members still see only their own data.
v1, v2, v3 remain available for backward compatibility.';
