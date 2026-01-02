import { supabase } from '../lib/supabase';
import { GameState } from '../types/game';

export async function fetchUserCloudGames(currentUser: string): Promise<GameState[]> {
    try {
        // We fetch all recent games and filter. 
        // Note: For a production app, we would have separate columns for players and status
        // to filter efficiently on the server.
        const { data, error } = await supabase
            .from('games')
            .select('state, updated_at')
            .is('deleted_at', null) // EXCLUDE soft-deleted games
            .order('updated_at', { ascending: false })
            .limit(100); // Only look at last 100 games to avoid massive payload

        if (error) {
            console.error('Error fetching cloud games:', error);
            return [];
        }

        if (!data) return [];

        // Filter and Deduplicate
        const seenCodes = new Set<string>();
        const userGames: GameState[] = [];

        data.forEach(g => {
            const state = g.state as GameState;
            if (!state || !state.tableCode) return;
            if (seenCodes.has(state.tableCode)) return;

            const isUserInvolved =
                state.currentUser === currentUser ||
                state.players?.some((p: any) => p.name === currentUser);

            if (isUserInvolved) {
                seenCodes.add(state.tableCode);
                // Ensure updated_at from DB is used as lastActive if missing
                if (!state.lastActive && g.updated_at) {
                    state.lastActive = new Date(g.updated_at).getTime();
                }
                userGames.push(state);
            }
        });

        return userGames;
    } catch (err) {
        console.error('Exception fetching cloud games:', err);
        return [];
    }
}

export function mergeLocalAndCloudGames(localGames: GameState[], cloudGames: GameState[]): GameState[] {
    // Merge cloud and local games, preferring the most recently updated version
    // Use tableCode as the unique key since that's the primary key in Supabase
    const gamesMap = new Map<string, GameState>();

    // Add local games first
    localGames.forEach(g => {
        if (g.tableCode) {
            gamesMap.set(g.tableCode, g);
        }
    });

    // Add/update with cloud games - cloud is always the source of truth
    // Only keep local if cloud doesn't have it OR local is more recent
    cloudGames.forEach(g => {
        if (g.tableCode) {
            const existing = gamesMap.get(g.tableCode);

            // Always use cloud if:
            // 1. Local doesn't exist
            // 2. Cloud is more recent (higher lastActive)
            // 3. Neither has lastActive (cloud is source of truth)
            if (!existing) {
                gamesMap.set(g.tableCode, g);
            } else if (g.lastActive && existing.lastActive) {
                // Both have timestamps - use the more recent one
                if (g.lastActive >= existing.lastActive) {
                    gamesMap.set(g.tableCode, g);
                }
            } else if (g.lastActive && !existing.lastActive) {
                // Cloud has timestamp, local doesn't - use cloud
                gamesMap.set(g.tableCode, g);
            }
            // else: local has timestamp but cloud doesn't - keep local
        }
    });

    return Array.from(gamesMap.values())
        .sort((a, b) => {
            if (a.lastActive && b.lastActive) return b.lastActive - a.lastActive;
            const phaseOrder = ['lobby', 'randomizing_dealer', 'bidding', 'discard', 'playing', 'waiting_for_trick', 'scoring', 'waiting_for_next_deal', 'game_over'];
            return phaseOrder.indexOf(b.phase) - phaseOrder.indexOf(a.phase);
        });
}
