import { supabase } from '../lib/supabase';
import { PlayerStats } from '../types/game';

export const LOCAL_STORAGE_KEY = 'euchre_global_stats_v2';

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
 * SCRUBBING: Fix physically impossible stats (e.g. Mimi's 8850 tricks)
 * Caps tricks at 75 per game and euchres at 15 per game.
 */
export function scrubStats(stats: Record<string, PlayerStats>): Record<string, PlayerStats> {
    return stats; // No more capping. We want 100% accurate recording of what the engine produces.
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

/**
 * Save a trump call to Supabase
 */
export async function saveTrumpCall(trumpCall: any): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('trump_calls')
            .insert({
                game_id: trumpCall.gameId,
                player_name: trumpCall.playerName,
                seat_index: trumpCall.seatIndex,
                suit: trumpCall.suit,
                is_loner: trumpCall.isLoner,
                picked_up: trumpCall.pickedUp,
                round: trumpCall.round,
                top_card: trumpCall.topCard,
                top_card_suit: trumpCall.topCardSuit,
                top_card_rank: trumpCall.topCardRank,
                // NEW ANALYTICS FIELDS
                user_type: trumpCall.userType || 'Human',
                dealer: trumpCall.dealer,
                dealer_relationship: trumpCall.dealerRelationship,
                bower_count: trumpCall.bowerCount || 0,
                trump_count: trumpCall.trumpCount || 0,
                suit_count: trumpCall.suitCount || 0,
                hand_after_discard: trumpCall.handAfterDiscard || ''
            });

        if (error) {
            console.error('[SUPABASE TRUMP] Error saving trump call:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[SUPABASE TRUMP] Exception saving trump call:', err);
        return false;
    }
}

/**
 * Get all trump calls from Supabase
 */
export async function getAllTrumpCalls(): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('trump_calls')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[SUPABASE TRUMP] Error fetching trump calls:', error);
            return [];
        }

        // Convert snake_case back to camelCase AND map to TrumpCallLog format
        return data?.map((row: any) => {
            // Reconstruct dealer string with relationship
            const dealerStr = row.dealer_relationship
                ? `${row.dealer_relationship} - ${row.dealer}`
                : row.dealer || 'Unknown';

            return {
                // Map to TrumpCallLog interface expected by UI
                gameId: row.game_id,
                whoCalled: row.player_name,
                userType: row.user_type || 'Human',
                dealer: dealerStr,
                cardPickedUp: row.picked_up ? (row.top_card || 'n/a') : 'n/a',
                suitCalled: row.suit ? (row.suit.charAt(0).toUpperCase() + row.suit.slice(1)) : 'Unknown',
                bowerCount: row.bower_count || 0,
                trumpCount: row.trump_count || 0,
                suitCount: row.suit_count || 0,
                handAfterDiscard: row.hand_after_discard || '',
                timestamp: row.created_at,
                // Keep original fields for reference
                id: row.id,
                seatIndex: row.seat_index,
                isLoner: row.is_loner,
                round: row.round,
            };
        }) || [];
    } catch (err) {
        console.error('[SUPABASE TRUMP] Exception fetching trump calls:', err);
        return [];
    }
}


/**
 * Save a bot decision to Supabase for global auditing
 */
export async function saveBotDecision(decision: {
    gameCode: string;
    playerName: string;
    archetype: string;
    decisionType: 'bid' | 'play' | 'discard' | 'pass';
    decision: string;
    reasoning: string;
    handStrength?: number;
    currentScoreUs?: number;
    currentScoreThem?: number;
    gamePhase?: string;
    handState?: any;
    tableState?: any;
    aggressiveness?: number;
    riskTolerance?: number;
    consistency?: number;
}): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('bot_decisions')
            .insert({
                game_code: decision.gameCode,
                player_name: decision.playerName,
                archetype: decision.archetype,
                decision_type: decision.decisionType,
                decision: decision.decision,
                reasoning: decision.reasoning,
                hand_strength: decision.handStrength,
                current_score_us: decision.currentScoreUs,
                current_score_them: decision.currentScoreThem,
                game_phase: decision.gamePhase,
                hand_state: decision.handState,
                table_state: decision.tableState,
                aggressiveness: decision.aggressiveness,
                risk_tolerance: decision.riskTolerance,
                consistency: decision.consistency
            });

        if (error) {
            console.error('[SUPABASE BOT] Error saving bot decision:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[SUPABASE BOT] Exception saving bot decision:', err);
        return false;
    }
}

export const getBotDecisions = async (limit: number = 100) => {
    try {
        const { data, error } = await supabase
            .from('bot_decisions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching bot decisions:', error);
        return [];
    }
};
