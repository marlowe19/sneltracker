-- Migration 035: Create functions to aggregate activities for reports
-- Provides overall and per-project activity breakdowns by activity_type
-- Aggregates timer_activities joined with time_entries for user filtering

-- Drop existing functions if they exist (in case return type changed)
DROP FUNCTION IF EXISTS get_activities_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID[]);
DROP FUNCTION IF EXISTS get_project_activities_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID[]);

-- Function 1: Overall activities aggregation
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
    ROUND(SUM((COALESCE(ta.duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * COALESCE(ta.hourly_rate, 0)), 2) as total_amount
  FROM timer_activities ta
  INNER JOIN time_entries t ON ta.time_entry_id = t.id
  WHERE
    t.user_name = p_user_name
    AND t.start_time >= p_start_date
    AND t.start_time < p_end_date
    AND (p_project_ids IS NULL OR t.project_id = ANY(p_project_ids))
    AND ta.duration_ms IS NOT NULL -- Only count completed activities
  GROUP BY ta.activity_type
  ORDER BY total_hours DESC, ta.activity_type;
END;
$$;

-- Function 2: Per-project activities aggregation
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
    ROUND(SUM((COALESCE(ta.duration_ms, 0)::NUMERIC / (1000 * 60 * 60)) * COALESCE(ta.hourly_rate, 0)), 2) as total_amount
  FROM timer_activities ta
  INNER JOIN time_entries t ON ta.time_entry_id = t.id
  WHERE
    t.user_name = p_user_name
    AND t.start_time >= p_start_date
    AND t.start_time < p_end_date
    AND (p_project_ids IS NULL OR t.project_id = ANY(p_project_ids))
    AND ta.duration_ms IS NOT NULL -- Only count completed activities
    AND t.project_id IS NOT NULL -- Only include entries with projects
  GROUP BY t.project_id, ta.activity_type
  ORDER BY t.project_id, total_hours DESC, ta.activity_type;
END;
$$;

-- Add comments
COMMENT ON FUNCTION get_activities_report IS 
'Get overall activities breakdown by activity_type for a user within a date range.
Filters by user_name, date range, and optionally by project_ids.
Returns activity_type, total_hours, count, hourly_rate (average), and total_amount for each activity type.
Only includes completed activities (duration_ms IS NOT NULL).';

COMMENT ON FUNCTION get_project_activities_report IS 
'Get per-project activities breakdown by activity_type for a user within a date range.
Filters by user_name, date range, and optionally by project_ids.
Returns project_id, activity_type, total_hours, count, hourly_rate (average), and total_amount for each project-activity combination.
Only includes completed activities (duration_ms IS NOT NULL) and entries with projects.';

