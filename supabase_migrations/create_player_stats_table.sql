-- Player Stats Table for Global Leaderboard
-- This table tracks cumulative statistics for all players (humans and bots)

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS public.player_stats;

-- Create player_stats table
CREATE TABLE public.player_stats (
    player_name TEXT PRIMARY KEY,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    hands_played INTEGER NOT NULL DEFAULT 0,
    hands_won INTEGER NOT NULL DEFAULT 0,
    tricks_played INTEGER NOT NULL DEFAULT 0,
    tricks_taken INTEGER NOT NULL DEFAULT 0,
    tricks_won_team INTEGER NOT NULL DEFAULT 0,
    calls_made INTEGER NOT NULL DEFAULT 0,
    calls_won INTEGER NOT NULL DEFAULT 0,
    loners_attempted INTEGER NOT NULL DEFAULT 0,
    loners_converted INTEGER NOT NULL DEFAULT 0,
    euchres_made INTEGER NOT NULL DEFAULT 0,
    euchred INTEGER NOT NULL DEFAULT 0,
    sweeps INTEGER NOT NULL DEFAULT 0,
    swept INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on updated_at for sorting
CREATE INDEX idx_player_stats_updated ON public.player_stats(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read stats (public leaderboard)
DROP POLICY IF EXISTS "Anyone can read player stats" ON public.player_stats;
CREATE POLICY "Anyone can read player stats"
    ON public.player_stats
    FOR SELECT
    USING (true);

-- Policy: Anyone can insert new player stats
DROP POLICY IF EXISTS "Anyone can insert player stats" ON public.player_stats;
CREATE POLICY "Anyone can insert player stats"
    ON public.player_stats
    FOR INSERT
    WITH CHECK (true);

-- Policy: Anyone can update player stats
DROP POLICY IF EXISTS "Anyone can update player stats" ON public.player_stats;
CREATE POLICY "Anyone can update player stats"
    ON public.player_stats
    FOR UPDATE
    USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_player_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS update_player_stats_timestamp ON public.player_stats;
CREATE TRIGGER update_player_stats_timestamp
    BEFORE UPDATE ON public.player_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_updated_at();

-- Grant permissions
GRANT ALL ON public.player_stats TO anon;
GRANT ALL ON public.player_stats TO authenticated;

--------------------------------------------------------------------------------
-- Trump Calls Table for Global Trump Call History
--------------------------------------------------------------------------------

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS public.trump_calls;

-- Create trump_calls table
CREATE TABLE public.trump_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    seat_index INTEGER NOT NULL,
    suit TEXT NOT NULL,
    is_loner BOOLEAN NOT NULL DEFAULT false,
    picked_up BOOLEAN NOT NULL DEFAULT false,
    round INTEGER NOT NULL,
    top_card TEXT,
    top_card_suit TEXT,
    top_card_rank TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_trump_calls_game_id ON public.trump_calls(game_id);
CREATE INDEX idx_trump_calls_player ON public.trump_calls(player_name);
CREATE INDEX idx_trump_calls_created ON public.trump_calls(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.trump_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read trump calls
DROP POLICY IF EXISTS "Anyone can read trump calls" ON public.trump_calls;
CREATE POLICY "Anyone can read trump calls"
    ON public.trump_calls
    FOR SELECT
    USING (true);

-- Policy: Anyone can insert trump calls
DROP POLICY IF EXISTS "Anyone can insert trump calls" ON public.trump_calls;
CREATE POLICY "Anyone can insert trump calls"
    ON public.trump_calls
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.trump_calls TO anon;
GRANT ALL ON public.trump_calls TO authenticated;
