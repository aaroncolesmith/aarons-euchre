-- COMPREHENSIVE PLAYER STATS INVESTIGATION

-- 1. Check if table has any data
SELECT COUNT(*) as total_rows FROM player_stats;

-- 2. Check all current stats
SELECT 
    player_name,
    games_played,
    games_won,
    hands_played,
    hands_won,
    calls_made,
    updated_at
FROM player_stats
ORDER BY games_played DESC;

-- 3. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'player_stats';

-- 4. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'player_stats';

-- 5. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'player_stats'
ORDER BY ordinal_position;
