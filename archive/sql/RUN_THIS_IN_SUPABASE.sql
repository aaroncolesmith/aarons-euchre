-- FINAL STEP: Run this in Supabase SQL Editor to complete the stats reset

-- Delete all player stats
DELETE FROM player_stats;

-- Verify deletion
SELECT COUNT(*) as remaining_stats FROM player_stats;
-- Should return: 0

-- After this, V1.38 deployed code will start fresh accumulation
