-- Migration to support P1-3: Split Snapshot Storage From Event Stream

-- 1. Ensure play_events table is optimized for action streaming
CREATE TABLE IF NOT EXISTS play_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_code TEXT NOT NULL REFERENCES games(code) ON DELETE CASCADE,
    state_version INTEGER NOT NULL,
    hand_number INTEGER DEFAULT 0,
    trick_number INTEGER DEFAULT 0,
    action_type TEXT NOT NULL,
    action_payload JSONB NOT NULL,
    actor_name TEXT,
    actor_seat INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast reconstruction and replay
CREATE INDEX IF NOT EXISTS idx_play_events_game_code_version ON play_events(game_code, state_version);

-- 2. Create a secure storage for full authoritative state (not broadcast)
CREATE TABLE IF NOT EXISTS games_auth (
    game_code TEXT PRIMARY KEY REFERENCES games(code) ON DELETE CASCADE,
    full_state JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on games_auth to ensure only service role can read it
ALTER TABLE games_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON games_auth TO service_role USING (true);
