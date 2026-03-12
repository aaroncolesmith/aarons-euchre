-- Migration to support P1-3: Split Snapshot Storage From Event Stream
-- Refactored to be additive for existing play_events tables

-- 1. Ensure play_events table has the required columns for action streaming
DO $$ 
BEGIN
    -- Create the table if it absolutely doesn't exist
    CREATE TABLE IF NOT EXISTS play_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_code TEXT NOT NULL REFERENCES games(code) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Add missing columns additive-ly
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='state_version') THEN
        ALTER TABLE play_events ADD COLUMN state_version INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='hand_number') THEN
        ALTER TABLE play_events ADD COLUMN hand_number INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='trick_number') THEN
        ALTER TABLE play_events ADD COLUMN trick_number INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='action_type') THEN
        ALTER TABLE play_events ADD COLUMN action_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='action_payload') THEN
        ALTER TABLE play_events ADD COLUMN action_payload JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='actor_name') THEN
        ALTER TABLE play_events ADD COLUMN actor_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_events' AND column_name='actor_seat') THEN
        ALTER TABLE play_events ADD COLUMN actor_seat INTEGER;
    END IF;
END $$;

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

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'games_auth' 
        AND policyname = 'Service role only'
    ) THEN
        CREATE POLICY "Service role only" ON games_auth TO service_role USING (true);
    END IF;
END $$;
