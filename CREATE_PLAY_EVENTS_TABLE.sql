-- RUN THIS IN SUPABASE SQL EDITOR
-- Creates the play_events table for event sourcing

CREATE TABLE IF NOT EXISTS play_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Game context
    game_code TEXT NOT NULL,
    hand_number INTEGER NOT NULL,
    trick_number INTEGER,
    
    -- Event metadata
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    
    -- Player context
    player_name TEXT,
    player_seat INTEGER,
    
    -- Timestamp
    occurred_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_play_events_game ON play_events(game_code);
CREATE INDEX idx_play_events_player ON play_events(player_name);
CREATE INDEX idx_play_events_type ON play_events(event_type);
CREATE INDEX idx_play_events_occurred ON play_events(occurred_at);
CREATE INDEX idx_play_events_player_time ON play_events(player_name, occurred_at);

-- Verify table created
SELECT COUNT(*) as total_events FROM play_events;
-- Should return 0 initially
