-- One-shot backfill of player_id for known users/bots
-- Safe to run multiple times; only fills NULL player_id values.

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
