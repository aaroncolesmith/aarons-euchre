-- Migration for P1-5: Observability Baseline

-- 1. Create a centralized application logs table
CREATE TABLE IF NOT EXISTS app_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    level TEXT NOT NULL, -- INFO, WARN, ERROR, DEBUG
    message TEXT NOT NULL,
    context JSONB, -- Any diagnostic data
    user_name TEXT,
    table_code TEXT,
    app_version TEXT,
    environment TEXT DEFAULT 'client' -- client or server
);

-- Index for fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_table_code ON app_logs(table_code);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at);

-- 2. Ensure freeze_incidents table exists (it might already from previous steps)
CREATE TABLE IF NOT EXISTS freeze_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    game_code TEXT NOT NULL,
    table_id TEXT,
    freeze_type TEXT NOT NULL,
    phase TEXT,
    current_player_index INTEGER,
    current_player_name TEXT,
    is_bot BOOLEAN,
    time_since_active_ms INTEGER,
    recovery_action TEXT,
    recovered BOOLEAN,
    app_version TEXT,
    diagnostic_data JSONB
);

-- 3. Create a unified Observability Dashboard View
CREATE OR REPLACE VIEW observability_dashboard AS
SELECT 
    created_at,
    'LOG' as type,
    level as severity,
    message as summary,
    table_code as game,
    user_name as actor,
    context as details
FROM app_logs
UNION ALL
SELECT 
    created_at,
    'FREEZE' as type,
    'CRITICAL' as severity,
    freeze_type || ' freeze in ' || phase as summary,
    game_code as game,
    current_player_name as actor,
    diagnostic_data as details
FROM freeze_incidents
ORDER BY created_at DESC;

-- Enable RLS (Service Role Only for reading logs, anyone can write for now)
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert logs" ON app_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role only can read logs" ON app_logs FOR SELECT TO service_role USING (true);

ALTER TABLE freeze_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert incidents" ON freeze_incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role only can read incidents" ON freeze_incidents FOR SELECT TO service_role USING (true);
