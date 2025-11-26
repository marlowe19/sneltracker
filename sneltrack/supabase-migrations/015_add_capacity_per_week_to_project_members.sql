-- Migration 015: Add capacity_per_week to project_members table
-- Adds field for tracking member weekly capacity for project forecasting

-- Add capacity_per_week column
ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS capacity_per_week NUMERIC(5,2);

-- Add comment
COMMENT ON COLUMN project_members.capacity_per_week IS 'Weekly capacity in hours for this member (used for project forecasting)';



