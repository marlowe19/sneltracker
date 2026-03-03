-- Migration 041: Create get_user_streak for on-demand streak computation
-- Daily: consecutive days with >= 1h logged (including today)
-- Weekly: consecutive weeks (Mon-Sun) with >= 3 active days
-- User's own entries only, same project access as get_user_xp_inputs

CREATE OR REPLACE FUNCTION get_user_streak(p_user_name TEXT)
RETURNS TABLE (
  daily_streak INT,
  weekly_streak INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_cutoff TIMESTAMPTZ := (v_today - INTERVAL '90 days')::timestamptz;
  v_daily INT := 0;
  v_weekly INT := 0;
BEGIN
  -- Daily streak: consecutive days with >= 1h, ending at today
  WITH user_projects AS (
    SELECT p.id FROM projects p
    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE (p.owner_name = p_user_name) OR (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  daily_totals AS (
    SELECT (t.start_time AT TIME ZONE 'UTC')::date AS day
    FROM time_entries t
    LEFT JOIN user_projects up ON t.project_id = up.id
    WHERE t.user_name = p_user_name
      AND t.start_time >= v_cutoff
      AND (t.project_id IS NULL OR up.id IS NOT NULL)
      AND t.duration_ms IS NOT NULL AND t.duration_ms > 0
    GROUP BY (t.start_time AT TIME ZONE 'UTC')::date
    HAVING SUM(t.duration_ms) >= 3600000
  ),
  ranked AS (
    SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day DESC))::int AS grp
    FROM daily_totals
  ),
  streak_groups AS (
    SELECT grp, MAX(day) AS last_day, COUNT(*) AS cnt
    FROM ranked
    GROUP BY grp
  )
  SELECT COALESCE(
    (SELECT cnt::INT FROM streak_groups WHERE last_day >= v_today ORDER BY last_day DESC LIMIT 1),
    0
  ) INTO v_daily;

  -- Weekly streak: consecutive weeks with >= 3 active days
  WITH user_projects AS (
    SELECT p.id FROM projects p
    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE (p.owner_name = p_user_name) OR (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  daily_totals AS (
    SELECT (t.start_time AT TIME ZONE 'UTC')::date AS day
    FROM time_entries t
    LEFT JOIN user_projects up ON t.project_id = up.id
    WHERE t.user_name = p_user_name
      AND t.start_time >= v_cutoff
      AND (t.project_id IS NULL OR up.id IS NOT NULL)
      AND t.duration_ms IS NOT NULL AND t.duration_ms > 0
    GROUP BY (t.start_time AT TIME ZONE 'UTC')::date
    HAVING SUM(t.duration_ms) >= 3600000
  ),
  weekly_totals AS (
    SELECT date_trunc('week', day::timestamp)::date AS week_start
    FROM daily_totals
    GROUP BY date_trunc('week', day::timestamp)
    HAVING COUNT(*) >= 3
  ),
  ranked_weeks AS (
    SELECT week_start,
           week_start - (ROW_NUMBER() OVER (ORDER BY week_start DESC) * 7)::int AS grp
    FROM weekly_totals
  ),
  streak_weeks AS (
    SELECT grp, MAX(week_start) AS last_week, COUNT(*) AS cnt
    FROM ranked_weeks
    GROUP BY grp
  )
  SELECT COALESCE(
    (SELECT cnt::INT FROM streak_weeks
     WHERE last_week >= date_trunc('week', v_today::timestamp)::date - 7
     ORDER BY last_week DESC LIMIT 1),
    0
  ) INTO v_weekly;

  RETURN QUERY SELECT v_daily, v_weekly;
END;
$$;

COMMENT ON FUNCTION get_user_streak IS
'Computes daily and weekly streak on-demand. Daily: consecutive days with >= 1h. Weekly: consecutive weeks with >= 3 active days.';
