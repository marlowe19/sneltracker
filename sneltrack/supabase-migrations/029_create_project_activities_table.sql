-- Migration 029: Create project_activities table
-- Allows projects to have custom activities with names and hourly rates
-- Activities are project-specific and can be used for timer activity switching

CREATE TABLE project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  hourly_rate NUMERIC(10,2),
  icon VARCHAR(50), -- voor UI (briefcase, fork-knife, etc.)
  color_hex CHAR(7), -- voor UI styling
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX idx_project_activities_project_id ON project_activities(project_id);

-- Add comments
COMMENT ON TABLE project_activities IS 'Project-specific activities that can be used for timer activity switching';
COMMENT ON COLUMN project_activities.name IS 'Name of the activity (e.g., Work, Lunch, Meeting, Travel)';
COMMENT ON COLUMN project_activities.hourly_rate IS 'Hourly rate for this activity (can differ from project hourly rate)';
COMMENT ON COLUMN project_activities.display_order IS 'Order in which activities should be displayed in UI';


