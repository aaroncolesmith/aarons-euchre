-- All-in-one migration v3: no ON CONFLICT requirement (delete + insert)

-- 0. Ensure player_stats has all expected columns
ALTER TABLE public.player_stats
ADD COLUMN IF NOT EXISTS player_name TEXT,
ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hands_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hands_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tricks_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tricks_taken INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tricks_won_team INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_made INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loners_attempted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loners_converted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_scored INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS euchres_made INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS euchred INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sweeps INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS swept INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1. Ensure player_id column exists
ALTER TABLE public.player_stats
ADD COLUMN IF NOT EXISTS player_id TEXT;

-- 2. Drop and recreate views with explicit columns
DROP VIEW IF EXISTS event_derived_stats;
DROP VIEW IF EXISTS player_hand_stats;

CREATE VIEW player_hand_stats (
    game_code,
    hand_number,
    player_id,
    player_name,
    games_played,
    games_won,
    hands_played,
    hands_won,
    tricks_played,
    tricks_taken,
    tricks_won_team,
    calls_made,
    calls_won,
    loners_attempted,
    loners_converted,
    points_scored,
    euchres_made,
    euchred,
    sweeps,
    swept
) AS
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
    p_stat->>'userId' as player_id,
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

CREATE VIEW event_derived_stats (
    player_id,
    player_name,
    games_played,
    games_won,
    hands_played,
    hands_won,
    tricks_played,
    tricks_taken,
    tricks_won_team,
    calls_made,
    calls_won,
    loners_attempted,
    loners_converted,
    points_scored,
    euchres_made,
    euchred,
    sweeps,
    swept
) AS
WITH game_maxes AS (
    SELECT 
        COALESCE(player_id, player_name) as identity_key,
        MAX(player_id) as player_id,
        MAX(player_name) as player_name,
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
    GROUP BY COALESCE(player_id, player_name), game_code
)
SELECT 
    player_id,
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
GROUP BY player_id, player_name;

-- 3. Replace refresh function to avoid ON CONFLICT requirement
CREATE OR REPLACE FUNCTION refresh_player_stats_from_events() 
RETURNS VOID AS $$
BEGIN
    -- Player_id rows
    DELETE FROM player_stats
    WHERE player_id IN (SELECT player_id FROM event_derived_stats WHERE player_id IS NOT NULL);

    INSERT INTO player_stats (
        player_id, player_name, games_played, games_won, hands_played, hands_won,
        tricks_played, tricks_taken, tricks_won_team, calls_made, calls_won,
        loners_attempted, loners_converted, points_scored, euchres_made, 
        euchred, sweeps, swept, updated_at
    )
    SELECT 
        player_id, player_name, games_played, games_won, hands_played, hands_won,
        tricks_played, tricks_taken, tricks_won_team, calls_made, calls_won,
        loners_attempted, loners_converted, points_scored, euchres_made, 
        euchred, sweeps, swept, now()
    FROM event_derived_stats
    WHERE player_id IS NOT NULL;

    -- Legacy name-only rows
    DELETE FROM player_stats
    WHERE player_id IS NULL
      AND player_name IN (SELECT player_name FROM event_derived_stats WHERE player_id IS NULL);

    INSERT INTO player_stats (
        player_id, player_name, games_played, games_won, hands_played, hands_won,
        tricks_played, tricks_taken, tricks_won_team, calls_made, calls_won,
        loners_attempted, loners_converted, points_scored, euchres_made, 
        euchred, sweeps, swept, updated_at
    )
    SELECT 
        player_id, player_name, games_played, games_won, hands_played, hands_won,
        tricks_played, tricks_taken, tricks_won_team, calls_made, calls_won,
        loners_attempted, loners_converted, points_scored, euchres_made, 
        euchred, sweeps, swept, now()
    FROM event_derived_stats
    WHERE player_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Backfill player_id for known users/bots
UPDATE public.player_stats
SET player_id = CASE player_name
    WHEN 'Aaron' THEN 'user_aaron'
    WHEN 'Polina' THEN 'user_polina'
    WHEN 'Gray-Gray' THEN 'user_gray_gray'
    WHEN 'Mimi' THEN 'user_mimi'
    WHEN 'Micah' THEN 'user_micah'
    WHEN 'Cherrie' THEN 'user_cherrie'
    WHEN 'Peter-Playwright' THEN 'user_peter_playwright'
    WHEN 'TEST' THEN 'user_test'
    WHEN 'Fizz' THEN 'bot_fizz'
    WHEN 'J-Bock' THEN 'bot_j_bock'
    WHEN 'Huber' THEN 'bot_huber'
    WHEN 'Moses' THEN 'bot_moses'
    WHEN 'Wooden' THEN 'bot_wooden'
    WHEN 'Buff' THEN 'bot_buff'
    ELSE player_id
END
WHERE player_id IS NULL;

-- 5. Rebuild stats from events
SELECT refresh_player_stats_from_events();
