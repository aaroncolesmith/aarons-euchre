-- ============================================================================
-- RESTORE DELETED AARON GAMES
-- Run this in Supabase SQL Editor to recover your deleted games
-- ============================================================================

-- Step 1: Preview what will be restored
SELECT 
    code AS TABLE_CODE,
    (state->>'tableName') AS TABLE_NAME,
    (state->>'phase') AS PHASE,
    CONCAT(
        (state->'scores'->>'team1'), 
        '-', 
        (state->'scores'->>'team2')
    ) AS FINAL_SCORE,
    TO_CHAR(updated_at, 'MM/DD/YYYY HH:MI AM') AS LAST_PLAYED,
    TO_CHAR(deleted_at, 'MM/DD/YYYY HH:MI AM') AS DELETED_AT
FROM games
WHERE 
    deleted_at IS NOT NULL
    AND (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    )
ORDER BY deleted_at DESC;

-- Step 2: If the preview looks good, run this to RESTORE all deleted Aaron games
UPDATE games
SET deleted_at = NULL
WHERE 
    deleted_at IS NOT NULL
    AND (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    );

-- Step 3: Verify restoration
SELECT 
    COUNT(*) as total_aaron_games,
    COUNT(*) FILTER (WHERE (state->>'phase') = 'game_over') as completed_games,
    COUNT(*) FILTER (WHERE (state->>'phase') != 'game_over') as in_progress_games
FROM games
WHERE 
    deleted_at IS NULL
    AND (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    );
