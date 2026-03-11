-- Migration 005: Raw Play-by-Play Event Log
-- Every action in every game gets logged - complete event sourcing
-- All stats can be derived from this raw data

CREATE TABLE IF NOT EXISTS play_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Game context
    game_code TEXT NOT NULL,
    hand_number INTEGER NOT NULL, -- Which hand of the game (1, 2, 3...)
    trick_number INTEGER, -- Which trick in this hand (1-5)
    
    -- Event metadata
    event_type TEXT NOT NULL, -- 'game_start', 'deal', 'bid', 'pass', 'trump_set', 'play_card', 'trick_won', 'hand_won', 'game_won'
    event_data JSONB NOT NULL, -- All event-specific data
    
    -- Player context
    player_name TEXT, -- Who performed this action
    player_seat INTEGER, -- 0-3
    
    -- Timestamp
    occurred_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_play_events_game ON play_events(game_code);
CREATE INDEX idx_play_events_player ON play_events(player_name);
CREATE INDEX idx_play_events_type ON play_events(event_type);
CREATE INDEX idx_play_events_occurred ON play_events(occurred_at);

-- Composite index for player timeline
CREATE INDEX idx_play_events_player_time ON play_events(player_name, occurred_at);

COMMENT ON TABLE play_events IS 
'Raw event log of every action in every game. Event sourcing table.

Event Types and Data Structures:
- game_start: {players: [...], dealer: 0}
- deal: {upcard: {...}, dealer: 0}
- bid: {suit: "hearts", isLoner: false}
- pass: {round: 1}
- trump_set: {suit: "spades", caller: "Aaron", isLoner: false}
- play_card: {card: {rank: "A", suit: "spades"}, leadSuit: "hearts"}
- trick_won: {winner: "Aaron", cards: [...]}
- hand_won: {winner_team: 1, team1_score: 5, team2_score: 3, points: 1}
- game_won: {winner_team: 1, final_score: {team1: 10, team2: 7}}

Examples:
-- All cards Aaron played
SELECT event_data->''card'' FROM play_events 
WHERE player_name = ''Aaron'' AND event_type = ''play_card'';

-- All tricks someone won
SELECT * FROM play_events 
WHERE player_name = ''Aaron'' AND event_type = ''trick_won'';

-- Rebuild stats for Aaron
SELECT 
    COUNT(DISTINCT game_code) as games_played,
    COUNT(*) FILTER (WHERE event_type = ''trick_won'') as tricks_won,
    COUNT(*) FILTER (WHERE event_type = ''play_card'') as tricks_played
FROM play_events
WHERE player_name = ''Aaron'';
';
