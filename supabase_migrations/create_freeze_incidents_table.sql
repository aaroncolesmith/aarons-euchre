-- Create freeze_incidents table to track all game freezes
CREATE TABLE IF NOT EXISTS freeze_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_code TEXT NOT NULL,
    table_id TEXT,
    freeze_type TEXT NOT NULL,
    phase TEXT NOT NULL,
    current_player_index INTEGER NOT NULL,
    current_player_name TEXT,
    is_bot BOOLEAN NOT NULL,
    time_since_active_ms INTEGER NOT NULL,
    recovery_action TEXT,
    recovered BOOLEAN DEFAULT false,
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Additional diagnostic data
    diagnostic_data JSONB,
    
    -- Indexes for querying
    INDEX idx_freeze_incidents_game_code ON freeze_incidents(game_code),
    INDEX idx_freeze_incidents_created_at ON freeze_incidents(created_at),
    INDEX idx_freeze_incidents_freeze_type ON freeze_incidents(freeze_type),
    INDEX idx_freeze_incidents_recovered ON freeze_incidents(recovered)
);

-- Enable Row Level Security
ALTER TABLE freeze_incidents ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert freeze incidents
CREATE POLICY "Anyone can insert freeze incidents"
    ON freeze_incidents
    FOR INSERT
    WITH CHECK (true);

-- Policy: Anyone can read freeze incidents
CREATE POLICY "Anyone can read freeze incidents"
    ON freeze_incidents
    FOR SELECT
    USING (true);

-- Add comment
COMMENT ON TABLE freeze_incidents IS 'Tracks all game freeze incidents for monitoring and debugging';
