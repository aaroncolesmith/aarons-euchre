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
    diagnostic_data JSONB
);

-- Create indexes for querying
CREATE INDEX IF NOT EXISTS idx_freeze_incidents_game_code ON freeze_incidents(game_code);
CREATE INDEX IF NOT EXISTS idx_freeze_incidents_created_at ON freeze_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_freeze_incidents_freeze_type ON freeze_incidents(freeze_type);
CREATE INDEX IF NOT EXISTS idx_freeze_incidents_recovered ON freeze_incidents(recovered);

-- Enable Row Level Security
ALTER TABLE freeze_incidents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can insert freeze incidents" ON freeze_incidents;
DROP POLICY IF EXISTS "Anyone can read freeze incidents" ON freeze_incidents;

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
