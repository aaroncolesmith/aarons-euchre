-- ============================================================================
-- EUCHRE DATABASE CLEANUP SCRIPT
-- Clean up old, stuck, and abandoned games from active_games table
-- ============================================================================

-- Step 1: INSPECT - See what's in the database
-- ============================================================================

-- See all active games with their status
SELECT 
    code,
    phase,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_since_update,
    CASE 
        WHEN updated_at < NOW() - INTERVAL '24 hours' THEN '🔴 STALE (24h+)'
        WHEN updated_at < NOW() - INTERVAL '6 hours' THEN '🟡 OLD (6h+)'
        WHEN updated_at < NOW() - INTERVAL '1 hour' THEN '🟢 RECENT (1h+)'
        ELSE '✅ ACTIVE'
    END as status
FROM active_games
ORDER BY updated_at DESC;

-- Count games by age
SELECT 
    CASE 
        WHEN updated_at < NOW() - INTERVAL '24 hours' THEN 'Older than 24 hours'
        WHEN updated_at < NOW() - INTERVAL '6 hours' THEN 'Older than 6 hours'
        WHEN updated_at < NOW() - INTERVAL '1 hour' THEN 'Older than 1 hour'
        ELSE 'Active (less than 1 hour)'
    END as age_category,
    COUNT(*) as game_count
FROM active_games
GROUP BY age_category
ORDER BY 
    CASE 
        WHEN updated_at < NOW() - INTERVAL '24 hours' THEN 1
        WHEN updated_at < NOW() - INTERVAL '6 hours' THEN 2
        WHEN updated_at < NOW() - INTERVAL '1 hour' THEN 3
        ELSE 4
    END;


-- Step 2: CLEANUP OPTIONS
-- ============================================================================

-- Option A: Delete the specific frozen game (321-943)
-- DELETE FROM active_games WHERE code = '321-943';

-- Option B: Delete all games older than 24 hours (abandoned)
-- DELETE FROM active_games 
-- WHERE updated_at < NOW() - INTERVAL '24 hours';

-- Option C: Delete all games older than 6 hours (likely abandoned)
-- DELETE FROM active_games 
-- WHERE updated_at < NOW() - INTERVAL '6 hours';

-- Option D: Delete all games older than 1 hour (aggressive)
-- DELETE FROM active_games 
-- WHERE updated_at < NOW() - INTERVAL '1 hour';

-- Option E: NUCLEAR - Delete ALL active games (fresh start)
-- DELETE FROM active_games;


-- Step 3: RECOMMENDED CLEANUP
-- ============================================================================

-- Safe cleanup: Remove games older than 6 hours
-- (Games should never last 6+ hours, so these are definitely stuck/abandoned)

DELETE FROM active_games 
WHERE updated_at < NOW() - INTERVAL '6 hours'
RETURNING code, phase, updated_at;

-- This will:
-- ✅ Delete old/stuck games
-- ✅ Show you what was deleted
-- ✅ Keep recent active games


-- Step 4: VERIFY CLEANUP
-- ============================================================================

-- Check how many games remain
SELECT COUNT(*) as remaining_games FROM active_games;

-- See what's left
SELECT code, phase, updated_at 
FROM active_games 
ORDER BY updated_at DESC;


-- ============================================================================
-- MAINTENANCE TIPS
-- ============================================================================

-- Run this cleanup periodically (daily/weekly) to keep DB clean:
-- 1. Review games with the INSPECT query
-- 2. Run the RECOMMENDED CLEANUP
-- 3. Verify with the VERIFY query

-- Or set up automatic cleanup with a Supabase cron job:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- SELECT cron.schedule(
--     'cleanup-old-games',
--     '0 4 * * *',  -- Run at 4 AM every day
--     $$
--     DELETE FROM active_games 
--     WHERE updated_at < NOW() - INTERVAL '24 hours';
--     $$
-- );
