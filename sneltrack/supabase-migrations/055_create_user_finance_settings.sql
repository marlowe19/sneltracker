-- User finance settings: forecast rates, tax reserve, toggles
--
-- Production SnelTracker (zdiluzjpfkiexbeyutgl) users are keyed by
-- users.id (uuid) + users.user_name (Auth0 sub). This table stores both.
-- The Next.js API uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

CREATE TABLE IF NOT EXISTS public.user_finance_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  user_name VARCHAR(255) UNIQUE,
  forecast_hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 55,
  forecast_weekly_hours NUMERIC(6, 2) NOT NULL DEFAULT 40,
  tax_reserve_pct NUMERIC(5, 2) NOT NULL DEFAULT 35
    CHECK (tax_reserve_pct >= 0 AND tax_reserve_pct <= 100),
  include_team_earnings BOOLEAN NOT NULL DEFAULT false,
  include_project_expenses BOOLEAN NOT NULL DEFAULT false,
  expense_category_review_dismissed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_finance_settings_updated_at
  ON public.user_finance_settings(updated_at);

CREATE INDEX IF NOT EXISTS idx_user_finance_settings_user_name
  ON public.user_finance_settings(user_name);

ALTER TABLE public.user_finance_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_finance_settings FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_finance_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_finance_settings TO service_role;

COMMENT ON TABLE public.user_finance_settings IS
  'User finance forecast settings and toggles for onkosten dashboard';

NOTIFY pgrst, 'reload schema';
