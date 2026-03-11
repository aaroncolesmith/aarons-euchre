-- ============================================================================
-- Active Games Table - Store live game state in Supabase for remote management
-- ============================================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.active_games CASCADE;

-- Create active_games table
CREATE TABLE public.active_games (
    table_code TEXT PRIMARY KEY,
    game_state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    phase TEXT,
    current_player_index INTEGER,
    is_frozen BOOLEAN DEFAULT false,
    freeze_detected_at TIMESTAMPTZ,
    creator_name TEXT,
    player_names TEXT[]
);

-- Create indexes for common queries
CREATE INDEX idx_active_games_updated ON public.active_games(updated_at DESC);
CREATE INDEX idx_active_games_phase ON public.active_games(phase);
CREATE INDEX idx_active_games_frozen ON public.active_games(is_frozen) WHERE is_frozen = true;
CREATE INDEX idx_active_games_creator ON public.active_games(creator_name);

-- Enable Row Level Security
ALTER TABLE public.active_games ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active games
DROP POLICY IF EXISTS "Anyone can read active games" ON public.active_games;
CREATE POLICY "Anyone can read active games"
    ON public.active_games
    FOR SELECT
    USING (true);

-- Policy: Anyone can insert active games
DROP POLICY IF EXISTS "Anyone can insert active games" ON public.active_games;
CREATE POLICY "Anyone can insert active games"
    ON public.active_games
    FOR INSERT
    WITH CHECK (true);

-- Policy: Anyone can update active games
DROP POLICY IF EXISTS "Anyone can update active games" ON public.active_games;
CREATE POLICY "Anyone can update active games"
    ON public.active_games
    FOR UPDATE
    USING (true);

-- Policy: Anyone can delete active games
DROP POLICY IF EXISTS "Anyone can delete active games" ON public.active_games;
CREATE POLICY "Anyone can delete active games"
    ON public.active_games
    FOR DELETE
    USING (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_active_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_active_games_timestamp ON public.active_games;
CREATE TRIGGER update_active_games_timestamp
    BEFORE UPDATE ON public.active_games
    FOR EACH ROW
    EXECUTE FUNCTION update_active_games_updated_at();

-- Grant permissions
GRANT ALL ON public.active_games TO anon;
GRANT ALL ON public.active_games TO authenticated;

-- ============================================================================
-- Admin Helper Functions
-- ============================================================================

-- Function to mark frozen games
CREATE OR REPLACE FUNCTION mark_frozen_games()
RETURNS TABLE(table_code TEXT, hours_stale NUMERIC) AS $$
BEGIN
    -- Mark games as frozen if no update in 10 minutes
    UPDATE public.active_games
    SET 
        is_frozen = true,
        freeze_detected_at = COALESCE(freeze_detected_at, NOW())
    WHERE 
        updated_at < NOW() - INTERVAL '10 minutes'
        AND is_frozen = false
    RETURNING 
        active_games.table_code,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_stale;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-cleanup old games
CREATE OR REPLACE FUNCTION cleanup_old_active_games()
RETURNS TABLE(deleted_code TEXT, age_hours NUMERIC) AS $$
BEGIN
    RETURN QUERY
    DELETE FROM public.active_games
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    RETURNING 
        table_code,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/3600;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Automatic Cleanup (Run daily at 4 AM)
-- ============================================================================

-- Enable pg_cron extension if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup (uncomment after enabling pg_cron)
-- SELECT cron.schedule(
--     'cleanup-old-euchre-games',
--     '0 4 * * *',  -- 4 AM daily
--     $$
--     SELECT cleanup_old_active_games();
--     $$
-- );

-- ============================================================================
-- Useful Admin Queries
-- ============================================================================

-- See all active games with status
-- SELECT 
--     table_code,
--     phase,
--     creator_name,
--     player_names,
--     is_frozen,
--     EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_since_update,
--     created_at,
--     updated_at
-- FROM active_games
-- ORDER BY updated_at DESC;

-- Find frozen games
-- SELECT * FROM active_games WHERE is_frozen = true;

-- Mark stale games as frozen
-- SELECT * FROM mark_frozen_games();

-- Force delete a specific game
-- DELETE FROM active_games WHERE table_code = '321-943';

-- Cleanup all games older than 24 hours
-- SELECT * FROM cleanup_old_active_games();
