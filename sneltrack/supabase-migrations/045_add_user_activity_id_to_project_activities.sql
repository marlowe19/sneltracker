-- Migration 045: Add user_activity_id FK to project_activities
-- Links a project-level activity back to the global user_activities entry
-- Enables price overrides: when a timer is started with a project + user activity,
-- the project-specific hourly_rate takes precedence over the global one.

ALTER TABLE public.project_activities
  ADD COLUMN IF NOT EXISTS user_activity_id UUID
    REFERENCES public.user_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_activities_user_activity_id
  ON public.project_activities(user_activity_id);

COMMENT ON COLUMN public.project_activities.user_activity_id IS
  'Optional link to a global user_activity. When set, this row acts as a project-specific price override for that activity.';
