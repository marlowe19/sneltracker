-- Migration 022: Create get_project_detail_v3 with user_display_name in member_statistics
-- Adds user_display_name to member_statistics for better display in "Verdeling per gebruiker"
-- Includes index on time_entries.user_id for optimized GROUP BY performance
-- v2 remains available for backward compatibility

-- Add index on time_entries.user_id for optimized GROUP BY queries
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id 
  ON time_entries(user_id)
  WHERE user_id IS NOT NULL; -- Partial index since user_id can be NULL

COMMENT ON INDEX idx_time_entries_user_id IS 
'Optimizes GROUP BY queries on user_id in get_project_detail_v3 and similar functions. Partial index excludes NULL values.';

CREATE OR REPLACE FUNCTION get_project_detail_v3(
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
          WHEN t.hourly_rate IS NOT NULL 
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * t.hourly_rate 
          WHEN pm2.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pm2.hourly_rate
          WHEN pi.hourly_rate IS NOT NULL
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * pi.hourly_rate
          ELSE 0 
        END
      )::NUMERIC(10,2) as total_billable
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
          'role', pm.role,
          'hourly_rate', pm.hourly_rate,
          'capacity_per_week', pm.capacity_per_week,
          'added_at', pm.added_at
        )
        ORDER BY pm.added_at
      ) as members
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
  ),
  member_totals AS (
    SELECT 
      t.user_name,
      t.user_id, -- ✅ Include user_id for optimized join
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
      AND pi.is_owner = true
    GROUP BY t.user_name, t.user_id -- ✅ Uses idx_time_entries_user_id for optimal GROUP BY
  ),
  member_stats AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'user_name', mt.user_name,
          'user_display_name', COALESCE(u.name, mt.user_name), -- ✅ Add user display name
          'totalHours', mt.total_hours,
          'entryCount', mt.entry_count,
          'billableAmount', mt.billable_amount,
          'totalMoney', mt.billable_amount
        )
        ORDER BY mt.total_duration_ms DESC
      ) as member_statistics
    FROM member_totals mt
    LEFT JOIN users u ON u.id = mt.user_id -- ✅ Optimized: Join on UUID primary key (users.id)
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

COMMENT ON FUNCTION get_project_detail_v3 IS 
'Get detailed project information including statistics and members (v3).
Includes user_display_name in member_statistics for better display in "Verdeling per gebruiker".
Uses optimized UUID join on user_id for better performance.

Performance optimizations:
- Uses UUID join (users.id = time_entries.user_id) instead of string join
- Join happens on already aggregated data (small result set)
- Uses idx_time_entries_user_id index for efficient GROUP BY
- Falls back to user_name if user_id is NULL

Version 3 changes:
- Includes user_display_name from users table in member_statistics
- Uses optimized UUID join on user_id for better performance

Safe deployment: v2 remains available for backward compatibility.';



