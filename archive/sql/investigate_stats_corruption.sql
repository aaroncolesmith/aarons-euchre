-- Investigate the stats inconsistency
-- If Aaron and Huber both show 6 games, they should have similar hand counts

-- 1. Check Aaron's completed games
SELECT 
    code,
    state->'players' as players,
    state->>'handsPlayed' as hands_played_in_game,
    (state->'scores'->>'team1')::int + (state->'scores'->>'team2')::int as total_points,
    updated_at
FROM games
WHERE deleted_at IS NULL
  AND (
    state->'players'->0->>'name' = 'Aaron' OR
    state->'players'->1->>'name' = 'Aaron' OR
    state->'players'->2->>'name' = 'Aaron' OR
    state->'players'->3->>'name' = 'Aaron'
  )
ORDER BY updated_at DESC;

-- 2. Sum up total hands Aaron should have
-- Each game should contribute its handsPlayed to Aaron's total
-- Expected: ~20-30 hands per game to reach 10 points
-- 6 games * 25 hands avg = 150 hands (close to 121)

-- 3. Check if Huber's stats are being counted multiple times
-- Maybe Huber is in way more games than Aaron?
SELECT 
    COUNT(*) as huber_games
FROM games
WHERE deleted_at IS NULL
  AND (
    state->'players'->0->>'name' = 'Huber' OR
    state->'players'->1->>'name' = 'Huber' OR
    state->'players'->2->>'name' = 'Huber' OR
    state->'players'->3->>'name' = 'Huber'
  );
