-- Migration 040: Create user_xp_state table for streak and lifetime XP
-- Stores streak counters and lifetime XP for gamification

CREATE TABLE IF NOT EXISTS public.user_xp_state (
  user_name VARCHAR(255) PRIMARY KEY,
  current_daily_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  current_weekly_streak INT NOT NULL DEFAULT 0,
  last_active_week_start DATE,
  lifetime_xp NUMERIC(12, 0) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_state_updated_at ON public.user_xp_state(updated_at);

-- Geen RLS: app gebruikt Auth0 + service role server-side
ALTER TABLE public.user_xp_state DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_xp_state TO authenticated;

COMMENT ON TABLE public.user_xp_state IS 'User gamification state: streak counters and lifetime XP';
