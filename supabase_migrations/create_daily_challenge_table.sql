-- ============================================================================
-- Hand of the Day Scores Table
-- ============================================================================

DROP TABLE IF EXISTS public.daily_challenge_scores CASCADE;

CREATE TABLE public.daily_challenge_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date_string TEXT NOT NULL, -- e.g. "2024-03-24"
    player_name TEXT NOT NULL,
    team_points INTEGER NOT NULL,
    team_tricks INTEGER NOT NULL,
    individual_tricks INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure exactly one entry per player per day
    UNIQUE(date_string, player_name)
);

-- Create Indexes
CREATE INDEX idx_daily_scores_date ON public.daily_challenge_scores(date_string);
CREATE INDEX idx_daily_scores_player ON public.daily_challenge_scores(player_name);

-- Enable RLS
ALTER TABLE public.daily_challenge_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read scores
CREATE POLICY "Anyone can read daily scores"
    ON public.daily_challenge_scores
    FOR SELECT
    USING (true);

-- Policy: Anyone can insert their own score
CREATE POLICY "Anyone can insert daily scores"
    ON public.daily_challenge_scores
    FOR INSERT
    WITH CHECK (true);

-- Permissions
GRANT ALL ON public.daily_challenge_scores TO anon;
GRANT ALL ON public.daily_challenge_scores TO authenticated;
