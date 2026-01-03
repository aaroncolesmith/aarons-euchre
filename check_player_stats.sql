-- Check if player_stats table has any data
SELECT * FROM player_stats ORDER BY updated_at DESC LIMIT 20;

-- Check when the table was last updated
SELECT 
    player_name,
    games_played,
    games_won,
    hands_played,
    updated_at
FROM player_stats
ORDER BY updated_at DESC;

-- Check if there's any data at all
SELECT COUNT(*) as total_players FROM player_stats;
