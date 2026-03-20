-- Add called-trump hand strength analytics to trump_calls
ALTER TABLE public.trump_calls
ADD COLUMN IF NOT EXISTS hand_strength_called_trump NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.trump_calls.hand_strength_called_trump IS
'Weighted hand strength of the final calling hand evaluated against the suit actually called.';
