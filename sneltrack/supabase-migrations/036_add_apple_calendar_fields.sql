-- Migration 036: Add Apple Calendar credential storage to users table
-- Adds fields for storing Apple Calendar CalDAV credentials
-- Note: Assumes users table already exists

-- Add Apple Calendar credential fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS apple_calendar_username TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS apple_calendar_password TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS apple_calendar_connected_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN users.apple_calendar_username IS 'Apple ID email for CalDAV authentication';
COMMENT ON COLUMN users.apple_calendar_password IS 'App-specific password for CalDAV authentication (should be encrypted at application level)';
COMMENT ON COLUMN users.apple_calendar_connected_at IS 'Timestamp when Apple Calendar was connected';


