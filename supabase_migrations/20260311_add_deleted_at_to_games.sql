-- ============================================================================
-- Add deleted_at to games table for Soft Delete
-- ============================================================================

ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for performance when filtering deleted games
CREATE INDEX IF NOT EXISTS idx_games_deleted_at ON public.games(deleted_at);
