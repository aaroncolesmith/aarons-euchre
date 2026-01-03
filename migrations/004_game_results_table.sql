-- Migration 004: Add game_results table for stats rebuilding
-- This table logs immutable game completion data that can be used to rebuild stats

CREATE TABLE IF NOT EXISTS game_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_code TEXT NOT NULL,
    
    -- Players
    player_0_name TEXT,
    player_1_name TEXT,
    player_2_name TEXT,
    player_3_name TEXT,
    
    -- Final scores
    team1_score INTEGER NOT NULL,
    team2_score INTEGER NOT NULL,
    winner_team INTEGER NOT NULL, -- 1 or 2
    
    -- Game metadata
    hands_played INTEGER NOT NULL,
    total_tricks INTEGER NOT NULL,
    
    -- Per-player stats from this game
    player_0_stats JSONB, -- {handsPlayed, handsWon, tricksPlayed, tricksTaken, etc.}
    player_1_stats JSONB,
    player_2_stats JSONB,
    player_3_stats JSONB,
    
    -- Timestamps
    game_started_at TIMESTAMP,
    game_ended_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying by player
CREATE INDEX idx_game_results_player_0 ON game_results(player_0_name);
CREATE INDEX idx_game_results_player_1 ON game_results(player_1_name);
CREATE INDEX idx_game_results_player_2 ON game_results(player_2_name);
CREATE INDEX idx_game_results_player_3 ON game_results(player_3_name);

-- Index for date queries
CREATE INDEX idx_game_results_ended_at ON game_results(game_ended_at);

-- Example query to rebuild Aaron's stats:
COMMENT ON TABLE game_results IS 
'Immutable log of completed games. Use this to rebuild player_stats if needed.
Example rebuild query:
SELECT 
    player_name,
    COUNT(*) as games_played,
    SUM(CASE WHEN won THEN 1 ELSE 0 END) as games_won,
    SUM((stats->>''handsPlayed'')::int) as hands_played,
    SUM((stats->>''handsWon'')::int) as hands_won
FROM (
    SELECT player_0_name as player_name, team1_score > team2_score as won, player_0_stats as stats FROM game_results
    UNION ALL
    SELECT player_1_name, team2_score > team1_score, player_1_stats FROM game_results
    UNION ALL
    SELECT player_2_name, team1_score > team2_score, player_2_stats FROM game_results
    UNION ALL
    SELECT player_3_name, team2_score > team1_score, player_3_stats FROM game_results
) combined
WHERE player_name = ''Aaron''
GROUP BY player_name;';
