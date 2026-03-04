-- Migration 039: Create get_user_xp_inputs for XP gamification
-- Returns aggregated inputs for XP calculation: hours, revenue, active days/weeks
-- User's own entries only (not team totals for shared project owners)
-- No expenses: fixed expenses and project expenses excluded from this feature

CREATE OR REPLACE FUNCTION get_user_xp_inputs(
  p_user_name TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_hours NUMERIC(12,4),
  total_revenue NUMERIC(12,2),
  active_days_count INT,
  active_weeks_count INT,
  weeks_in_month INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_weeks_in_month INT;
BEGIN
  -- Count calendar weeks (Monday start) that overlap the month range
  SELECT COUNT(DISTINCT date_trunc('week', d::timestamp)::date)::INT
  INTO v_weeks_in_month
  FROM generate_series(
    p_start_date::date,
    (p_end_date - INTERVAL '1 day')::date,
    INTERVAL '1 day'
  ) AS d;

  -- Ensure at least 1 if range is valid
  IF v_weeks_in_month = 0 AND p_start_date < p_end_date THEN
    v_weeks_in_month := 1;
  END IF;

  RETURN QUERY
  WITH user_projects AS (
    SELECT p.id, p.hourly_rate, pm.hourly_rate AS member_hourly_rate
    FROM projects p
    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE
      (p.owner_name = p_user_name AND p.is_shared = false)
      OR (p.owner_name = p_user_name AND p.is_shared = true)
      OR (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  user_entries AS (
    SELECT
      t.duration_ms,
      t.start_time,
      CASE WHEN COALESCE(t.billable, true) = true THEN t.duration_ms ELSE 0 END AS billable_ms,
      COALESCE(
        t.hourly_rate,
        up.member_hourly_rate,
        up.hourly_rate,
        0
      )::NUMERIC AS rate
    FROM time_entries t
    LEFT JOIN user_projects up ON t.project_id = up.id
    WHERE
      t.user_name = p_user_name
      AND t.start_time >= p_start_date
      AND t.start_time < p_end_date
      AND (t.project_id IS NULL OR up.id IS NOT NULL)
      AND t.duration_ms IS NOT NULL
      AND t.duration_ms > 0
  ),
  agg AS (
    SELECT
      COALESCE(SUM(ue.duration_ms), 0)::BIGINT AS total_ms,
      COALESCE(SUM((ue.billable_ms::NUMERIC / (1000 * 60 * 60)) * ue.rate), 0)::NUMERIC(12,2) AS revenue
    FROM user_entries ue
  ),
  daily_totals AS (
    SELECT
      ue.start_time::date AS day,
      SUM(ue.duration_ms)::BIGINT AS day_ms
    FROM user_entries ue
    GROUP BY ue.start_time::date
  ),
  active_days AS (
    SELECT COUNT(*)::INT AS cnt
    FROM daily_totals
    WHERE day_ms >= 3600000
  ),
  weekly_days AS (
    SELECT
      date_trunc('week', day::timestamp)::date AS week_start,
      COUNT(*)::INT AS days_in_week
    FROM daily_totals
    WHERE day_ms >= 3600000
    GROUP BY date_trunc('week', day::timestamp)
  ),
  active_weeks AS (
    SELECT COUNT(*)::INT AS cnt
    FROM weekly_days
    WHERE days_in_week >= 3
  )
  SELECT
    (a.total_ms::NUMERIC / (1000 * 60 * 60))::NUMERIC(12,4),
    a.revenue,
    COALESCE(ad.cnt, 0),
    COALESCE(aw.cnt, 0),
    v_weeks_in_month
  FROM agg a
  CROSS JOIN active_days ad
  CROSS JOIN active_weeks aw;
END;
$$;

COMMENT ON FUNCTION get_user_xp_inputs IS
'Returns XP calculation inputs for a user in a date range.
User-only aggregation (not team totals). No expenses.
Used by XP gamification engine.';

-- Multi-period variant: fetch multiple date ranges in one call (e.g. this month + last month for growth)
CREATE OR REPLACE FUNCTION get_user_xp_inputs_multi(
  p_user_name TEXT,
  p_ranges JSONB
)
RETURNS TABLE (
  range_index INT,
  total_hours NUMERIC(12,4),
  total_revenue NUMERIC(12,2),
  active_days_count INT,
  active_weeks_count INT,
  weeks_in_month INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      (elem->>'start')::timestamptz AS start_ts,
      (elem->>'end')::timestamptz AS end_ts,
      ord
    FROM jsonb_array_elements(p_ranges) WITH ORDINALITY AS t(elem, ord)
  LOOP
    RETURN QUERY
    SELECT
      (r.ord - 1)::INT,
      x.total_hours,
      x.total_revenue,
      x.active_days_count,
      x.active_weeks_count,
      x.weeks_in_month
    FROM get_user_xp_inputs(p_user_name, r.start_ts, r.end_ts) x;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION get_user_xp_inputs_multi IS
'Calls get_user_xp_inputs for multiple date ranges. p_ranges: [{"start":"...","end":"..."}, ...]';
