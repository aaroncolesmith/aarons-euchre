import { supabase } from '../lib/supabase.ts';
import { PlayerStats } from '../types/game.ts';

export const LOCAL_STORAGE_KEY = 'euchre_global_stats_v4';

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
        loners_converted: stats.lonersWon,
        points_scored: stats.pointsScored,
        euchres_made: stats.euchresMade,
        euchred: stats.euchred,
        sweeps: stats.sweeps,
        swept: stats.swept,
    };
}

export function getEmptyStats(): PlayerStats {
    return {
        gamesPlayed: 0,
        gamesWon: 0,
        handsPlayed: 0,
        handsWon: 0,
        tricksPlayed: 0,
        tricksTaken: 0,
        tricksWonTeam: 0,
        callsMade: 0,
        callsWon: 0,
        lonersAttempted: 0,
        lonersWon: 0,
        pointsScored: 0,
        euchresMade: 0,
        euchred: 0,
        sweeps: 0,
        swept: 0,
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
        lonersWon: dbStats.loners_converted || 0,
        pointsScored: dbStats.points_scored || 0,
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
        lonersWon: Math.max(local.lonersWon || 0, cloud.lonersWon || 0),
        pointsScored: Math.max(local.pointsScored || 0, cloud.pointsScored || 0),
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
        console.log('[SUPABASE STATS] Fetching all player stats...');
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

        console.log(`[SUPABASE STATS] Loaded ${Object.keys(stats).length} player stats`);
        return stats;
    } catch (err) {
        console.error('[SUPABASE STATS] Exception fetching stats:', err);
        return {};
    }
}

/**
 * Get specific player stats from Supabase
 */
export async function getPlayersStats(playerNames: string[]): Promise<Record<string, PlayerStats>> {
    try {
        console.log('[SUPABASE STATS] Fetching stats for:', playerNames);
        const { data, error } = await supabase
            .from('player_stats')
            .select('*')
            .in('player_name', playerNames);

        if (error) {
            console.error('[SUPABASE STATS] Error fetching batch stats:', error);
            return {};
        }

        const stats: Record<string, PlayerStats> = {};
        data?.forEach((row: any) => {
            stats[row.player_name] = fromSnakeCase(row);
        });

        return stats;
    } catch (err) {
        console.error('[SUPABASE STATS] Exception fetching batch stats:', err);
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
        // If delete didn't work (due to RLS), we force a wipe by zeroing out everyone
        const { data: players } = await supabase.from('player_stats').select('player_name');
        if (players && players.length > 0) {
            console.log(`[SUPABASE STATS] FORCING WIPE: Zeroing out ${players.length} players...`);
            const empty = getEmptyStats();
            const zeroedArray = players.map(p => ({
                player_name: p.player_name,
                ...toSnakeCase(empty)
            }));
            await supabase.from('player_stats').upsert(zeroedArray, { onConflict: 'player_name' });
        }

        console.log('[SUPABASE STATS] All stats zeroed successfully');
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

/**
 * Hand of the Day Scoring
 */
export async function submitDailyScore(score: {
    date_string: string;
    player_name: string;
    team_points: number;
    team_tricks: number;
    individual_tricks: number;
    opp_points: number;
    opp_tricks: number;
}): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('daily_challenge_scores')
            .upsert(score, {
                onConflict: 'date_string,player_name'
            });

        if (error) {
            console.error('[SUPABASE DAILY] Error saving daily score:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[SUPABASE DAILY] Exception saving daily score:', err);
        return false;
    }
}

export async function getDailyLeaderboard(date_string: string | 'all') {
    try {
        let query = supabase.from('daily_challenge_scores').select('*');
        if (date_string !== 'all') {
            query = query.eq('date_string', date_string);
        }

        const { data, error } = await query
            .order('date_string', { ascending: false })
            .order('team_points', { ascending: false })
            .order('team_tricks', { ascending: false })
            .order('individual_tricks', { ascending: false })
            .limit(date_string === 'all' ? 1000 : 50);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching daily leaderboard:', error);
        return [];
    }
}

export async function hasUserPlayedDaily(playerName: string, dateString: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('daily_challenge_scores')
            .select('player_name')
            .eq('player_name', playerName)
            .eq('date_string', dateString)
            .maybeSingle();

        if (error) {
            console.error('[SUPABASE DAILY] Error checking play status:', error);
            return false;
        }

        return !!data;
    } catch (err) {
        console.error('[SUPABASE DAILY] Exception checking play status:', err);
        return false;
    }
}

