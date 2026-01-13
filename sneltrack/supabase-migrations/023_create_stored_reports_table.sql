-- Migration 023: Create stored_reports table
-- Allows users to save snapshots of filtered report data as JSON blobs

CREATE TABLE IF NOT EXISTS public.stored_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stored_reports_user_name ON public.stored_reports(user_name);
CREATE INDEX IF NOT EXISTS idx_stored_reports_created_at ON public.stored_reports(created_at DESC);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_stored_reports_modified_at
  BEFORE UPDATE ON public.stored_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.stored_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own stored reports
CREATE POLICY "Users can view their own stored reports"
  ON public.stored_reports
  FOR SELECT
  TO authenticated
  USING (user_name = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own stored reports"
  ON public.stored_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (user_name = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own stored reports"
  ON public.stored_reports
  FOR UPDATE
  TO authenticated
  USING (user_name = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_name = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own stored reports"
  ON public.stored_reports
  FOR DELETE
  TO authenticated
  USING (user_name = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policy: Allow all operations for anon users (POC/migration phase)
-- TODO: Tighten these policies for production
CREATE POLICY "Anon users can manage stored reports"
  ON public.stored_reports
  TO anon
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stored_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stored_reports TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.stored_reports IS 'Stores user-created report snapshots with projects, totals, and filter parameters';
COMMENT ON COLUMN public.stored_reports.report_data IS 'JSONB blob containing projects array, totals object, and filters object';


