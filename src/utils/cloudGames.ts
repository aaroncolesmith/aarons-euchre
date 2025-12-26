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

        return userGames;
    } catch (err) {
        console.error('Exception fetching cloud games:', err);
        return [];
    }
}

export function mergeLocalAndCloudGames(localGames: GameState[], cloudGames: GameState[]): GameState[] {
    // Merge cloud and local games, preferring the most recently updated version
    const gamesMap = new Map<string, GameState>();

    // Add local games first
    localGames.forEach(g => {
        if (g.tableId) {
            gamesMap.set(g.tableId, g);
        }
    });

    // Add/update with cloud games if they're more recent
    cloudGames.forEach(g => {
        if (g.tableId) {
            const existing = gamesMap.get(g.tableId);
            if (!existing || (g.lastActive && existing.lastActive && g.lastActive > existing.lastActive)) {
                gamesMap.set(g.tableId, g);
            }
        }
    });

    return Array.from(gamesMap.values())
        .sort((a, b) => {
            if (a.lastActive && b.lastActive) return b.lastActive - a.lastActive;
            const phaseOrder = ['lobby', 'randomizing_dealer', 'bidding', 'discard', 'playing', 'waiting_for_trick', 'scoring', 'waiting_for_next_deal', 'game_over'];
            return phaseOrder.indexOf(b.phase) - phaseOrder.indexOf(a.phase);
        });
}
