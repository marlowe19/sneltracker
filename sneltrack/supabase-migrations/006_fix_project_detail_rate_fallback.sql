-- Fix get_project_detail function to properly handle hourly rate fallback
-- Priority: entry rate → member rate → project rate
-- Also fixes CTE naming conflicts and adds totalMoney field

DROP FUNCTION IF EXISTS get_project_detail(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_project_detail(
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
          -- Priority 1: Use rate from time entry itself (historical accuracy)
          WHEN t.hourly_rate IS NOT NULL 
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * t.hourly_rate 
          -- Priority 2: Use member rate from project_members table
          WHEN pm2.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pm2.hourly_rate
          -- Priority 3: Use project default rate
          WHEN pi.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pi.hourly_rate
          ELSE 0 
        END
      )::NUMERIC(10,2) as total_billable
    FROM time_entries t
    CROSS JOIN project_info pi
    LEFT JOIN project_members pm2 ON pm2.project_id = t.project_id AND pm2.user_name = t.user_name
    WHERE t.project_id = p_project_id
      AND (p_start_date IS NULL OR t.start_time >= p_start_date)
      AND (p_end_date IS NULL OR t.start_time < p_end_date)
  ),
  project_members AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'user_name', pm.user_name,
          'role', pm.role,
          'hourly_rate', pm.hourly_rate,
          'added_at', pm.added_at
        )
        ORDER BY pm.added_at
      ) as members
    FROM project_members pm
    WHERE pm.project_id = p_project_id
  ),
  member_totals AS (
    SELECT 
      t.user_name,
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
    LEFT JOIN project_members pm3 ON pm3.project_id = t.project_id AND pm3.user_name = t.user_name
    WHERE 
      t.project_id = p_project_id
      AND (p_start_date IS NULL OR t.start_time >= p_start_date)
      AND (p_end_date IS NULL OR t.start_time < p_end_date)
      AND pi.is_shared = true
      AND pi.is_owner = true
    GROUP BY t.user_name
  ),
  member_stats AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'user_name', mt.user_name,
          'totalHours', mt.total_hours,
          'entryCount', mt.entry_count,
          'billableAmount', mt.billable_amount,
          'totalMoney', mt.billable_amount
        )
        ORDER BY mt.total_duration_ms DESC
      ) as member_statistics
    FROM member_totals mt
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
    pm.members,
    ms.member_statistics
  FROM project_info pi
  LEFT JOIN project_stats ps ON true
  LEFT JOIN project_members pm ON true
  LEFT JOIN member_stats ms ON true;
END;
$$;



