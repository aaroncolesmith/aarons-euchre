import { supabase } from '../lib/supabase.ts';

export interface PlayEvent {
    gameCode: string;
    handNumber: number;
    trickNumber?: number;
    eventType: 'game_start' | 'deal' | 'bid' | 'pass' | 'trump_set' | 'play_card' | 'trick_won' | 'hand_won' | 'game_won';
    eventData: any;
    playerName?: string;
    playerSeat?: number;
}

// Global queue for asynchronous event batching
let eventQueue: PlayEvent[] = [];
let isFlushing = false;
let flushIntervalId: any = null;
const FLUSH_INTERVAL_MS = 3000;

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
    eventQueue.push(event);
    initFlushInterval();
    return true; // Return immediately to unblock main thread
}

/**
 * Queues multiple events at once to be batched and logged asynchronously.
 */
export async function logPlayEvents(events: PlayEvent[]): Promise<boolean> {
    eventQueue.push(...events);
    initFlushInterval();
    return true; // Return immediately to unblock main thread
}
