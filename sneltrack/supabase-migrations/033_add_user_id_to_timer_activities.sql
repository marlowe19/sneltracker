-- Migration 033: Add user_id to timer_activities table
-- Tracks which user created each activity for auditing and filtering
-- Enables optimized joins with users table using UUID instead of string comparison

-- Add user_id column to timer_activities table (references users.id UUID)
ALTER TABLE timer_activities 
ADD COLUMN IF NOT EXISTS user_id UUID 
  REFERENCES users(id) ON DELETE SET NULL;

-- Populate existing rows with user_id from parent time_entry
UPDATE timer_activities ta
SET user_id = te.user_id
FROM time_entries te
WHERE ta.time_entry_id = te.id
  AND ta.user_id IS NULL;

-- Create index for optimized queries
CREATE INDEX IF NOT EXISTS idx_timer_activities_user_id 
  ON timer_activities(user_id);

-- Add comment
COMMENT ON COLUMN timer_activities.user_id IS 
'User ID (UUID) of the user who created this activity. References users.id for optimized joins. Populated from parent time_entry for existing records.';

