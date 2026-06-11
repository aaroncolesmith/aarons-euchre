-- Migration: Add hand_number to daily_challenge_scores (R-1)
-- Date: 2026-06-10
--
-- Problem: daily_challenge_scores is keyed on (date_string, player_name), but
-- date_string is a human-readable label, not a reliable canonical identifier.
-- Two players on opposite sides of midnight PT could report different date strings
-- for the same hand.
--
-- Solution: introduce hand_number (days since 2026-01-01) as the canonical key.
-- All seeding, dedup, and leaderboard grouping moves to hand_number.
-- date_string is kept for display purposes / backward compat.
--
-- Safe to re-run (ADD COLUMN IF NOT EXISTS + idempotent constraint logic).

-- ─── Add hand_number column ───────────────────────────────────────────────────
ALTER TABLE public.daily_challenge_scores
ADD COLUMN IF NOT EXISTS hand_number integer;

-- ─── Backfill from existing date_string values ───────────────────────────────
UPDATE public.daily_challenge_scores
SET hand_number = (date_string::date - '2026-01-01'::date)
WHERE hand_number IS NULL AND date_string IS NOT NULL;

-- ─── Swap unique constraint to (hand_number, player_name) ─────────────────────
-- Drop old constraint (name may vary; try both the default Postgres name and a
-- custom one in case it was created with an explicit name).
ALTER TABLE public.daily_challenge_scores
DROP CONSTRAINT IF EXISTS daily_challenge_scores_date_string_player_name_key;

ALTER TABLE public.daily_challenge_scores
DROP CONSTRAINT IF EXISTS daily_challenge_scores_hand_player_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'daily_challenge_scores'
      AND c.contype = 'u'
      AND c.conname = 'daily_challenge_scores_hand_player_key'
  ) THEN
    ALTER TABLE public.daily_challenge_scores
    ADD CONSTRAINT daily_challenge_scores_hand_player_key
    UNIQUE (hand_number, player_name);
  END IF;
END $$;
