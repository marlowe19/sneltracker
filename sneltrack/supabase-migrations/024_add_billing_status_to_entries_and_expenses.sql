-- Migration 024: Add billing status to time_entries and expenses tables
-- Allows tracking billing workflow: draft -> pending -> billed -> paid

-- Add billing_status to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS billing_status VARCHAR(32) NOT NULL DEFAULT 'draft';

-- Add check constraint for valid status values
ALTER TABLE public.time_entries
ADD CONSTRAINT check_time_entries_billing_status 
CHECK (billing_status IN ('draft', 'pending', 'billed', 'paid'));

-- Create index for filtering by billing status
CREATE INDEX IF NOT EXISTS idx_time_entries_billing_status 
ON public.time_entries(billing_status);

-- Add billing_status to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS billing_status VARCHAR(32) NOT NULL DEFAULT 'draft';

-- Add check constraint for valid status values
ALTER TABLE public.expenses
ADD CONSTRAINT check_expenses_billing_status 
CHECK (billing_status IN ('draft', 'pending', 'billed', 'paid'));
    
-- Create index for filtering by billing status
CREATE INDEX IF NOT EXISTS idx_expenses_billing_status 
ON public.expenses(billing_status);

-- Add helpful comments
COMMENT ON COLUMN public.time_entries.billing_status IS 
'Billing workflow status: draft (default, not ready), pending (ready to bill), billed (included in invoice), paid (payment received)';

COMMENT ON COLUMN public.expenses.billing_status IS 
'Billing workflow status: draft (default, not ready), pending (ready to bill), billed (included in invoice), paid (payment received)';

