-- Add private/business category to fixed_expenses for fiscal separation

ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'business'
    CHECK (category IN ('private', 'business'));

COMMENT ON COLUMN public.fixed_expenses.category IS
  'Expense category: private (personal) or business (deductible operational costs)';
