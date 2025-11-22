-- Migration 012: Create get_user_project_reports_v2 using billable boolean field
-- Creates a new v2 function that uses the billable boolean field instead of hourly_rate check
-- This ensures the reports pie chart correctly reflects user's billable/unbillable selections
-- The original function remains available for backward compatibility during deployment

-- Create new v2 function using billable boolean field
CREATE OR REPLACE FUNCTION get_user_project_reports_v2(
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
    -- Get all projects user has access to
    SELECT 
      p.id,
      p.name,
      p.hourly_rate,
      p.is_shared,
      p.owner_name,
      p.is_default,
      p.owner_id,
      pm.hourly_rate as member_hourly_rate,
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
  time_stats AS (
    -- Calculate time entry statistics
    SELECT
      t.project_id,
      COUNT(*)::BIGINT as entry_count,
      SUM(t.duration_ms)::BIGINT as total_duration_ms,
      -- ✅ UPDATED: Use billable boolean field instead of hourly_rate check
      -- Billable = billable boolean is true (defaults to true if NULL for backward compatibility)
      SUM(CASE WHEN COALESCE(t.billable, true) = true THEN t.duration_ms ELSE 0 END)::BIGINT as billable_duration_ms,
      -- ✅ UPDATED: Use billable boolean field instead of hourly_rate check
      -- Unbillable = billable boolean is false
      SUM(CASE WHEN COALESCE(t.billable, true) = false THEN t.duration_ms ELSE 0 END)::BIGINT as unbillable_duration_ms
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE 
      t.start_time >= p_start_date 
      AND t.start_time < p_end_date
      AND (
        -- For shared projects: owner sees all, members see only theirs
        (up.is_shared = false AND t.user_name = p_user_name)
        OR (up.is_shared = true AND up.is_owner = true)
        OR (up.is_shared = true AND up.is_owner = false AND t.user_name = p_user_name)
      )
    GROUP BY t.project_id
  ),
  expense_stats AS (
    -- Calculate expense totals
    SELECT
      e.project_id,
      SUM(e.price)::NUMERIC(10,2) as total_expenses
    FROM expenses e
    INNER JOIN user_projects up ON e.project_id = up.id
    WHERE 
      e.date >= p_start_date::DATE 
      AND e.date < p_end_date::DATE
      AND (
        -- Same visibility rules as time entries
        (up.is_shared = false AND e.user_name = p_user_name)
        OR (up.is_shared = true AND up.is_owner = true)
        OR (up.is_shared = true AND up.is_owner = false AND e.user_name = p_user_name)
      )
    GROUP BY e.project_id
  ),
  member_expenses AS (
    -- Calculate per-member expenses for shared projects
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
      AND up.is_owner = true  -- Only for projects where user is owner
    GROUP BY e.project_id, e.user_name
  ),
  member_totals AS (
    -- Calculate per-member statistics for shared projects where user is owner
    SELECT
      t.project_id,
      t.user_name,
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
      AND up.is_owner = true  -- Only aggregate members for projects where user is owner
    GROUP BY t.project_id, t.user_name
  ),
  member_stats AS (
    -- Aggregate member totals into JSONB array
    SELECT
      mt.project_id,
      jsonb_agg(
        jsonb_build_object(
          'user_name', mt.user_name,
          'hours', ROUND((mt.total_duration_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC, 2),
          -- ✅ UPDATED: Use billable boolean field instead of hourly_rate check
          'billableHours', ROUND((mt.billable_duration_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC, 2),
          -- ✅ UPDATED: Use billable boolean field instead of hourly_rate check
          'unbillableHours', ROUND((mt.unbillable_duration_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC, 2),
          'entryCount', mt.entry_count,
          'expenses', COALESCE(me.member_expenses, 0)::NUMERIC(10,2)
        )
        ORDER BY mt.total_duration_ms DESC
      ) as members
    FROM member_totals mt
    LEFT JOIN member_expenses me ON me.project_id = mt.project_id AND me.user_name = mt.user_name
    GROUP BY mt.project_id
  )
  -- Combine everything
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
  WHERE COALESCE(ts.entry_count, 0) > 0  -- Only projects with entries
  ORDER BY up.name;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION get_user_project_reports_v2 IS 
'Get project reports for a user within a date range with billable/unbillable breakdown (v2).
Uses the billable boolean field from time_entries to determine billable vs unbillable hours.
This ensures the reports pie chart correctly reflects user selections (declarabel/niet-declarabel).

Version 2 changes:
- Uses billable boolean field instead of checking hourly_rate IS NOT NULL
- Provides accurate billable/unbillable classification based on user selections

Returns:
- Project statistics (total hours, billable hours, unbillable hours, expenses)
- Member breakdowns for shared projects (where user is owner)
- All calculations use the billable boolean field

Safe deployment: This is a new function, so the original get_user_project_reports remains available.';
