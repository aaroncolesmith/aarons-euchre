import { supabase } from '../lib/supabase';
import { GameState } from '../types/game';

export async function fetchUserCloudGames(currentUser: string): Promise<GameState[]> {
    try {
        const { data, error } = await supabase
            .from('games')
            .select('state')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching cloud games:', error);
            return [];
        }

        if (!data) {
            return [];
        }

        // Filter games where current user is involved
        const userGames = data
            .filter(g =>
                g.state && (
                    g.state.currentUser === currentUser ||
                    g.state.players?.some((p: any) => p.name === currentUser)
                )
            )
            .map(g => g.state as GameState);

        console.log(`[CloudGames] Fetched ${userGames.length} games from Supabase for ${currentUser}`);
        userGames.forEach(g => {
            console.log(`  [Cloud] ${g.tableName} | Code: ${g.tableCode} | ID: ${g.tableId} | Phase: ${g.phase} | LastActive: ${g.lastActive ? new Date(g.lastActive).toLocaleString() : 'N/A'}`);
        });

        return userGames;
    } catch (err) {
        console.error('Exception fetching cloud games:', err);
        return [];
    }
}

export function mergeLocalAndCloudGames(localGames: GameState[], cloudGames: GameState[]): GameState[] {
    console.log(`[Merge] Starting merge: ${localGames.length} local + ${cloudGames.length} cloud`);

    // Log local games
    localGames.forEach(g => {
        console.log(`  [Local] ${g.tableName} | Code: ${g.tableCode} | ID: ${g.tableId} | LastActive: ${g.lastActive ? new Date(g.lastActive).toLocaleString() : 'N/A'}`);
    });

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
                console.log(`  [Merge] Adding cloud game: ${g.tableName} (${g.tableCode})`);
                gamesMap.set(g.tableCode, g);
            } else if (g.lastActive && existing.lastActive) {
                // Both have timestamps - use the more recent one
                if (g.lastActive >= existing.lastActive) {
                    console.log(`  [Merge] Replacing with cloud (newer): ${g.tableName} (${g.tableCode})`);
                    gamesMap.set(g.tableCode, g);
                } else {
                    console.log(`  [Merge] Keeping local (newer): ${g.tableName} (${g.tableCode})`);
                }
            } else if (g.lastActive && !existing.lastActive) {
                // Cloud has timestamp, local doesn't - use cloud
                console.log(`  [Merge] Replacing with cloud (has timestamp): ${g.tableName} (${g.tableCode})`);
                gamesMap.set(g.tableCode, g);
            } else {
                console.log(`  [Merge] Keeping local (cloud has no timestamp): ${g.tableName} (${g.tableCode})`);
            }
            // else: local has timestamp but cloud doesn't - keep local
        }
    });

    const result = Array.from(gamesMap.values())
        .sort((a, b) => {
            if (a.lastActive && b.lastActive) return b.lastActive - a.lastActive;
            const phaseOrder = ['lobby', 'randomizing_dealer', 'bidding', 'discard', 'playing', 'waiting_for_trick', 'scoring', 'waiting_for_next_deal', 'game_over'];
            return phaseOrder.indexOf(b.phase) - phaseOrder.indexOf(a.phase);
        });

    console.log(`[Merge] Result: ${result.length} unique games after merge`);
    result.forEach(g => {
        console.log(`  [Result] ${g.tableName} | Code: ${g.tableCode} | Phase: ${g.phase}`);
    });

    return result;
}
