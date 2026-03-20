-- Add hand strength analytics to trump_calls
ALTER TABLE public.trump_calls
ADD COLUMN IF NOT EXISTS hand_strength_upcard NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS hand_strength_best_suit NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.trump_calls.hand_strength_upcard IS
'Weighted hand strength of the final calling hand evaluated against the upcard suit.';

COMMENT ON COLUMN public.trump_calls.hand_strength_best_suit IS
'Best weighted hand strength of the final calling hand across all four suits.';
