-- ============================================================================
-- Migration: Add soft delete support to games table
-- Purpose: Prevent completed games from being permanently deleted
-- Date: 2026-01-02
-- ============================================================================

-- Add deleted_at column (nullable timestamp)
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for faster queries that filter by deleted_at
CREATE INDEX IF NOT EXISTS idx_games_deleted_at 
ON games(deleted_at);

-- Create index for common query pattern (code + not deleted)
CREATE INDEX IF NOT EXISTS idx_games_code_not_deleted 
ON games(code) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- Query to restore accidentally deleted Aaron games
-- ============================================================================

-- First, let's see what was deleted (run this first to preview)
SELECT 
    code,
    (state->>'tableName') AS table_name,
    (state->>'phase') AS phase,
    CONCAT(
        (state->'scores'->>'team1'), 
        '-', 
        (state->'scores'->>'team2')
    ) AS final_score,
    deleted_at,
    updated_at
FROM games
WHERE 
    deleted_at IS NOT NULL
    AND (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    )
ORDER BY deleted_at DESC
LIMIT 50;

-- RESTORE: Un-delete games (Run this after reviewing the preview above)
-- This will restore ALL deleted Aaron games
UPDATE games
SET deleted_at = NULL
WHERE 
    deleted_at IS NOT NULL
    AND (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    );

-- ============================================================================
-- Updated query to get Aaron's completed games (excluding deleted)
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
    deleted_at IS NULL  -- ONLY NON-DELETED GAMES
    AND (
        (state->>'currentUser') = 'Aaron'
        OR state->'players' @> '[{"name": "Aaron"}]'
    )
    AND (state->>'phase') = 'game_over'
ORDER BY updated_at DESC;
