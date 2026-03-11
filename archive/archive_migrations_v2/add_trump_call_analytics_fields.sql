-- Migration: Add Missing Trump Call Analytics Fields
-- This migration adds the critical fields needed for trump call analysis that were lost in the initial Supabase migration

-- Add missing columns to trump_calls table
ALTER TABLE public.trump_calls 
    ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'Human',
    ADD COLUMN IF NOT EXISTS dealer TEXT,
    ADD COLUMN IF NOT EXISTS dealer_relationship TEXT,
    ADD COLUMN IF NOT EXISTS bower_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trump_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS suit_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS hand_after_discard TEXT;

-- Add index on user_type for filtering humans vs bots
CREATE INDEX IF NOT EXISTS idx_trump_calls_user_type ON public.trump_calls(user_type);

-- Add comments to document the schema
COMMENT ON COLUMN public.trump_calls.user_type IS 'Whether the player who called trump is Human or Bot';
COMMENT ON COLUMN public.trump_calls.dealer IS 'Name of the dealer for this hand';
COMMENT ON COLUMN public.trump_calls.dealer_relationship IS 'Relationship of dealer to caller (teammate/opponent/self/partner)';
COMMENT ON COLUMN public.trump_calls.bower_count IS 'Number of bowers (Jacks) in hand when trump was called';
COMMENT ON COLUMN public.trump_calls.trump_count IS 'Total number of trump cards (including bowers) in hand';
COMMENT ON COLUMN public.trump_calls.suit_count IS 'Number of unique effective suits in hand (distribution analysis)';
COMMENT ON COLUMN public.trump_calls.hand_after_discard IS 'Comma-separated list of cards in hand after discarding (for picked up calls)';
