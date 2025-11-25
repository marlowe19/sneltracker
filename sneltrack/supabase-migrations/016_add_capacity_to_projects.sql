-- Migration 016: Add capacity_per_week to projects table
-- Adds field for tracking project capacity for forecasting

-- Add capacity_per_week column
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS capacity_per_week NUMERIC(5,2);

-- Add comment
COMMENT ON COLUMN projects.capacity_per_week IS 'Weekly capacity in hours for this project (used for forecasting when no member capacity is set)';

