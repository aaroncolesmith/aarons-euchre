-- Migration 003: Complete Stats Reset
-- Reason: Stats corrupted due to multiple wipes/resets causing inconsistencies
-- This wipes everything clean so we can start fresh with accurate data

-- 1. Delete all player stats
DELETE FROM player_stats;

-- 2. Verify deletion
SELECT COUNT(*) as remaining_stats FROM player_stats;

-- After running this, all stats will be 0
-- New games will start accumulating accurate stats from scratch
