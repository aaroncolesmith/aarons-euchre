-- Create player_stats table for cross-device stats persistence
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS player_stats (
  player_name TEXT PRIMARY KEY,
  stats JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_stats_updated ON player_stats(updated_at DESC);

-- Enable Row Level Security (optional - adjust based on your auth setup)
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on player_stats" ON player_stats
  FOR ALL
  USING (true)
  WITH CHECK (true);
