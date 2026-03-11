-- ============================================================================
-- Query to find Aaron's most recently completed games
-- Run this in Supabase SQL Editor
-- ============================================================================

SELECT 
    updated_at AS LAST_ACTIVITY,
    (state->>'tableName') AS TABLE_NAME,
    (state->>'tableCode') AS TABLE_CODE,
    ARRAY_TO_STRING(
        ARRAY(
            SELECT jsonb_array_elements(state->'players')->>'name' 
            WHERE jsonb_array_elements(state->'players')->>'name' IS NOT NULL
        ), 
        ', '
    ) AS PLAYER_LIST,
    (state->>'phase') AS PHASE,
    CONCAT(
        (state->'scores'->>'team1'), 
        '-', 
        (state->'scores'->>'team2')
    ) AS FINAL_SCORE,
    (state->>'lastActive') AS LAST_ACTIVE_TIMESTAMP
FROM games
WHERE 
    -- Filter for games involving Aaron
    (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    )
    -- Only completed games
    AND (state->>'phase') = 'game_over'
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================================================
-- Alternative query with better formatting
-- ============================================================================

SELECT 
    TO_CHAR(updated_at, 'MM/DD/YYYY HH:MI AM') AS LAST_ACTIVITY,
    (state->>'tableName') AS TABLE_NAME,
    (state->>'tableCode') AS TABLE_CODE,
    (state->>'phase') AS PHASE,
    CONCAT(
        (state->'scores'->>'team1'), 
        '-', 
        (state->'scores'->>'team2')
    ) AS FINAL_SCORE
FROM games
WHERE 
    (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    )
    AND (state->>'phase') = 'game_over'
ORDER BY updated_at DESC;

-- ============================================================================
-- Diagnostic: Check for duplicate games
-- ============================================================================

SELECT 
    code,
    COUNT(*) as count,
    STRING_AGG((state->>'tableName'), ', ') as table_names,
    STRING_AGG(TO_CHAR(updated_at, 'MM/DD HH:MI AM'), ', ') as update_times
FROM games
WHERE 
    (state->>'currentUser') = 'Aaron'
    OR state->'players' @> '[{"name": "Aaron"}]'
GROUP BY code
HAVING COUNT(*) > 1;

-- ============================================================================
-- Summary Stats
-- ============================================================================

SELECT 
    (state->>'phase') AS game_phase,
    COUNT(*) as count
FROM games
WHERE 
    (state->>'currentUser') = 'Aaron'
    OR state->'players' @> '[{"name": "Aaron"}]'
GROUP BY (state->>'phase')
ORDER BY count DESC;
