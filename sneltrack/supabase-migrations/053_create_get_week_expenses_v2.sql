-- Migration 053: Create get_week_expenses_v2 (optional — app uses expensesService.fetchVisibleExpenses instead)
-- Members with role 'owner' in project_members see all team expenses for visible
-- shared projects in the week range, matching get_week_entries_v2 visibility.

DROP FUNCTION IF EXISTS get_week_expenses_v2(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_week_expenses_v2(
  p_user_name TEXT,
  p_week_start TIMESTAMPTZ,
  p_week_end TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  user_name VARCHAR(255),
  user_display_name VARCHAR(255),
  firestore_project_id TEXT,
  project_id UUID,
  project_name VARCHAR(255),
  name TEXT,
  price NUMERIC(10,2),
  includes_vat BOOLEAN,
  expense_type VARCHAR(50),
  date DATE,
  billing_status VARCHAR(50),
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
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
    e.id,
    e.user_name::VARCHAR(255),
    u.name::VARCHAR(255) as user_display_name,
    e.firestore_project_id::TEXT,
    e.project_id,
    p.name::VARCHAR(255) as project_name,
    e.name::TEXT,
    e.price,
    e.includes_vat,
    e.expense_type::VARCHAR(50),
    e.date::DATE,
    e.billing_status::VARCHAR(50),
    e.created_at::TIMESTAMPTZ,
    e.modified_at::TIMESTAMPTZ
  FROM expenses e
  LEFT JOIN projects p ON e.project_id = p.id
  LEFT JOIN users u ON e.user_id = u.id
  WHERE e.date >= p_week_start::TIMESTAMP
    AND e.date < p_week_end::TIMESTAMP
    AND (
      e.user_name = p_user_name
      OR e.project_id IN (SELECT visible_project_id FROM visible_shared_projects)
    )
  ORDER BY e.date ASC, e.created_at ASC;
END;
$$;

COMMENT ON FUNCTION get_week_expenses_v2 IS
'Fetches expenses overlapping a week range (v2). Returns the user''s own expenses plus all
expenses on shared projects where the user is the creator or has role ''owner'' in project_members.';
