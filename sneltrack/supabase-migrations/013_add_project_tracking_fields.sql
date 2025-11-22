-- Migration 013: Add project tracking fields to projects table
-- Adds fields for proper project lifecycle management and organization

-- ==========================================
-- CORE TRACKING (Your Original Request)
-- ==========================================

-- Due date for project deadlines
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Archive functionality
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ==========================================
-- STATUS & TYPE
-- ==========================================

-- Project status for lifecycle tracking
-- Values: 'planned', 'active', 'on_hold', 'completed', 'cancelled'
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';

-- Project type for billing model
-- Values: 'time_and_material', 'fixed_fee', 'internal', 'retainer'
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_type VARCHAR(32);

-- ==========================================
-- DATES & TIMELINE
-- ==========================================

-- Project start date
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Planned end date (different from due_date which is deadline)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Actual completion timestamp
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ==========================================
-- BUDGET ENHANCEMENTS
-- ==========================================

-- Budget amount (for fixed-fee projects)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2);

-- Currency code (ISO 4217: EUR, USD, etc.)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'EUR';

-- ==========================================
-- BILLABILITY
-- ==========================================

-- Billability model (more nuanced than boolean)
-- Values: 'billable', 'niet-declarabel', 'partially_billable'
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS billable_model VARCHAR(32);

-- Note: Keep existing billable logic in time_entries table
-- This field is for project-level billability settings

-- ==========================================
-- ORGANIZATION & IDENTIFICATION
-- ==========================================

-- Short project code/key (e.g., "ACME-WEB", "PROJ-001")
-- Unique per owner for easy reference
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS key VARCHAR(32);

-- Priority level (1-5 scale)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS priority SMALLINT 
  CHECK (priority IS NULL OR (priority >= 1 AND priority <= 5));

-- Color for UI organization (hex format: #FF9900)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS color_hex CHAR(7);

-- Project description/notes
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS description TEXT;

-- ==========================================
-- PROJECT MANAGEMENT
-- ==========================================

-- Project manager (references users.id UUID)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_manager_id UUID 
  REFERENCES users(id) ON DELETE SET NULL;

-- ==========================================
-- INTEGRATIONS
-- ==========================================

-- External reference (JIRA key, Asana ID, etc.)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS external_ref VARCHAR(255);

-- Flexible JSONB for custom project settings
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS settings_json JSONB;

-- ==========================================
-- AUDIT TRAIL ENHANCEMENTS
-- ==========================================

-- Track who created the project (references users.id UUID)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS created_by UUID 
  REFERENCES users(id) ON DELETE SET NULL;

-- Track who last updated the project (references users.id UUID)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS updated_by UUID 
  REFERENCES users(id) ON DELETE SET NULL;

-- Note: created_at and modified_at already exist in your table

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Single column indexes
CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager_id ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_updated_by ON projects(updated_by);

-- Composite indexes for common queries
-- Active projects by due date (for dashboard views)
CREATE INDEX IF NOT EXISTS idx_projects_active_due_date 
  ON projects(due_date) 
  WHERE archived = false AND status = 'active';

-- Archived projects sorted by archive date
CREATE INDEX IF NOT EXISTS idx_projects_archived_at 
  ON projects(archived_at DESC) 
  WHERE archived = true;

-- Projects by owner and status (for user project lists)
CREATE INDEX IF NOT EXISTS idx_projects_owner_status 
  ON projects(owner_id, status, archived);

-- Unique constraint: key per owner (if key is provided)
-- Note: This allows NULL keys, but enforces uniqueness when key is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_key_unique 
  ON projects(owner_id, key) 
  WHERE key IS NOT NULL;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON COLUMN projects.due_date IS 'Project deadline date';
COMMENT ON COLUMN projects.archived IS 'Whether the project is archived (soft delete)';
COMMENT ON COLUMN projects.archived_at IS 'Timestamp when project was archived';
COMMENT ON COLUMN projects.status IS 'Project status: planned, active, on_hold, completed, cancelled';
COMMENT ON COLUMN projects.project_type IS 'Project type: time_and_material, fixed_fee, internal, retainer';
COMMENT ON COLUMN projects.start_date IS 'Project start date';
COMMENT ON COLUMN projects.end_date IS 'Planned project end date';
COMMENT ON COLUMN projects.completed_at IS 'Timestamp when project was completed';
COMMENT ON COLUMN projects.budget_amount IS 'Budget amount for fixed-fee projects';
COMMENT ON COLUMN projects.currency IS 'Currency code (ISO 4217: EUR, USD, etc.)';
COMMENT ON COLUMN projects.billable_model IS 'Billability model: billable, niet-declarabel, partially_billable';
COMMENT ON COLUMN projects.key IS 'Short project code/key for easy reference (unique per owner)';
COMMENT ON COLUMN projects.priority IS 'Priority level (1-5 scale)';
COMMENT ON COLUMN projects.color_hex IS 'Color code for UI organization (hex format: #FF9900)';
COMMENT ON COLUMN projects.description IS 'Project description and notes';
COMMENT ON COLUMN projects.project_manager_id IS 'Project manager user ID (references users.id)';
COMMENT ON COLUMN projects.external_ref IS 'External reference (JIRA key, Asana ID, etc.)';
COMMENT ON COLUMN projects.settings_json IS 'Flexible JSONB for custom project settings';
COMMENT ON COLUMN projects.created_by IS 'User ID who created the project (references users.id)';
COMMENT ON COLUMN projects.updated_by IS 'User ID who last updated the project (references users.id)';

-- ==========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ==========================================

-- Trigger to automatically set archived_at when archived is set to true
CREATE OR REPLACE FUNCTION set_archived_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.archived = true AND (OLD.archived IS NULL OR OLD.archived = false) THEN
    NEW.archived_at = NOW();
  ELSIF NEW.archived = false THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_set_archived_at ON projects;
CREATE TRIGGER trigger_set_archived_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_archived_at();

DROP TRIGGER IF EXISTS trigger_set_completed_at ON projects;
CREATE TRIGGER trigger_set_completed_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

