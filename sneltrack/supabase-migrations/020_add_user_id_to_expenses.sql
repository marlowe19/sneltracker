-- Migration 020: Add user_id field to expenses table
-- Adds user_id foreign key to expenses table, similar to time_entries table
-- This enables optimized joins with the users table using UUID instead of string comparison

-- Add user_id column to expenses table (references users.id UUID)
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS user_id UUID 
  REFERENCES public.users(id) ON DELETE SET NULL;

-- Populate existing rows with user_id based on user_name
-- This matches existing expenses to users in the users table
UPDATE public.expenses e
SET user_id = u.id
FROM public.users u
WHERE e.user_name = u.user_name
  AND e.user_id IS NULL;

-- Create index on user_id for optimized queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_id 
  ON public.expenses(user_id);

-- Add comment
COMMENT ON COLUMN public.expenses.user_id IS 
'User ID (UUID) referencing users.id. Enables optimized joins with users table. Populated from user_name for existing records.';
