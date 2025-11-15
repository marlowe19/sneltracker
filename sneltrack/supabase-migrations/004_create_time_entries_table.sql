-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS snel_customer_facing;

-- Create time_entries table in snel_customer_facing schema
CREATE TABLE IF NOT EXISTS snel_customer_facing.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE NOT NULL, -- Track Firestore document ID for migration
  user_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  hourly_rate NUMERIC,
  project TEXT, -- References Firestore project ID (will migrate later)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creation_method TEXT, -- 'timer' or 'manual'
  is_running BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes in snel_customer_facing schema
CREATE INDEX IF NOT EXISTS idx_time_entries_user_name ON snel_customer_facing.time_entries(user_name);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON snel_customer_facing.time_entries(start_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_firestore_id ON snel_customer_facing.time_entries(firestore_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON snel_customer_facing.time_entries(project);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_start ON snel_customer_facing.time_entries(user_name, start_time DESC);

-- Create function to update modified_at timestamp
-- Function can stay in public schema (or move to snel_customer_facing if preferred)
CREATE OR REPLACE FUNCTION update_modified_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update modified_at
CREATE TRIGGER update_time_entries_modified_at
  BEFORE UPDATE ON snel_customer_facing.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();

-- Enable Row Level Security
ALTER TABLE snel_customer_facing.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries table
-- Note: For authenticated users, we use service role key server-side (bypasses RLS)
-- These policies are permissive for POC/migration phase (security checks in app code)
CREATE POLICY "Anon users can manage time entries"
  ON snel_customer_facing.time_entries
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create a view in public schema for Supabase API access
-- This allows the table to be accessed via .from("time_entries") without schema qualification
CREATE OR REPLACE VIEW public.time_entries AS
SELECT 
  id,
  firestore_id,
  user_name,
  start_time,
  end_time,
  duration_ms,
  hourly_rate,
  project,
  created_at,
  modified_at,
  creation_method,
  is_running
FROM snel_customer_facing.time_entries;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;

-- Create triggers on the view to handle INSERT/UPDATE/DELETE operations
-- These triggers will forward operations to the underlying table
CREATE OR REPLACE FUNCTION public.handle_time_entries_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO snel_customer_facing.time_entries (
    id, firestore_id, user_name, start_time, end_time, duration_ms,
    hourly_rate, project, created_at, modified_at, creation_method, is_running
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.firestore_id,
    NEW.user_name,
    NEW.start_time,
    NEW.end_time,
    NEW.duration_ms,
    NEW.hourly_rate,
    NEW.project,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.modified_at, NOW()),
    NEW.creation_method,
    COALESCE(NEW.is_running, false)
  )
  RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_time_entries_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE snel_customer_facing.time_entries SET
    firestore_id = NEW.firestore_id,
    user_name = NEW.user_name,
    start_time = NEW.start_time,
    end_time = NEW.end_time,
    duration_ms = NEW.duration_ms,
    hourly_rate = NEW.hourly_rate,
    project = NEW.project,
    created_at = NEW.created_at,
    modified_at = NEW.modified_at,
    creation_method = NEW.creation_method,
    is_running = NEW.is_running
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_time_entries_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM snel_customer_facing.time_entries WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER time_entries_insert_trigger
  INSTEAD OF INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_time_entries_insert();

CREATE TRIGGER time_entries_update_trigger
  INSTEAD OF UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_time_entries_update();

CREATE TRIGGER time_entries_delete_trigger
  INSTEAD OF DELETE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_time_entries_delete();

