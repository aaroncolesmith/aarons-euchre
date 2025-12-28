// Cloud Freeze Logging - Log freeze incidents to Supabase for monitoring
import { supabase } from '../lib/supabase';
import Logger from './logger';

interface FreezeIncident {
    game_code: string;
    table_id?: string;
    freeze_type: string;
    phase: string;
    current_player_index: number;
    current_player_name?: string;
    is_bot: boolean;
    time_since_active_ms: number;
    recovery_action?: string;
    recovered: boolean;
    app_version: string;
    diagnostic_data?: any;
}

/**
 * Log a freeze incident to Supabase
 */
export async function logFreezeIncident(incident: FreezeIncident): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('freeze_incidents')
            .insert([incident]);

        if (error) {
            Logger.error('[CLOUD LOGGING] Failed to log freeze incident', error);
            return false;
        }

        Logger.info('[CLOUD LOGGING] Freeze incident logged to cloud', {
            game_code: incident.game_code,
            freeze_type: incident.freeze_type,
            recovered: incident.recovered
        });

        return true;
    } catch (err) {
        Logger.error('[CLOUD LOGGING] Exception logging freeze', err);
        return false;
    }
}

/**
 * Get freeze statistics from Supabase
 */
export async function getFreezeStats(gameCode?: string) {
    try {
        let query = supabase
            .from('freeze_incidents')
            .select('*')
            .order('created_at', { ascending: false });

        if (gameCode) {
            query = query.eq('game_code', gameCode);
        }

        const { data, error } = await query.limit(100);

        if (error) {
            Logger.error('[CLOUD LOGGING] Failed to fetch freeze stats', error);
            return null;
        }

        return data;
    } catch (err) {
        Logger.error('[CLOUD LOGGING] Exception fetching stats', err);
        return null;
    }
}

/**
 * Get freeze rate (incidents per hour)
 */
export async function getFreezeRate(hoursBack: number = 24) {
    try {
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('freeze_incidents')
            .select('id, created_at, recovered')
            .gte('created_at', since);

        if (error) {
            Logger.error('[CLOUD LOGGING] Failed to fetch freeze rate', error);
            return null;
        }

        const total = data?.length || 0;
        const recovered = data?.filter(i => i.recovered).length || 0;
        const unrecovered = total - recovered;
        const rate = total / hoursBack;
        const recoveryRate = total > 0 ? (recovered / total) * 100 : 0;

        return {
            total,
            recovered,
            unrecovered,
            freezesPerHour: rate.toFixed(2),
            recoveryRate: recoveryRate.toFixed(1) + '%',
            timeRange: `${hoursBack}h`
        };
    } catch (err) {
        Logger.error('[CLOUD LOGGING] Exception calculating freeze rate', err);
        return null;
    }
}

/**
 * Get app version from package.json or UI
 */
export function getAppVersion(): string {
    // Try to extract from the UI version display
    const versionElement = document.querySelector('[class*="uppercase tracking"]');
    const match = versionElement?.textContent?.match(/V(\d+\.\d+)/);
    return match ? match[1] : 'unknown';
}
