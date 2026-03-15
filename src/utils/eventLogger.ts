import { supabase } from '../lib/supabase.ts';
import { Action } from '../types/game.ts';

export interface PlayEvent {
    gameCode: string;
    handNumber: number;
    trickNumber?: number;
    eventType: string;
    eventData: any;
    playerName?: string;
    playerSeat?: number;
    stateVersion?: number;
    action?: Action;
}

// Global queue for asynchronous event batching
let eventQueue: PlayEvent[] = [];
let isFlushing = false;
let flushIntervalId: any = null;
const FLUSH_INTERVAL_MS = 3000;

function shouldLogEvent(gameCode?: string) {
    return !!gameCode && gameCode.startsWith('DAILY-');
}

/**
 * Initializes the background flush interval if not already running.
 */
function initFlushInterval() {
    if (!flushIntervalId && typeof window !== 'undefined') {
        flushIntervalId = setInterval(flushPlayEvents, FLUSH_INTERVAL_MS);
    }
}

/**
 * Flushes all pending events to Supabase asynchronously.
 */
export async function flushPlayEvents(): Promise<void> {
    if (isFlushing || eventQueue.length === 0) return;

    isFlushing = true;
    const batch = [...eventQueue];
    eventQueue = []; // Clear queue immediately

    try {
        const rows = batch.map(event => ({
            game_code: event.gameCode,
            hand_number: event.handNumber,
            trick_number: event.trickNumber,
            event_type: event.eventType,
            event_data: event.eventData,
            player_name: event.playerName,
            player_seat: event.playerSeat,
        }));

        const { error } = await supabase
            .from('play_events')
            .insert(rows);

        if (error) {
            console.error('[EVENT LOG] Error batch logging events:', error);
            // Re-queue the failed events at the front to retry
            eventQueue = [...batch, ...eventQueue];
        } else {
            console.log(`[EVENT LOG] Async flushed ${batch.length} events for ${batch[0]?.gameCode}`);
        }
    } catch (err) {
        console.error('[EVENT LOG] Exception flushing play events:', err);
        // Re-queue on exception
        eventQueue = [...batch, ...eventQueue];
    } finally {
        isFlushing = false;
    }
}

/**
 * Queues a play event to be batched and logged asynchronously.
 * This prevents UI micro-stutters during intense bot play.
 */
export async function logPlayEvent(event: PlayEvent): Promise<boolean> {
    if (!shouldLogEvent(event.gameCode)) return true;
    eventQueue.push(event);
    initFlushInterval();
    return true; // Return immediately to unblock main thread
}

/**
 * Queues multiple events at once to be batched and logged asynchronously.
 */
export async function logPlayEvents(events: PlayEvent[]): Promise<boolean> {
    const filtered = events.filter(e => shouldLogEvent(e.gameCode));
    if (filtered.length === 0) return true;
    eventQueue.push(...filtered);
    initFlushInterval();
    return true; // Return immediately to unblock main thread
}
/**
 * Fetches the event stream for a specific game code.
 */
export async function fetchPlayEvents(gameCode: string): Promise<PlayEvent[]> {
    const { data, error } = await supabase
        .from('play_events')
        .select('*')
        .eq('game_code', gameCode)
        .order('state_version', { ascending: true });

    if (error) {
        console.error('[EVENT LOG] Error fetching play events:', error);
        return [];
    }

    return (data || []).map(row => ({
        gameCode: row.game_code,
        handNumber: row.hand_number,
        trickNumber: row.trick_number,
        eventType: row.event_type,
        eventData: row.event_data,
        playerName: row.player_name,
        playerSeat: row.player_seat,
        stateVersion: row.state_version,
        action: row.action_payload // The full action object
    } as any));
}
