-- Migration 031: Add activity tracking fields to time_entries table
-- Marks entries that have activities and tracks current active activity

ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS has_activities BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS current_activity_id UUID REFERENCES timer_activities(id) ON DELETE SET NULL;

-- Add index for filtering entries with activities
CREATE INDEX IF NOT EXISTS idx_time_entries_has_activities ON time_entries(has_activities);

-- Add comments
COMMENT ON COLUMN time_entries.has_activities IS 'Indicates if this timer entry has been split into activities';
COMMENT ON COLUMN time_entries.current_activity_id IS 'Reference to the currently active activity (NULL if no activities or timer stopped)';


