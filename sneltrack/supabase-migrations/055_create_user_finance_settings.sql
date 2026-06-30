-- User finance settings: forecast rates, tax reserve, toggles

CREATE TABLE IF NOT EXISTS public.user_finance_settings (
  user_name VARCHAR(255) PRIMARY KEY,
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

ALTER TABLE public.user_finance_settings DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_finance_settings TO authenticated;

COMMENT ON TABLE public.user_finance_settings IS
  'User finance forecast settings and toggles for onkosten dashboard';
