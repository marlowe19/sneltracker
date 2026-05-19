-- Migration 046: Per-member hourly rates per project activity (shared projects)
-- One row = explicit override for that member on that activity; no row = use project_activities.hourly_rate

CREATE TABLE IF NOT EXISTS public.project_member_activity_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_activity_id UUID NOT NULL REFERENCES public.project_activities(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_activity_id, user_name)
);

CREATE INDEX IF NOT EXISTS idx_pmar_project_activity_id
  ON public.project_member_activity_rates(project_activity_id);

CREATE INDEX IF NOT EXISTS idx_pmar_user_name
  ON public.project_member_activity_rates(user_name);

ALTER TABLE public.project_member_activity_rates DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_member_activity_rates TO authenticated;

COMMENT ON TABLE public.project_member_activity_rates IS
  'Optional per-member hourly rate for a project activity; overrides project_activities.hourly_rate when set';
COMMENT ON COLUMN public.project_member_activity_rates.user_name IS
  'Auth0 subject / users.user_name, same as project_members.user_name';

CREATE TRIGGER update_project_member_activity_rates_modified_at
  BEFORE UPDATE ON public.project_member_activity_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();
