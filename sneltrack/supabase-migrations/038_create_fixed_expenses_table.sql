-- Create fixed_expenses table for user recurring/fixed expenses
-- Stores expenses like rent (per month), road tax (per quarter), etc.

-- Ensure update_modified_at_column exists (used by expenses, stored_reports)
CREATE OR REPLACE FUNCTION update_modified_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('month', 'quarter', 'year')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_name ON public.fixed_expenses(user_name);

CREATE TRIGGER update_fixed_expenses_modified_at
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();

-- Geen RLS: app gebruikt Auth0 + service role server-side; autorisatie in API/ service layer
ALTER TABLE public.fixed_expenses DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_expenses TO authenticated;

COMMENT ON TABLE public.fixed_expenses IS 'User recurring fixed expenses (rent, road tax, etc.) with period (month/quarter/year)';
