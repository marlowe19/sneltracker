-- Migration 017: Add zip_code field to projects table
-- Adds field for Dutch postal code (for future distance calculation feature)

-- Add zip_code column
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(6);

-- Add check constraint for Dutch postal code format (4 digits + 2 uppercase letters)
ALTER TABLE projects
ADD CONSTRAINT IF NOT EXISTS check_zip_code_format 
CHECK (zip_code IS NULL OR zip_code ~ '^[0-9]{4}[A-Z]{2}$');

-- Add comment
COMMENT ON COLUMN projects.zip_code IS 'Dutch postal code (1234AB format) for distance calculation';

-- Note: priority field already exists from migration 013




