-- Migration for P1: Stats Derived From Events (V3 - Game Over Aware)

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

-- 2. Game winners extracted from game_over events
--    Fallback: derive winners from the final hand_result if game_over is missing.
CREATE OR REPLACE VIEW game_winners AS
WITH has_game_over AS (
    SELECT DISTINCT game_code
    FROM play_events
    WHERE action_type = 'EVENT:game_over'
),
game_over_winners AS (
    SELECT
        game_code,
        jsonb_array_elements_text(action_payload->'winnerPlayers') as player_name
    FROM play_events
    WHERE action_type = 'EVENT:game_over'
),
last_hand_results AS (
    SELECT DISTINCT ON (game_code)
        game_code,
        action_payload
    FROM play_events
    WHERE action_type = 'EVENT:hand_result'
    ORDER BY game_code, hand_number DESC, state_version DESC
),
winner_team AS (
    SELECT
        game_code,
        CASE
            WHEN (action_payload->'handResult'->'scoresAtEnd'->>'team1')::int >=
                 (action_payload->'handResult'->'scoresAtEnd'->>'team2')::int
            THEN 1 ELSE 2
        END AS winner_team,
        action_payload
    FROM last_hand_results
),
legacy_game_winners AS (
    SELECT
        wt.game_code,
        p_stat->>'name' as player_name
    FROM winner_team wt,
         LATERAL jsonb_array_elements(wt.action_payload->'participantStats') as p_stat
    WHERE p_stat->>'name' IS NOT NULL
      AND (
          (wt.winner_team = 1 AND (p_stat->>'seat')::int IN (0, 2)) OR
          (wt.winner_team = 2 AND (p_stat->>'seat')::int IN (1, 3))
      )
)
SELECT game_code, player_name
FROM game_over_winners
UNION ALL
SELECT game_code, player_name
FROM legacy_game_winners
WHERE game_code NOT IN (SELECT game_code FROM has_game_over);

-- 3. Final Aggregated Stats View
-- Games played = count of distinct games per player
-- Games won = count of game_over events where player is in winnerPlayers
CREATE OR REPLACE VIEW event_derived_stats AS
WITH game_maxes AS (
    SELECT 
        player_name,
        game_code,
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
),
player_wins AS (
    SELECT player_name, COUNT(*) as games_won
    FROM game_winners
    WHERE player_name IS NOT NULL
    GROUP BY player_name
)
SELECT 
    gm.player_name,
    COUNT(*) as games_played,
    COALESCE(pw.games_won, 0) as games_won,
    SUM(gm.h_played) as hands_played,
    SUM(gm.h_won) as hands_won,
    SUM(gm.t_played) as tricks_played,
    SUM(gm.t_taken) as tricks_taken,
    SUM(gm.t_won_team) as tricks_won_team,
    SUM(gm.c_made) as calls_made,
    SUM(gm.c_won) as calls_won,
    SUM(gm.l_att) as loners_attempted,
    SUM(gm.l_conv) as loners_converted,
    SUM(gm.pts) as points_scored,
    SUM(gm.e_made) as euchres_made,
    SUM(gm.e_be) as euchred,
    SUM(gm.sw) as sweeps,
    SUM(gm.sp) as swept
FROM game_maxes gm
LEFT JOIN player_wins pw ON pw.player_name = gm.player_name
GROUP BY gm.player_name, pw.games_won;

-- 4. Update Function
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
