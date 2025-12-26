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
        'Hearts': 'Diamonds',
        'Diamonds': 'Hearts',
        'Clubs': 'Spades',
        'Spades': 'Clubs'
    };
    const oppositeSuit = suitMap[trumpSuit];

    hand.forEach(card => {
        // Right bower (Jack of trump suit)
        if (card.rank === 'Jack' && card.suit === trumpSuit) {
            count++;
        }
        // Left bower (Jack of same color)
        if (card.rank === 'Jack' && card.suit === oppositeSuit) {
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
        'Hearts': 'Diamonds',
        'Diamonds': 'Hearts',
        'Clubs': 'Spades',
        'Spades': 'Clubs'
    };
    const oppositeSuit = suitMap[trumpSuit];

    return hand.filter(card => {
        // Card is trump suit (but not left bower)
        if (card.suit === trumpSuit) return true;
        // Left bower
        if (card.rank === 'Jack' && card.suit === oppositeSuit) return true;
        return false;
    }).length;
}

/**
 * Count cards of the called suit (before trump is established)
 */
export function countSuit(hand: Card[], suit: string): number {
    return hand.filter(card => card.suit === suit).length;
}

/**
 * Format a card for display (e.g., "JD" for Jack of Diamonds)
 */
export function formatCard(card: Card): string {
    const rankMap: Record<string, string> = {
        'Ace': 'A',
        'King': 'K',
        'Queen': 'Q',
        'Jack': 'J',
        '10': '10',
        '9': '9'
    };
    const suitMap: Record<string, string> = {
        'Hearts': 'H',
        'Diamonds': 'D',
        'Clubs': 'C',
        'Spades': 'S'
    };
    return `${rankMap[card.rank]}${suitMap[card.suit]}`;
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
 * Save trump call log
 */
export function saveTrumpCallLog(log: TrumpCallLog): void {
    const logs = getTrumpCallLogs();
    logs.push(log);
    localStorage.setItem('euchre_trump_calls', JSON.stringify(logs));
}

/**
 * Clear all trump call logs
 */
export function clearTrumpCallLogs(): void {
    localStorage.removeItem('euchre_trump_calls');
}
