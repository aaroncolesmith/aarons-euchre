-- Migration: Atomic stats increment + player_stats RLS (T-21)
-- Date: 2026-06-05
--
-- Problem 1: client-side stats writes use Math.max() merging, which is lossy
-- and non-additive — concurrent games on different devices can drop increments.
--
-- Solution: replace client writes with an atomic SQL increment that is safe
-- under concurrency.  The edge function calls this with the game's stat delta;
-- Postgres adds it atomically.
--
-- Problem 2: player_stats has no RLS; any holder of the anon key can overwrite
-- any player's career stats.  Now that all writes go through the edge function
-- (service role), lock the table down.
--
-- Safe to re-run (all statements are idempotent).

-- ─── Atomic per-game stats increment ─────────────────────────────────────────
-- Called by the process-action edge function at the end of each game.
-- The delta arguments are what a single player earned in that game
-- (e.g. hands_played = 6 means they played 6 hands this game).
-- Postgres applies this as an atomic increment so concurrent games on
-- multiple devices never clobber each other.

CREATE OR REPLACE FUNCTION increment_player_stats(
    p_name               text,
    p_games_played       int  DEFAULT 0,
    p_games_won          int  DEFAULT 0,
    p_hands_played       int  DEFAULT 0,
    p_hands_won          int  DEFAULT 0,
    p_tricks_played      int  DEFAULT 0,
    p_tricks_taken       int  DEFAULT 0,
    p_tricks_won_team    int  DEFAULT 0,
    p_calls_made         int  DEFAULT 0,
    p_calls_won          int  DEFAULT 0,
    p_loners_attempted   int  DEFAULT 0,
    p_loners_converted   int  DEFAULT 0,
    p_points_scored      int  DEFAULT 0,
    p_euchres_made       int  DEFAULT 0,
    p_euchred            int  DEFAULT 0,
    p_sweeps             int  DEFAULT 0,
    p_swept              int  DEFAULT 0
) RETURNS void AS $$
BEGIN
    INSERT INTO player_stats (
        player_name, games_played, games_won, hands_played, hands_won,
        tricks_played, tricks_taken, tricks_won_team, calls_made, calls_won,
        loners_attempted, loners_converted, points_scored, euchres_made,
        euchred, sweeps, swept
    ) VALUES (
        p_name,
        p_games_played, p_games_won, p_hands_played, p_hands_won,
        p_tricks_played, p_tricks_taken, p_tricks_won_team, p_calls_made, p_calls_won,
        p_loners_attempted, p_loners_converted, p_points_scored, p_euchres_made,
        p_euchred, p_sweeps, p_swept
    )
    ON CONFLICT (player_name) DO UPDATE SET
        games_played     = player_stats.games_played     + EXCLUDED.games_played,
        games_won        = player_stats.games_won        + EXCLUDED.games_won,
        hands_played     = player_stats.hands_played     + EXCLUDED.hands_played,
        hands_won        = player_stats.hands_won        + EXCLUDED.hands_won,
        tricks_played    = player_stats.tricks_played    + EXCLUDED.tricks_played,
        tricks_taken     = player_stats.tricks_taken     + EXCLUDED.tricks_taken,
        tricks_won_team  = player_stats.tricks_won_team  + EXCLUDED.tricks_won_team,
        calls_made       = player_stats.calls_made       + EXCLUDED.calls_made,
        calls_won        = player_stats.calls_won        + EXCLUDED.calls_won,
        loners_attempted = player_stats.loners_attempted + EXCLUDED.loners_attempted,
        loners_converted = player_stats.loners_converted + EXCLUDED.loners_converted,
        points_scored    = player_stats.points_scored    + EXCLUDED.points_scored,
        euchres_made     = player_stats.euchres_made     + EXCLUDED.euchres_made,
        euchred          = player_stats.euchred          + EXCLUDED.euchred,
        sweeps           = player_stats.sweeps           + EXCLUDED.sweeps,
        swept            = player_stats.swept            + EXCLUDED.swept,
        updated_at       = now();
END;
$$ LANGUAGE plpgsql;

-- ─── player_stats RLS ────────────────────────────────────────────────────────
-- Now that all writes go through the edge function, lock down the table.
-- Anon key can read (leaderboard); only service_role can write.

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_stats'
      AND policyname = 'Public read player_stats'
  ) THEN
    CREATE POLICY "Public read player_stats"
      ON public.player_stats FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_stats'
      AND policyname = 'Service role write player_stats'
  ) THEN
    CREATE POLICY "Service role write player_stats"
      ON public.player_stats FOR ALL TO service_role USING (true);
  END IF;
END $$;
