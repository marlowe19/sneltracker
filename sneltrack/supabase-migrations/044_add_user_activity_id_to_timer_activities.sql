-- Migration 044: Add user_activity_id to timer_activities
-- Links timer activities to user_activities when started without a project

ALTER TABLE timer_activities
ADD COLUMN IF NOT EXISTS user_activity_id UUID
  REFERENCES user_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timer_activities_user_activity_id
  ON timer_activities(user_activity_id);

COMMENT ON COLUMN timer_activities.user_activity_id IS 'References user_activities when timer was started on a user activity (no project)';