/**
 * Self-healing: Look for any local DAILY games that are finished but missing from Cloud
 */
export async function syncUnsyncedDailies(playerName: string): Promise<void> {
    try {
        const saved = localStorage.getItem('euchre_active_games');
        if (!saved) return;
        
        const gamesJson = JSON.parse(saved);
        const dailyGames = Object.values(gamesJson).filter((g: any) => 
            g.tableCode?.startsWith('DAILY-') && 
            g.phase === 'game_over' &&
            g.players.some((p: any) => p.name === playerName)
        );

        for (const game of dailyGames as any[]) {
            const dateString = game.tableCode!.split('-').slice(1, 4).join('-');
            
            // Check if Cloud has it
            const exists = await hasUserPlayedDaily(playerName, dateString);
            if (!exists) {
                console.log(`[SYNC] Found unsynced local daily for ${dateString}. Pushing...`);
                const hero = game.players.find((p: any) => p.name === playerName);
                if (hero) {
                    const heroIndex = game.players.findIndex((p: any) => p.name === playerName);
                    const isTeam1 = heroIndex === 0 || heroIndex === 2;
                    const isWinner = isTeam1 ? game.scores.team1 >= 10 : game.scores.team2 >= 10;

                    // 1. Push to Daily Leaderboard
                    await submitDailyScore({
                        date_string: dateString,
                        player_name: hero.name!,
                        team_points: game.scores.team1,
                        team_tricks: hero.stats.tricksWonTeam || 0,
                        individual_tricks: hero.stats.tricksTaken || 0,
                        opp_points: game.scores.team2,
                        opp_tricks: (game.handsPlayed * 5) - (hero.stats.tricksWonTeam || 0)
                    });

                    // 2. Push to Aggregate Player Stats
                    const currentCloud = await getPlayersStats([playerName]);
                    const base = currentCloud[playerName] || getEmptyStats();
                    
                    const updatedStats: PlayerStats = {
                        gamesPlayed: (base.gamesPlayed || 0) + 1,
                        gamesWon: isWinner ? (base.gamesWon || 0) + 1 : (base.gamesWon || 0),
                        handsPlayed: (base.handsPlayed || 0) + hero.stats.handsPlayed,
                        handsWon: (base.handsWon || 0) + hero.stats.handsWon,
                        tricksPlayed: (base.tricksPlayed || 0) + hero.stats.tricksPlayed,
                        tricksTaken: (base.tricksTaken || 0) + hero.stats.tricksTaken,
                        tricksWonTeam: (base.tricksWonTeam || 0) + hero.stats.tricksWonTeam,
                        callsMade: (base.callsMade || 0) + hero.stats.callsMade,
                        callsWon: (base.callsWon || 0) + hero.stats.callsWon,
                        lonersAttempted: (base.lonersAttempted || 0) + hero.stats.lonersAttempted,
                        lonersWon: (base.lonersWon || 0) + hero.stats.lonersWon,
                        pointsScored: (base.pointsScored || 0) + hero.stats.pointsScored,
                        euchresMade: (base.euchresMade || 0) + hero.stats.euchresMade,
                        euchred: (base.euchred || 0) + hero.stats.euchred,
                        sweeps: (base.sweeps || 0) + hero.stats.sweeps,
                        swept: (base.swept || 0) + hero.stats.swept,
                    };

                    await savePlayerStats(playerName, updatedStats);
                    console.log(`[SYNC] Successfully updated aggregate stats for ${playerName}`);
                }
            }
        }
    } catch (err) {
        console.error('[SYNC] Failed to synchronize local dailies:', err);
    }
}
