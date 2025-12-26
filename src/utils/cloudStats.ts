import { supabase } from '../lib/supabase';
import { PlayerStats } from '../types/game';

/**
 * Fetch stats for a specific player from Supabase
 */
export async function fetchPlayerStats(playerName: string): Promise<PlayerStats | null> {
    try {
        const { data, error } = await supabase
            .from('player_stats')
            .select('stats')
            .eq('player_name', playerName)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No stats found for this player yet
                return null;
            }
            console.error('Error fetching player stats:', error);
            return null;
        }

        return data?.stats || null;
    } catch (err) {
        console.error('Exception fetching player stats:', err);
        return null;
    }
}

/**
 * Fetch all players' stats from Supabase
 */
export async function fetchAllPlayersStats(): Promise<Record<string, PlayerStats>> {
    try {
        const { data, error } = await supabase
            .from('player_stats')
            .select('player_name, stats')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching all players stats:', error);
            return {};
        }

        if (!data) {
            return {};
        }

        // Convert array to object keyed by player name
        const statsMap: Record<string, PlayerStats> = {};
        data.forEach(row => {
            if (row.player_name && row.stats) {
                statsMap[row.player_name] = row.stats;
            }
        });

        return statsMap;
    } catch (err) {
        console.error('Exception fetching all players stats:', err);
        return {};
    }
}

/**
 * Save or update a player's stats in Supabase
 */
export async function savePlayerStats(playerName: string, stats: PlayerStats): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('player_stats')
            .upsert({
                player_name: playerName,
                stats: stats,
                updated_at: new Date().toISOString()
            }, { onConflict: 'player_name' });

        if (error) {
            console.error('Error saving player stats:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Exception saving player stats:', err);
        return false;
    }
}

/**
 * Merge local and cloud stats, preferring the one with higher values
 * (assumes stats only accumulate, never decrease)
 */
export function mergePlayerStats(local: PlayerStats, cloud: PlayerStats): PlayerStats {
    return {
        gamesPlayed: Math.max(local.gamesPlayed || 0, cloud.gamesPlayed || 0),
        gamesWon: Math.max(local.gamesWon || 0, cloud.gamesWon || 0),
        handsPlayed: Math.max(local.handsPlayed || 0, cloud.handsPlayed || 0),
        handsWon: Math.max(local.handsWon || 0, cloud.handsWon || 0),
        tricksPlayed: Math.max(local.tricksPlayed || 0, cloud.tricksPlayed || 0),
        tricksTaken: Math.max(local.tricksTaken || 0, cloud.tricksTaken || 0),
        tricksWonTeam: Math.max(local.tricksWonTeam || 0, cloud.tricksWonTeam || 0),
        callsMade: Math.max(local.callsMade || 0, cloud.callsMade || 0),
        callsWon: Math.max(local.callsWon || 0, cloud.callsWon || 0),
        lonersAttempted: Math.max(local.lonersAttempted || 0, cloud.lonersAttempted || 0),
        lonersConverted: Math.max(local.lonersConverted || 0, cloud.lonersConverted || 0),
        euchresMade: Math.max(local.euchresMade || 0, cloud.euchresMade || 0),
        euchred: Math.max(local.euchred || 0, cloud.euchred || 0),
        sweeps: Math.max(local.sweeps || 0, cloud.sweeps || 0),
        swept: Math.max(local.swept || 0, cloud.swept || 0),
    };
}

/**
 * Merge all local stats with cloud stats
 */
export function mergeAllStats(localStats: Record<string, PlayerStats>, cloudStats: Record<string, PlayerStats>): Record<string, PlayerStats> {
    const merged: Record<string, PlayerStats> = { ...cloudStats };

    // Merge each player's local stats with cloud
    Object.keys(localStats).forEach(playerName => {
        if (merged[playerName]) {
            merged[playerName] = mergePlayerStats(localStats[playerName], merged[playerName]);
        } else {
            merged[playerName] = localStats[playerName];
        }
    });

    return merged;
}
