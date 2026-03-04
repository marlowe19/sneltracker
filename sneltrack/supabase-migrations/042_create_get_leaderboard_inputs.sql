-- Migration 042: Create get_leaderboard_inputs for leaderboard
-- Returns XP inputs for ALL users with time entries in a date range
-- Uses get_user_xp_inputs per user via LATERAL join
-- Includes display_name from users table

CREATE OR REPLACE FUNCTION get_leaderboard_inputs(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  user_name TEXT,
  display_name TEXT,
  total_hours NUMERIC(12,4),
  total_revenue NUMERIC(12,2),
  active_days_count INT,
  active_weeks_count INT,
  weeks_in_period INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH distinct_users AS (
    SELECT DISTINCT t.user_name
    FROM time_entries t
    WHERE t.start_time >= p_start_date
      AND t.start_time < p_end_date
      AND t.duration_ms IS NOT NULL
      AND t.duration_ms > 0
  )
  SELECT
    du.user_name::TEXT,
    COALESCE(u.name, du.user_name)::TEXT AS display_name,
    x.total_hours,
    x.total_revenue,
    x.active_days_count,
    x.active_weeks_count,
    x.weeks_in_month AS weeks_in_period
  FROM distinct_users du
  LEFT JOIN users u ON u.user_name = du.user_name
  CROSS JOIN LATERAL get_user_xp_inputs(du.user_name, p_start_date, p_end_date) x;
END;
$$;

COMMENT ON FUNCTION get_leaderboard_inputs IS
'Returns XP inputs for all users with time entries in a date range.
Used for leaderboard. Joins users table for display_name.';
