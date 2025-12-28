import { Card } from '../types/game';

export interface TrumpCallLog {
    whoCalled: string;
    userType: 'Human' | 'Bot';
    dealer: string;
    cardPickedUp: string; // "n/a" if called in second round
    suitCalled: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
    bowerCount: number;
    trumpCount: number;
    suitCount: number;
    handAfterDiscard: string; // Comma-separated card codes
    timestamp: number;
    gameId: string;
}

/**
 * Count bowers in hand for a given trump suit
 */
export function countBowers(hand: Card[], trumpSuit: string): number {
    let count = 0;
    const suitMap: Record<string, string> = {
        'hearts': 'diamonds',
        'diamonds': 'hearts',
        'clubs': 'spades',
        'spades': 'clubs'
    };
    const oppositeSuit = suitMap[trumpSuit.toLowerCase()];

    hand.forEach(card => {
        // Right bower (Jack of trump suit)
        if (card.rank === 'J' && card.suit.toLowerCase() === trumpSuit.toLowerCase()) {
            count++;
        }
        // Left bower (Jack of same color)
        if (card.rank === 'J' && card.suit.toLowerCase() === oppositeSuit) {
            count++;
        }
    });

    return count;
}

/**
 * Count trump cards (including bowers)
 */
export function countTrump(hand: Card[], trumpSuit: string): number {
    const suitMap: Record<string, string> = {
        'hearts': 'diamonds',
        'diamonds': 'hearts',
        'clubs': 'spades',
        'spades': 'clubs'
    };
    const oppositeSuit = suitMap[trumpSuit.toLowerCase()];

    return hand.filter(card => {
        // Card is trump suit (but not left bower)
        if (card.suit.toLowerCase() === trumpSuit.toLowerCase()) return true;
        // Left bower
        if (card.rank === 'J' && card.suit.toLowerCase() === oppositeSuit) return true;
        return false;
    }).length;
}

/**
 * Count cards of the called suit (before trump is established)
 */
export function countSuit(hand: Card[], suit: string): number {
    return hand.filter(card => card.suit.toLowerCase() === suit.toLowerCase()).length;
}

/**
 * Format a card for display (e.g., "JD" for Jack of Diamonds)
 */
export function formatCard(card: Card): string {
    const suitMap: Record<string, string> = {
        'hearts': 'H',
        'diamonds': 'D',
        'clubs': 'C',
        'spades': 'S'
    };
    // card.rank is already 'J', 'Q', 'K', 'A', '10', '9' - just use it directly
    return `${card.rank}${suitMap[card.suit.toLowerCase()]}`;
}

/**
 * Format hand as comma-separated cards
 */
export function formatHand(hand: Card[]): string {
    return hand.map(formatCard).join(', ');
}

/**
 * Convert trump call logs to CSV
 */
export function trumpCallsToCSV(logs: TrumpCallLog[]): string {
    const headers = [
        'WHO_CALLED_TRUMP',
        'USER_TYPE',
        'DEALER',
        'CARD_PICKED_UP',
        'SUIT_CALLED',
        'BOWER_COUNT',
        'TRUMP_COUNT',
        'SUIT_COUNT',
        'HAND_AFTER_DISCARD'
    ];

    const rows = logs.map(log => [
        log.whoCalled,
        log.userType,
        log.dealer,
        log.cardPickedUp,
        log.suitCalled,
        log.bowerCount.toString(),
        log.trumpCount.toString(),
        log.suitCount.toString(),
        log.handAfterDiscard
    ]);

    return [
        headers.join('\t'),
        ...rows.map(row => row.join('\t'))
    ].join('\n');
}

/**
 * Get stored trump call logs from localStorage
 */
export function getTrumpCallLogs(): TrumpCallLog[] {
    const stored = localStorage.getItem('euchre_trump_calls');
    return stored ? JSON.parse(stored) : [];
}

/**
 * Save trump call log to both Supabase and localStorage
 */
export async function saveTrumpCallLog(log: TrumpCallLog): Promise<void> {
    // Save to localStorage (backup)
    const logs = getTrumpCallLogs();
    logs.push(log);
    localStorage.setItem('euchre_trump_calls', JSON.stringify(logs));

    // Save to Supabase (primary) - fire and forget
    try {
        const { saveTrumpCall } = await import('./supabaseStats');
        await saveTrumpCall({
            gameId: log.gameId,
            playerName: log.whoCalled,
            seatIndex: 0, // We don't have this in TrumpCallLog, could add if needed
            suit: log.suitCalled.toLowerCase(),
            isLoner: false, // Not tracked in current TrumpCallLog
            pickedUp: log.cardPickedUp !== 'n/a',
            round: log.cardPickedUp !== 'n/a' ? 1 : 2,
            topCard: log.cardPickedUp !== 'n/a' ? log.cardPickedUp : null,
            topCardSuit: null, // Could parse from cardPickedUp if needed
            topCardRank: null  // Could parse from cardPickedUp if needed
        });
    } catch (err) {
        console.error('[TRUMP LOGGER] Failed to save to Supabase:', err);
    }
}

/**
 * Clear all trump call logs
 */
export function clearTrumpCallLogs(): void {
    localStorage.removeItem('euchre_trump_calls');
}

/**
 * Create a trump call log entry from game state
 */
export function createTrumpCallLog(
    caller: any, // Player who called trump
    suit: string,
    dealerName: string,
    dealerRelationship: string,
    upcard: any | null,
    biddingRound: 1 | 2,
    gameId: string
): TrumpCallLog {
    const callerName = caller.name || 'Bot';
    const userType: 'Human' | 'Bot' = caller.isComputer ? 'Bot' : 'Human';

    // Card picked up (only in round 1)
    const cardPickedUp = biddingRound === 1 && upcard
        ? formatCard(upcard)
        : 'n/a';

    // Get caller's hand before any modifications
    const hand = caller.hand || [];

    // Count stats
    const bowerCount = countBowers(hand, suit);
    const trumpCount = countTrump(hand, suit);
    const suitCount = countSuit(hand, suit);

    // Format hand
    const handAfterDiscard = formatHand(hand);

    // Dealer string with relationship
    const dealer = `${dealerRelationship} - ${dealerName}`;

    return {
        whoCalled: callerName,
        userType,
        dealer,
        cardPickedUp,
        suitCalled: (suit.charAt(0).toUpperCase() + suit.slice(1)) as 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades',
        bowerCount,
        trumpCount,
        suitCount,
        handAfterDiscard,
        timestamp: Date.now(),
        gameId
    };
}

