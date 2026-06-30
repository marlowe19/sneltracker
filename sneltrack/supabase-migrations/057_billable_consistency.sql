-- Migration 057: Billable/unbillable consistency across project detail, reports, and activity breakdowns
-- v7 / v5: respect time_entries.billable and timer_activities.billable for earnings splits
-- Activity report functions: total_amount counts billable activities only (bug fix, same signature)

-- Shared helpers for entry-level vs activity-level billable duration
CREATE OR REPLACE FUNCTION fn_entry_billable_duration_ms(
  p_entry_id UUID,
  p_has_activities BOOLEAN,
  p_entry_billable BOOLEAN,
  p_entry_duration_ms BIGINT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_has_activities, false) = true
      AND EXISTS (
        SELECT 1
        FROM timer_activities ta
        WHERE ta.time_entry_id = p_entry_id
          AND ta.duration_ms IS NOT NULL
      )
    THEN COALESCE((
      SELECT SUM(ta.duration_ms)::BIGINT
      FROM timer_activities ta
      WHERE ta.time_entry_id = p_entry_id
        AND ta.duration_ms IS NOT NULL
        AND COALESCE(ta.billable, true) = true
    ), 0)
    WHEN COALESCE(p_entry_billable, true) = true
    THEN COALESCE(p_entry_duration_ms, 0)
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION fn_entry_unbillable_duration_ms(
  p_entry_id UUID,
  p_has_activities BOOLEAN,
  p_entry_billable BOOLEAN,
  p_entry_duration_ms BIGINT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_has_activities, false) = true
      AND EXISTS (
        SELECT 1
        FROM timer_activities ta
        WHERE ta.time_entry_id = p_entry_id
          AND ta.duration_ms IS NOT NULL
      )
    THEN COALESCE((
      SELECT SUM(ta.duration_ms)::BIGINT
      FROM timer_activities ta
      WHERE ta.time_entry_id = p_entry_id
        AND ta.duration_ms IS NOT NULL
        AND COALESCE(ta.billable, true) = false
    ), 0)
    WHEN COALESCE(p_entry_billable, true) = false
    THEN COALESCE(p_entry_duration_ms, 0)
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION fn_entry_billable_amount(
  p_entry_id UUID,
  p_has_activities BOOLEAN,
  p_entry_billable BOOLEAN,
  p_entry_duration_ms BIGINT,
  p_entry_hourly_rate NUMERIC,
  p_member_hourly_rate NUMERIC,
  p_project_hourly_rate NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_has_activities, false) = true
      AND EXISTS (
        SELECT 1
        FROM timer_activities ta
        WHERE ta.time_entry_id = p_entry_id
          AND ta.duration_ms IS NOT NULL
      )
    THEN COALESCE((
      SELECT SUM(
        (ta.duration_ms::NUMERIC / (1000 * 60 * 60)) *
        COALESCE(
          ta.hourly_rate,
          p_entry_hourly_rate,
          p_member_hourly_rate,
          p_project_hourly_rate,
          0
        )
      )
      FROM timer_activities ta
      WHERE ta.time_entry_id = p_entry_id
        AND ta.duration_ms IS NOT NULL
        AND COALESCE(ta.billable, true) = true
    ), 0)
    WHEN COALESCE(p_entry_billable, true) = true AND p_entry_hourly_rate IS NOT NULL
    THEN (COALESCE(p_entry_duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * p_entry_hourly_rate
    WHEN COALESCE(p_entry_billable, true) = true AND p_member_hourly_rate IS NOT NULL
    THEN (COALESCE(p_entry_duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * p_member_hourly_rate
    WHEN COALESCE(p_entry_billable, true) = true AND p_project_hourly_rate IS NOT NULL
    THEN (COALESCE(p_entry_duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * p_project_hourly_rate
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION fn_entry_billable_duration_ms IS
'Billable duration for a time entry: sums billable timer_activities when present, else uses entry billable flag.';

COMMENT ON FUNCTION fn_entry_unbillable_duration_ms IS
'Unbillable duration for a time entry: sums unbillable timer_activities when present, else uses entry billable flag.';

COMMENT ON FUNCTION fn_entry_billable_amount IS
'Billable earnings for a time entry using entry/member/project rate fallback (same as project detail v6).';

-- Reports v5: activity-aware billable/unbillable hour splits
CREATE OR REPLACE FUNCTION get_user_project_reports_v5(
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
      SUM(
        fn_entry_billable_duration_ms(
          t.id, t.has_activities, t.billable, t.duration_ms
        )
      )::BIGINT as billable_duration_ms,
      SUM(
        fn_entry_unbillable_duration_ms(
          t.id, t.has_activities, t.billable, t.duration_ms
        )
      )::BIGINT as unbillable_duration_ms
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE
      t.start_time >= p_start_date
      AND t.start_time < p_end_date
      AND (
        (up.is_shared = false AND t.user_name = p_user_name)
        OR (up.is_shared = true AND (up.is_owner = true OR up.member_role = 'owner'))
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
      SUM(
        fn_entry_billable_duration_ms(
          t.id, t.has_activities, t.billable, t.duration_ms
        )
      )::BIGINT as billable_duration_ms,
      SUM(
        fn_entry_unbillable_duration_ms(
          t.id, t.has_activities, t.billable, t.duration_ms
        )
      )::BIGINT as unbillable_duration_ms,
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

COMMENT ON FUNCTION get_user_project_reports_v5 IS
'Project reports v5: billable/unbillable splits respect timer_activities.billable when an entry has activities.
Same visibility rules as v4. v4 remains for backward compatibility.';

-- Project detail v7: billable-aware earnings (same rate fallback as v6)
CREATE OR REPLACE FUNCTION get_project_detail_v7(
  p_user_name TEXT,
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
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
  total_hours NUMERIC(10,2),
  entry_count BIGINT,
  total_billable NUMERIC(10,2),
  total_break_ms BIGINT,
  members JSONB,
  member_statistics JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH project_info AS (
    SELECT
      p.id,
      p.name,
      p.hourly_rate,
      p.budget_hours,
      p.is_shared,
      p.is_default,
      p.owner_name,
      pm.hourly_rate as member_hourly_rate,
      pm.role::TEXT as member_role,
      (p.owner_name = p_user_name) as is_owner
    FROM projects p
    LEFT JOIN project_members pm
      ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE p.id = p_project_id
      AND (
        (p.owner_name = p_user_name)
        OR (pm.user_name = p_user_name)
      )
  ),
  project_stats AS (
    SELECT
      ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2) as total_hours,
      COUNT(*)::BIGINT as entry_count,
      SUM(
        fn_entry_billable_amount(
          t.id,
          t.has_activities,
          t.billable,
          t.duration_ms,
          t.hourly_rate,
          pm2.hourly_rate,
          pi.hourly_rate
        )
      )::NUMERIC(10,2) as total_billable,
      COALESCE(SUM(t.break_deduction_ms), 0)::BIGINT as total_break_ms
    FROM time_entries t
    CROSS JOIN project_info pi
    LEFT JOIN public.project_members pm2 ON pm2.project_id = t.project_id AND pm2.user_name = t.user_name
    WHERE t.project_id = p_project_id
      AND (p_start_date IS NULL OR t.start_time >= p_start_date)
      AND (p_end_date IS NULL OR t.start_time < p_end_date)
  ),
  project_members AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'user_name', pm.user_name,
          'user_display_name', COALESCE(u.name, pm.user_name),
          'role', pm.role,
          'hourly_rate', pm.hourly_rate,
          'capacity_per_week', pm.capacity_per_week,
          'added_at', pm.added_at
        )
        ORDER BY pm.added_at
      ) as members
    FROM public.project_members pm
    LEFT JOIN users u ON u.user_name = pm.user_name
    WHERE pm.project_id = p_project_id
  ),
  member_totals AS (
    SELECT
      t.user_name,
      t.user_id,
      ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2) as total_hours,
      COUNT(*)::BIGINT as entry_count,
      SUM(t.duration_ms) as total_duration_ms,
      SUM(
        fn_entry_billable_amount(
          t.id,
          t.has_activities,
          t.billable,
          t.duration_ms,
          t.hourly_rate,
          pm3.hourly_rate,
          pi.hourly_rate
        )
      )::NUMERIC(10,2) as billable_amount
    FROM time_entries t
    INNER JOIN project_info pi ON t.project_id = pi.id
    LEFT JOIN public.project_members pm3 ON pm3.project_id = t.project_id AND pm3.user_name = t.user_name
    WHERE
      t.project_id = p_project_id
      AND (p_start_date IS NULL OR t.start_time >= p_start_date)
      AND (p_end_date IS NULL OR t.start_time < p_end_date)
      AND pi.is_shared = true
      AND (pi.is_owner = true OR pi.member_role = 'owner')
    GROUP BY t.user_name, t.user_id
  ),
  member_stats AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'user_name', mt.user_name,
          'user_display_name', COALESCE(u.name, mt.user_name),
          'totalHours', mt.total_hours,
          'entryCount', mt.entry_count,
          'billableAmount', mt.billable_amount,
          'totalMoney', mt.billable_amount
        )
        ORDER BY mt.total_duration_ms DESC
      ) as member_statistics
    FROM member_totals mt
    LEFT JOIN users u ON u.id = mt.user_id
  )
  SELECT
    pi.id,
    pi.name,
    pi.hourly_rate,
    pi.budget_hours,
    pi.is_shared,
    pi.is_default,
    pi.owner_name,
    pi.member_hourly_rate,
    pi.is_owner,
    COALESCE(ps.total_hours, 0),
    COALESCE(ps.entry_count, 0),
    COALESCE(ps.total_billable, 0),
    COALESCE(ps.total_break_ms, 0),
    pm.members,
    ms.member_statistics
  FROM project_info pi
  LEFT JOIN project_stats ps ON true
  LEFT JOIN project_members pm ON true
  LEFT JOIN member_stats ms ON true;
END;
$$;

COMMENT ON FUNCTION get_project_detail_v7 IS
'Project detail v7: total_billable respects billable flags (entry and timer_activities).
Same rate fallback and break totals as v6. v6 remains for backward compatibility.';

-- Activity reports: total_amount only for billable activities (hours unchanged)
CREATE OR REPLACE FUNCTION get_activities_report(
  p_user_name TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_project_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  activity_type VARCHAR(100),
  total_hours NUMERIC(10,2),
  count BIGINT,
  hourly_rate NUMERIC(10,2),
  total_amount NUMERIC(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.activity_type::VARCHAR(100),
    ROUND(SUM(COALESCE(ta.duration_ms, 0))::NUMERIC / (1000 * 60 * 60), 2) as total_hours,
    COUNT(*)::BIGINT as count,
    ROUND(AVG(COALESCE(ta.hourly_rate, 0))::NUMERIC, 2) as hourly_rate,
    ROUND(
      SUM(
        CASE
          WHEN COALESCE(ta.billable, true) = true
          THEN (COALESCE(ta.duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * COALESCE(ta.hourly_rate, 0)
          ELSE 0
        END
      ),
      2
    ) as total_amount
  FROM timer_activities ta
  INNER JOIN time_entries t ON ta.time_entry_id = t.id
  WHERE
    t.user_name = p_user_name
    AND t.start_time >= p_start_date
    AND t.start_time < p_end_date
    AND (p_project_ids IS NULL OR t.project_id = ANY(p_project_ids))
    AND ta.duration_ms IS NOT NULL
  GROUP BY ta.activity_type
  ORDER BY total_hours DESC, ta.activity_type;
END;
$$;

CREATE OR REPLACE FUNCTION get_project_activities_report(
  p_user_name TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_project_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  project_id UUID,
  activity_type VARCHAR(100),
  total_hours NUMERIC(10,2),
  count BIGINT,
  hourly_rate NUMERIC(10,2),
  total_amount NUMERIC(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.project_id,
    ta.activity_type::VARCHAR(100),
    ROUND(SUM(COALESCE(ta.duration_ms, 0))::NUMERIC / (1000 * 60 * 60), 2) as total_hours,
    COUNT(*)::BIGINT as count,
    ROUND(AVG(COALESCE(ta.hourly_rate, 0))::NUMERIC, 2) as hourly_rate,
    ROUND(
      SUM(
        CASE
          WHEN COALESCE(ta.billable, true) = true
          THEN (COALESCE(ta.duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * COALESCE(ta.hourly_rate, 0)
          ELSE 0
        END
      ),
      2
    ) as total_amount
  FROM timer_activities ta
  INNER JOIN time_entries t ON ta.time_entry_id = t.id
  WHERE
    t.user_name = p_user_name
    AND t.start_time >= p_start_date
    AND t.start_time < p_end_date
    AND (p_project_ids IS NULL OR t.project_id = ANY(p_project_ids))
    AND ta.duration_ms IS NOT NULL
    AND t.project_id IS NOT NULL
  GROUP BY t.project_id, ta.activity_type
  ORDER BY t.project_id, total_hours DESC, ta.activity_type;
END;
$$;

COMMENT ON FUNCTION get_activities_report IS
'Overall activities breakdown. total_hours includes all activities; total_amount is billable activities only.';

COMMENT ON FUNCTION get_project_activities_report IS
'Per-project activities breakdown. total_hours includes all activities; total_amount is billable activities only.';
