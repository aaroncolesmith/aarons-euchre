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
 * Count the number of unique effective suits in hand (distribution).
 * Treats the Left Bower as part of the trump suit.
 * A lower number (e.g., 2) is stronger than a higher number (e.g., 4).
 */
export function countSuit(hand: Card[], trumpSuit: string): number {
    const suitMap: Record<string, string> = {
        'hearts': 'diamonds',
        'diamonds': 'hearts',
        'clubs': 'spades',
        'spades': 'clubs'
    };
    const oppositeSuit = suitMap[trumpSuit.toLowerCase()];

    const uniqueSuits = new Set<string>();

    hand.forEach(card => {
        const s = card.suit.toLowerCase();
        // If it's the Left Bower, it's effectively the Trump suit
        if (card.rank === 'J' && s === oppositeSuit) {
            uniqueSuits.add(trumpSuit.toLowerCase());
        } else {
            uniqueSuits.add(s);
        }
    });

    return uniqueSuits.size;
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
 * Sort hand by suit (trump first) and rank (descending), matching UI display
 */
export function sortHandForDisplay(hand: Card[], trumpSuit: string): Card[] {
    const suitMap: Record<string, string> = {
        'hearts': 'diamonds',
        'diamonds': 'hearts',
        'clubs': 'spades',
        'spades': 'clubs'
    };
    const oppositeSuit = suitMap[trumpSuit.toLowerCase()];

    // Rank values for sorting (Ace highest, 9 lowest)
    const rankValue: Record<string, number> = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9
    };

    // Suit order: trump first, then hearts, diamonds, clubs, spades
    const suitOrder: Record<string, number> = {
        [trumpSuit.toLowerCase()]: 0,
        'hearts': 1,
        'diamonds': 2,
        'clubs': 3,
        'spades': 4
    };

    return [...hand].sort((a, b) => {
        // Determine effective suit (left bower counts as trump suit)
        const getSuitForSort = (card: Card) => {
            if (card.rank === 'J' && card.suit.toLowerCase() === oppositeSuit) {
                return trumpSuit.toLowerCase(); // Left bower is trump
            }
            return card.suit.toLowerCase();
        };

        const suitA = getSuitForSort(a);
        const suitB = getSuitForSort(b);

        // Sort by suit first
        if (suitA !== suitB) {
            return (suitOrder[suitA] || 999) - (suitOrder[suitB] || 999);
        }

        // Within same suit, sort by rank (descending - high to low)
        // Right bower (J of trump) is highest
        const isRightBowerA = a.rank === 'J' && a.suit.toLowerCase() === trumpSuit.toLowerCase();
        const isRightBowerB = b.rank === 'J' && b.suit.toLowerCase() === trumpSuit.toLowerCase();

        if (isRightBowerA) return -1;
        if (isRightBowerB) return 1;

        // Left bower (J of opposite color) is second highest in trump
        const isLeftBowerA = a.rank === 'J' && a.suit.toLowerCase() === oppositeSuit;
        const isLeftBowerB = b.rank === 'J' && b.suit.toLowerCase() === oppositeSuit;

        if (isLeftBowerA && suitA === trumpSuit.toLowerCase()) return -1;
        if (isLeftBowerB && suitB === trumpSuit.toLowerCase()) return 1;

        // Normal rank comparison (high to low)
        return (rankValue[b.rank] || 0) - (rankValue[a.rank] || 0);
    });
}

/**
 * Format hand as comma-separated cards (sorted like UI display)
 */
export function formatHand(hand: Card[], trumpSuit: string): string {
    const sortedHand = sortHandForDisplay(hand, trumpSuit);
    return sortedHand.map(formatCard).join(', ');
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

        // Parse dealer name and relationship from dealer string
        // Format: "relationship - dealerName" (e.g., "Teammate - Aaron")
        const dealerParts = log.dealer.split(' - ');
        const dealerRelationship = dealerParts.length > 1 ? dealerParts[0] : '';
        const dealerName = dealerParts.length > 1 ? dealerParts[1] : log.dealer;

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
            topCardRank: null,  // Could parse from cardPickedUp if needed
            // ANALYTICS FIELDS - Now saving complete data!
            userType: log.userType,
            dealer: dealerName,
            dealerRelationship: dealerRelationship,
            bowerCount: log.bowerCount,
            trumpCount: log.trumpCount,
            suitCount: log.suitCount,
            handAfterDiscard: log.handAfterDiscard
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
    gameId: string,
    handAfterPickup?: Card[] // Optional: dealer's hand AFTER picking up card (for round 1 dealer pickup)
): TrumpCallLog {
    const callerName = caller.name || 'Bot';
    const userType: 'Human' | 'Bot' = caller.isComputer ? 'Bot' : 'Human';

    // Card picked up (only in round 1)
    const cardPickedUp = biddingRound === 1 && upcard
        ? formatCard(upcard)
        : 'n/a';

    // Get caller's hand - use handAfterPickup if provided (dealer pickup case)
    // Otherwise use caller's current hand
    const hand = handAfterPickup || caller.hand || [];

    // Count stats
    const bowerCount = countBowers(hand, suit);
    const trumpCount = countTrump(hand, suit);
    const suitCount = countSuit(hand, suit);

    // Format hand (sorted by suit and rank like UI)
    const handAfterDiscard = formatHand(hand, suit);

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

