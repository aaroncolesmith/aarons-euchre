import { supabase } from '../lib/supabase';

export interface PlayEvent {
    gameCode: string;
    handNumber: number;
    trickNumber?: number;
    eventType: 'game_start' | 'deal' | 'bid' | 'pass' | 'trump_set' | 'play_card' | 'trick_won' | 'hand_won' | 'game_won';
    eventData: any;
    playerName?: string;
    playerSeat?: number;
}

/**
 * Log a play event to Supabase for event sourcing
 * All stats can be derived from these raw events
 */
export async function logPlayEvent(event: PlayEvent): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('play_events')
            .insert({
                game_code: event.gameCode,
                hand_number: event.handNumber,
                trick_number: event.trickNumber,
                event_type: event.eventType,
                event_data: event.eventData,
                player_name: event.playerName,
                player_seat: event.playerSeat,
            });

        if (error) {
            console.error('[EVENT LOG] Error logging event:', error);
            return false;
        }

        console.log(`[EVENT LOG] ${event.eventType} logged for ${event.gameCode}`);
        return true;
    } catch (err) {
        console.error('[EVENT LOG] Exception logging event:', err);
        return false;
    }
}

/**
 * Batch log multiple events at once (more efficient)
 */
export async function logPlayEvents(events: PlayEvent[]): Promise<boolean> {
    try {
        const rows = events.map(event => ({
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
            return false;
        }

        console.log(`[EVENT LOG] Batch logged ${events.length} events for ${events[0]?.gameCode}`);
        return true;
    } catch (err) {
        console.error('[EVENT LOG] Exception batch logging events:', err);
        return false;
    }
}
