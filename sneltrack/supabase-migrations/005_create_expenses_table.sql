-- Create expenses table for project expense tracking
-- This table stores material costs, labor costs, and other expenses associated with projects

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE, -- Track Firestore document ID for migration
  user_name VARCHAR(255) NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  firestore_project_id TEXT, -- Temporary field for migration, references Firestore project ID
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  includes_vat BOOLEAN DEFAULT false,
  expense_type VARCHAR(50), -- 'materials', 'labor', 'equipment', etc.
  date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenses_firestore_id ON public.expenses(firestore_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_name ON public.expenses(user_name);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type ON public.expenses(expense_type);

-- Create composite index for common query pattern (project expenses by date)
CREATE INDEX IF NOT EXISTS idx_expenses_project_date 
  ON public.expenses(project_id, date DESC);

-- Create trigger to automatically update modified_at
CREATE TRIGGER update_expenses_modified_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for anon users (POC/migration phase)
-- TODO: Tighten these policies for production
CREATE POLICY "Anon users can manage expenses"
  ON public.expenses
  TO anon
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.expenses IS 'Stores project-related expenses like materials, labor, and equipment costs';
COMMENT ON COLUMN public.expenses.firestore_id IS 'Firestore document ID for migration tracking - can be removed after full migration';
COMMENT ON COLUMN public.expenses.firestore_project_id IS 'Temporary Firestore project reference - can be removed after full migration';

