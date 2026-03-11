-- Fix game 836-955: Award the 4 points for the successful loner
-- and transition to the correct phase to continue the game

UPDATE games
SET 
    state = jsonb_set(
        jsonb_set(
            state,
            '{scores,team1}',
            '9'
        ),
        '{phase}',
        '"waiting_for_next_deal"'
    ),
    updated_at = NOW()
WHERE code = '836-955';

-- Verify the fix
SELECT 
    code,
    state->>'phase' as phase,
    state->'scores' as scores,
    state->>'trump' as trump,
    state->>'isLoner' as is_loner
FROM games
WHERE code = '836-955';
