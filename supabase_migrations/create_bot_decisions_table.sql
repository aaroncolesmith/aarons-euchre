-- Create bot_decisions table for tracking AI heuristics and results
CREATE TABLE IF NOT EXISTS public.bot_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_code TEXT NOT NULL,
    player_name TEXT NOT NULL,
    archetype TEXT,
    decision_type TEXT NOT NULL, -- 'bid', 'play', 'discard', 'pass'
    decision TEXT NOT NULL,
    reasoning TEXT,
    hand_strength FLOAT,
    current_score_us INTEGER,
    current_score_them INTEGER,
    game_phase TEXT,
    hand_state JSONB, -- The hand when decision was made
    table_state JSONB, -- The table state when decision was made
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Heuristic modifiers
    aggressiveness INTEGER,
    risk_tolerance INTEGER,
    consistency INTEGER
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_bot_decisions_game_code ON bot_decisions(game_code);
CREATE INDEX IF NOT EXISTS idx_bot_decisions_player_name ON bot_decisions(player_name);
