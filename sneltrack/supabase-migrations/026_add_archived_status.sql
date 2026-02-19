-- Migration 026: Add 'archived' as a valid status value for projects
-- Updates documentation to include 'archived' as a valid project status

-- Update the comment on the status column to include 'archived'
COMMENT ON COLUMN projects.status IS 'Project status: planned, active, on_hold, completed, cancelled, archived';



