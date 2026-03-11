-- Query the specific game to see its current state
SELECT 
    code,
    state->>'phase' as phase,
    state->>'isLoner' as is_loner,
    state->>'trumpCallerIndex' as trump_caller_index,
    state->'scores' as scores,
    state->'tricksWon' as tricks_won,
    state->>'trump' as trump,
    updated_at,
    deleted_at
FROM games
WHERE code = '836-955';

-- Also check event log for this game
SELECT 
    code,
    jsonb_array_elements(state->'eventLog') as event
FROM games
WHERE code = '836-955'
ORDER BY (event->>'timestamp')::bigint DESC
LIMIT 20;
