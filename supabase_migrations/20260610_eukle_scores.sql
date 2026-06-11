-- Migration: eukle_scores table for Numbered Eukle game results
-- Date: 2026-06-10
--
-- Numbered Eukles are always-available seeded games (EUKLE-{N}-{user}).
-- Stats are tracked separately from Hand of the Day (daily_challenge_scores)
-- and from career stats (player_stats). Multiple attempts per eukle are
-- recorded; the latest result is used for UI display.

CREATE TABLE IF NOT EXISTS public.eukle_scores (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name text NOT NULL,
    eukle_number integer NOT NULL,
    won         boolean NOT NULL,
    team_points integer,
    opp_points  integer,
    team_tricks integer,
    opp_tricks  integer,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eukle_scores_player_idx ON public.eukle_scores (player_name);
CREATE INDEX IF NOT EXISTS eukle_scores_number_idx ON public.eukle_scores (eukle_number);

ALTER TABLE public.eukle_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'eukle_scores' AND policyname = 'Public read eukle_scores'
  ) THEN
    CREATE POLICY "Public read eukle_scores"
      ON public.eukle_scores FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'eukle_scores' AND policyname = 'Service role write eukle_scores'
  ) THEN
    CREATE POLICY "Service role write eukle_scores"
      ON public.eukle_scores FOR ALL TO service_role USING (true);
  END IF;
END $$;
