import { supabase } from '../lib/supabase';
import { PlayerStats } from '../types/game';

// Convert between camelCase (app) and snake_case (database)
function toSnakeCase(stats: PlayerStats) {
    return {
        games_played: stats.gamesPlayed,
        games_won: stats.gamesWon,
        hands_played: stats.handsPlayed,
        hands_won: stats.handsWon,
        tricks_played: stats.tricksPlayed,
        tricks_taken: stats.tricksTaken,
        tricks_won_team: stats.tricksWonTeam,
        calls_made: stats.callsMade,
        calls_won: stats.callsWon,
        loners_attempted: stats.lonersAttempted,
        loners_converted: stats.lonersConverted,
        euchres_made: stats.euchresMade,
        euchred: stats.euchred,
        sweeps: stats.sweeps,
        swept: stats.swept,
    };
}

function fromSnakeCase(dbStats: any): PlayerStats {
    return {
        gamesPlayed: dbStats.games_played || 0,
        gamesWon: dbStats.games_won || 0,
        handsPlayed: dbStats.hands_played || 0,
        handsWon: dbStats.hands_won || 0,
        tricksPlayed: dbStats.tricks_played || 0,
        tricksTaken: dbStats.tricks_taken || 0,
        tricksWonTeam: dbStats.tricks_won_team || 0,
        callsMade: dbStats.calls_made || 0,
        callsWon: dbStats.calls_won || 0,
        lonersAttempted: dbStats.loners_attempted || 0,
        lonersConverted: dbStats.loners_converted || 0,
        euchresMade: dbStats.euchres_made || 0,
        euchred: dbStats.euchred || 0,
        sweeps: dbStats.sweeps || 0,
        swept: dbStats.swept || 0,
    };
}

/**
 * Get all player stats from Supabase (global leaderboard)
 */
export async function getAllPlayerStats(): Promise<Record<string, PlayerStats>> {
    try {
        const { data, error } = await supabase
            .from('player_stats')
            .select('*');

        if (error) {
            console.error('[SUPABASE STATS] Error fetching stats:', error);
            return {};
        }

        const stats: Record<string, PlayerStats> = {};
        data?.forEach((row: any) => {
            stats[row.player_name] = fromSnakeCase(row);
        });

        return stats;
    } catch (err) {
        console.error('[SUPABASE STATS] Exception fetching stats:', err);
        return {};
    }
}

/**
 * Save or update player stats in Supabase
 */
export async function savePlayerStats(playerName: string, stats: PlayerStats): Promise<boolean> {
    try {
        const dbStats = {
            player_name: playerName,
            ...toSnakeCase(stats)
        };

        const { error } = await supabase
            .from('player_stats')
            .upsert(dbStats, {
                onConflict: 'player_name'
            });

        if (error) {
            console.error(`[SUPABASE STATS] Error saving stats for ${playerName}:`, error);
            return false;
        }

        return true;
    } catch (err) {
        console.error(`[SUPABASE STATS] Exception saving stats for ${playerName}:`, err);
        return false;
    }
}

/**
 * Save multiple player stats in batch (more efficient)
 */
export async function saveMultiplePlayerStats(statsMap: Record<string, PlayerStats>): Promise<boolean> {
    try {
        const dbStatsArray = Object.entries(statsMap).map(([playerName, stats]) => ({
            player_name: playerName,
            ...toSnakeCase(stats)
        }));

        const { error } = await supabase
            .from('player_stats')
            .upsert(dbStatsArray, {
                onConflict: 'player_name'
            });

        if (error) {
            console.error('[SUPABASE STATS] Error batch saving stats:', error);
            return false;
        }

        console.log(`[SUPABASE STATS] Successfully saved stats for ${dbStatsArray.length} players`);
        return true;
    } catch (err) {
        console.error('[SUPABASE STATS] Exception batch saving stats:', err);
        return false;
    }
}

/**
 * Clear all player stats (admin function)
 */
export async function clearAllPlayerStats(): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('player_stats')
            .delete()
            .neq('player_name', ''); // Delete all rows

        if (error) {
            console.error('[SUPABASE STATS] Error clearing stats:', error);
            return false;
        }

        console.log('[SUPABASE STATS] All stats cleared successfully');
        return true;
    } catch (err) {
        console.error('[SUPABASE STATS] Exception clearing stats:', err);
        return false;
    }
}
