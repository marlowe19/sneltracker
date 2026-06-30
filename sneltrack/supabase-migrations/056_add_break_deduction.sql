-- Migration 056: Break deduction on time entries + project defaults

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS default_break_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_break_minutes INTEGER;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS break_deduction_ms BIGINT;

COMMENT ON COLUMN projects.default_break_enabled IS
  'When true, new stopped timer entries on this project apply the default break automatically.';
COMMENT ON COLUMN projects.default_break_minutes IS
  'Default break length in minutes when default_break_enabled is true. NULL = 30 minutes in app code.';
COMMENT ON COLUMN time_entries.break_deduction_ms IS
  'Milliseconds subtracted as break from gross clock time. NULL = no break applied.';

-- Create get_day_entries_v5 (v4 remains for backward compatibility)
CREATE OR REPLACE FUNCTION get_day_entries_v5(
  p_user_name TEXT,
  p_day_date DATE
)
RETURNS TABLE (
  id UUID,
  firestore_id TEXT,
  user_name VARCHAR(255),
  user_display_name VARCHAR(255),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  duration_hours NUMERIC(10,2),
  hourly_rate NUMERIC,
  project TEXT,
  project_id UUID,
  project_name VARCHAR(255),
  billable BOOLEAN,
  is_project_owner BOOLEAN,
  is_project_member BOOLEAN,
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  creation_method VARCHAR(50),
  is_running BOOLEAN,
  has_activities BOOLEAN,
  current_activity_id UUID,
  activities JSONB,
  break_deduction_ms BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
BEGIN
  v_day_start := p_day_date::TIMESTAMPTZ;
  v_day_end := (p_day_date + INTERVAL '1 day')::TIMESTAMPTZ;

  RETURN QUERY
  WITH visible_shared_projects AS (
    SELECT p.id AS visible_project_id
    FROM projects p
    WHERE p.is_shared = true
      AND (
        p.owner_name = p_user_name
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_name = p_user_name
            AND pm.role = 'owner'
        )
      )
  )
  SELECT
    t.id,
    t.firestore_id,
    t.user_name,
    u.name::VARCHAR(255) as user_display_name,
    t.start_time,
    t.end_time,
    t.duration_ms,
    ROUND((t.duration_ms::NUMERIC / (1000 * 60 * 60)), 2) as duration_hours,
    t.hourly_rate,
    t.firestore_project_id as project,
    t.project_id,
    p.name as project_name,
    t.billable,
    CASE
      WHEN p.id IS NULL THEN false
      WHEN p.owner_name = p_user_name THEN true
      ELSE false
    END as is_project_owner,
    CASE
      WHEN p.id IS NULL THEN false
      WHEN p.is_shared = true AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_name = p_user_name
      ) THEN true
      ELSE false
    END as is_project_member,
    t.created_at,
    t.modified_at,
    t.creation_method,
    t.is_running,
    CASE
      WHEN ta_agg.activities IS NOT NULL AND jsonb_array_length(ta_agg.activities) > 0 THEN true
      ELSE COALESCE(t.has_activities, false)
    END as has_activities,
    t.current_activity_id,
    COALESCE(ta_agg.activities, '[]'::jsonb) as activities,
    t.break_deduction_ms
  FROM time_entries t
  LEFT JOIN projects p ON t.project_id = p.id
  LEFT JOIN users u ON t.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ta.id,
        'time_entry_id', ta.time_entry_id,
        'activity_type', ta.activity_type,
        'hourly_rate', ta.hourly_rate,
        'start_time', ta.start_time,
        'end_time', ta.end_time,
        'duration_ms', ta.duration_ms,
        'billable', ta.billable,
        'display_order', ta.display_order,
        'user_id', ta.user_id,
        'created_at', ta.created_at,
        'modified_at', ta.modified_at
      ) ORDER BY ta.display_order ASC, ta.start_time ASC
    ) as activities
    FROM timer_activities ta
    WHERE ta.time_entry_id = t.id
  ) ta_agg ON true
  WHERE t.start_time >= v_day_start
    AND t.start_time < v_day_end
    AND (
      t.user_name = p_user_name
      OR
      t.project_id IN (SELECT visible_project_id FROM visible_shared_projects)
    )
  ORDER BY t.start_time ASC;
END;
$$;

COMMENT ON FUNCTION get_day_entries_v5 IS
'Fetches time entries for a specific day for a user (v5).
Same as v4 plus break_deduction_ms for break deduction feature.
get_day_entries_v4 remains available for backward compatibility.';

-- Extend get_project_detail_v5 → v6 with total break time
CREATE OR REPLACE FUNCTION get_project_detail_v6(
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
        CASE
          WHEN t.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * t.hourly_rate
          WHEN pm2.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pm2.hourly_rate
          WHEN pi.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pi.hourly_rate
          ELSE 0
        END
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
        CASE
          WHEN t.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * t.hourly_rate
          WHEN pm3.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pm3.hourly_rate
          WHEN pi.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pi.hourly_rate
          ELSE 0
        END
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

COMMENT ON FUNCTION get_project_detail_v6 IS
'Project detail v6: adds total_break_ms (SUM of break_deduction_ms on time entries).';
