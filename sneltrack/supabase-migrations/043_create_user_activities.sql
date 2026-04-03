-- Migration 043: Create user_activities table
-- User-level activities (Activiteiten) that can be started without a project
-- Users manage activities in Profile > Activiteiten modal

CREATE TABLE IF NOT EXISTS public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  hourly_rate NUMERIC(10,2),
  icon VARCHAR(50),
  color_hex CHAR(7),
  display_order INTEGER DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);

CREATE TRIGGER update_user_activities_modified_at
  BEFORE UPDATE ON public.user_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();
CREATE INDEX IF NOT EXISTS idx_user_activities_archived ON public.user_activities(user_id, archived);

-- Geen RLS: app gebruikt Auth0 + service role server-side; autorisatie in API/service layer
ALTER TABLE public.user_activities DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_activities TO authenticated;

COMMENT ON TABLE public.user_activities IS 'User-level activities (Activiteiten) that can be started without a project';
COMMENT ON COLUMN public.user_activities.name IS 'Name of the activity (e.g., Work, Lunch, Meeting, Travel)';
COMMENT ON COLUMN public.user_activities.hourly_rate IS 'Hourly rate for this activity';
COMMENT ON COLUMN public.user_activities.archived IS 'Soft-delete: hidden from start dropdown, still visible in history';
