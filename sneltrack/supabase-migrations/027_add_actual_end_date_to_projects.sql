-- Migration 027: Add actual_end_date field to projects table
-- Allows tracking the actual end date when a project is archived

-- Add actual_end_date column
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS actual_end_date DATE;

-- Add index for querying by actual end date
CREATE INDEX IF NOT EXISTS idx_projects_actual_end_date ON projects(actual_end_date);

-- Update column comment
COMMENT ON COLUMN projects.actual_end_date IS 'Actual end date when the project was completed/archived';

