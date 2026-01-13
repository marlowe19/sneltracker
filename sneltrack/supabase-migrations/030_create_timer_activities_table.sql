-- Migration 030: Create timer_activities table
-- Stores activities within a timer session
-- Each activity has start/end time and hourly rate
-- Allows splitting a timer into multiple activities

CREATE TABLE timer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL, -- naam van activiteit (Work, Lunch, etc.)
  hourly_rate NUMERIC(10,2), -- kan verschillen per activity
  start_time TIMESTAMPTZ NOT NULL, -- start tijd van deze activity
  end_time TIMESTAMPTZ, -- end tijd (NULL als nog actief)
  duration_ms BIGINT, -- berekend: end_time - start_time (of NULL als nog actief)
  billable BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0, -- volgorde binnen timer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timer_activities_time_entry_id ON timer_activities(time_entry_id);
CREATE INDEX idx_timer_activities_activity_type ON timer_activities(activity_type);
CREATE INDEX idx_timer_activities_active ON timer_activities(time_entry_id, end_time) WHERE end_time IS NULL;

-- Add comments
COMMENT ON TABLE timer_activities IS 'Activities within a timer session, allowing timer splitting';
COMMENT ON COLUMN timer_activities.activity_type IS 'Name of the activity (e.g., Work, Lunch, Meeting, Travel)';
COMMENT ON COLUMN timer_activities.hourly_rate IS 'Hourly rate for this specific activity';
COMMENT ON COLUMN timer_activities.end_time IS 'End time of activity (NULL if currently active)';


