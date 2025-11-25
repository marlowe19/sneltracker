-- Migration 014: Add Google Calendar token storage to users table
-- Adds fields for storing Google Calendar OAuth tokens
-- Note: Assumes users table already exists

-- Add Google Calendar token fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_calendar_tokens JSONB;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_calendar_connected_at TIMESTAMPTZ;

-- Create index for user_name lookups (if user_name column exists)
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users(user_name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at (only if updated_at column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
    CREATE TRIGGER trigger_update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_users_updated_at();
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN users.google_calendar_tokens IS 'Google Calendar OAuth tokens (access_token, refresh_token, etc.) stored as JSONB';
COMMENT ON COLUMN users.google_calendar_connected_at IS 'Timestamp when Google Calendar was connected';

