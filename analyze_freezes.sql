-- Query freeze incidents to find patterns
SELECT 
    phase,
    recovery_action,
    COUNT(*) as freeze_count,
    AVG(EXTRACT(EPOCH FROM (recovered_at - detected_at))) as avg_recovery_seconds
FROM freeze_incidents
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY phase, recovery_action
ORDER BY freeze_count DESC;

-- Get specific details of recent freezes
SELECT 
    *
FROM freeze_incidents
WHERE detected_at > NOW() - INTERVAL '7 days'
ORDER BY detected_at DESC
LIMIT 20;

-- Find most common freeze patterns
SELECT 
    phase,
    current_player_is_bot,
    COUNT(*) as occurrences
FROM freeze_incidents
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY phase, current_player_is_bot
ORDER BY occurrences DESC;
