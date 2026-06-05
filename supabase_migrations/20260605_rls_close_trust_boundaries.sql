-- Migration: Close client write access to core tables (T-02)
-- Date: 2026-06-05
--
-- Problem: clients write to daily_challenge_scores using the public anon key,
-- and the games table had no RLS.  Anyone with the bundled anon key could
-- overwrite leaderboard scores.  The games table was also being written with
-- full hand data by the host client (now removed in T-01).
--
-- Scope of THIS migration (conservative / non-breaking):
--   - games: read-only to anon; writes to service_role only.
--             Safe immediately — client no longer writes here (T-01).
--   - daily_challenge_scores: drop the "anyone can insert" policy;
--             writes now require service_role (process-action edge fn).
--             Client is updated to route through the edge function instead.
--
-- Out of scope for this migration (requires stats pipeline cleanup first):
--   - player_stats and play_events are locked down in a follow-up migration
--     once the full server-authoritative stats path (T-21) is in place.
--
-- Safe to re-run (all statements are idempotent).

-- ─── games ───────────────────────────────────────────────────────────────────

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'games' AND policyname = 'Public read games'
  ) THEN
    CREATE POLICY "Public read games"
      ON public.games FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'games' AND policyname = 'Service role write games'
  ) THEN
    CREATE POLICY "Service role write games"
      ON public.games FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ─── daily_challenge_scores ───────────────────────────────────────────────────
-- Replace the permissive "Anyone can insert" policy with service_role only.
-- The client now submits scores via the process-action edge function which
-- uses the service role key.

ALTER TABLE public.daily_challenge_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_challenge_scores' AND policyname = 'Anyone can insert daily scores'
  ) THEN
    DROP POLICY "Anyone can insert daily scores" ON public.daily_challenge_scores;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_challenge_scores' AND policyname = 'Service role write daily scores'
  ) THEN
    CREATE POLICY "Service role write daily scores"
      ON public.daily_challenge_scores FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- NOTE: The "Anyone can read daily scores" SELECT policy from
-- create_daily_challenge_table.sql is preserved; no change needed here.
