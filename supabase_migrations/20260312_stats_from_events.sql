-- Migration for P1-4: Stats Derived From Events (V2 - Enriched Events)

-- 1. View to extract hand-level player metrics from Enriched hand_result internal events
CREATE OR REPLACE VIEW player_hand_stats AS
WITH raw_stats AS (
    SELECT 
        game_code,
        hand_number,
        state_version,
        jsonb_array_elements(action_payload->'participantStats') as p_stat
    FROM play_events
    WHERE action_type = 'EVENT:hand_result'
)
SELECT 
    game_code,
    hand_number,
    p_stat->>'name' as player_name,
    (p_stat->'stats'->>'gamesPlayed')::int as games_played,
    (p_stat->'stats'->>'gamesWon')::int as games_won,
    (p_stat->'stats'->>'handsPlayed')::int as hands_played,
    (p_stat->'stats'->>'handsWon')::int as hands_won,
    (p_stat->'stats'->>'tricksPlayed')::int as tricks_played,
    (p_stat->'stats'->>'tricksTaken')::int as tricks_taken,
    (p_stat->'stats'->>'tricksWonTeam')::int as tricks_won_team,
    (p_stat->'stats'->>'callsMade')::int as calls_made,
    (p_stat->'stats'->>'callsWon')::int as calls_won,
    (p_stat->'stats'->>'lonersAttempted')::int as loners_attempted,
    (p_stat->'stats'->>'lonersWon')::int as loners_converted,
    (p_stat->'stats'->>'pointsScored')::int as points_scored,
    (p_stat->'stats'->>'euchresMade')::int as euchres_made,
    (p_stat->'stats'->>'euchred')::int as euchred,
    (p_stat->'stats'->>'sweeps')::int as sweeps,
    (p_stat->'stats'->>'swept')::int as swept
FROM raw_stats;

-- 2. Final Aggregated Stats View
-- We take the MAX of each stat per game (since they are cumulative in the engine)
-- then SUM those maxes across all games for each player.
CREATE OR REPLACE VIEW event_derived_stats AS
WITH game_maxes AS (
    SELECT 
        player_name,
        game_code,
        MAX(games_played) as g_played,
        MAX(games_won) as g_won,
        MAX(hands_played) as h_played,
        MAX(hands_won) as h_won,
        MAX(tricks_played) as t_played,
        MAX(tricks_taken) as t_taken,
        MAX(tricks_won_team) as t_won_team,
        MAX(calls_made) as c_made,
        MAX(calls_won) as c_won,
        MAX(loners_attempted) as l_att,
        MAX(loners_converted) as l_conv,
        MAX(points_scored) as pts,
        MAX(euchres_made) as e_made,
        MAX(euchred) as e_be,
        MAX(sweeps) as sw,
        MAX(swept) as sp
    FROM player_hand_stats
    WHERE player_name IS NOT NULL
    GROUP BY player_name, game_code
)
SELECT 
    player_name,
    SUM(g_played) as games_played,
    SUM(g_won) as games_won,
    SUM(h_played) as hands_played,
    SUM(h_won) as hands_won,
    SUM(t_played) as tricks_played,
    SUM(t_taken) as tricks_taken,
    SUM(t_won_team) as tricks_won_team,
    SUM(c_made) as calls_made,
    SUM(c_won) as calls_won,
    SUM(l_att) as loners_attempted,
    SUM(l_conv) as loners_converted,
    SUM(pts) as points_scored,
    SUM(e_made) as euchres_made,
    SUM(e_be) as euchred,
    SUM(sw) as sweeps,
    SUM(sp) as swept
FROM game_maxes
GROUP BY player_name;

-- 3. Update Function
CREATE OR REPLACE FUNCTION refresh_player_stats_from_events() 
RETURNS VOID AS $$
BEGIN
    INSERT INTO player_stats (
        player_name, games_played, games_won, hands_played, hands_won,
        tricks_played, tricks_taken, tricks_won_team, calls_made, calls_won,
        loners_attempted, loners_converted, points_scored, euchres_made, 
        euchred, sweeps, swept
    )
    SELECT * FROM event_derived_stats
    ON CONFLICT (player_name) DO UPDATE SET
        games_played = EXCLUDED.games_played,
        games_won = EXCLUDED.games_won,
        hands_played = EXCLUDED.hands_played,
        hands_won = EXCLUDED.hands_won,
        tricks_played = EXCLUDED.tricks_played,
        tricks_taken = EXCLUDED.tricks_taken,
        tricks_won_team = EXCLUDED.tricks_won_team,
        calls_made = EXCLUDED.calls_made,
        calls_won = EXCLUDED.calls_won,
        loners_attempted = EXCLUDED.loners_attempted,
        loners_converted = EXCLUDED.loners_converted,
        points_scored = EXCLUDED.points_scored,
        euchres_made = EXCLUDED.euchres_made,
        euchred = EXCLUDED.euchred,
        sweeps = EXCLUDED.sweeps,
        swept = EXCLUDED.swept,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;
