import { Card, Suit, Rank, BotPersonality } from '../types/game';

const RANK_VALUES: Record<Rank, number> = {
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
};

export const BOT_PERSONALITIES: Record<string, BotPersonality> = {
    'Huber': { aggressiveness: 10, riskTolerance: 9, consistency: 3, archetype: 'Hyper-Aggressive / Erratic' },
    'J-Bock': { aggressiveness: 6, riskTolerance: 6, consistency: 9, archetype: 'The "Bible" Scientist' },
    'Wooden': { aggressiveness: 2, riskTolerance: 2, consistency: 10, archetype: 'The Defensive Rock' },
    'Moses': { aggressiveness: 5, riskTolerance: 5, consistency: 5, archetype: 'Balanced' },
    'Fizz': { aggressiveness: 8, riskTolerance: 4, consistency: 7, archetype: 'Aggressive but Disciplined' },
    'Buff': { aggressiveness: 4, riskTolerance: 8, consistency: 4, archetype: 'Low Bidding / High Risk Play' }
};

const getCardColor = (suit: Suit): 'red' | 'black' => {
    return (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
};

export const getCardValue = (card: Card, trump: Suit | null, leadSuit: Suit | null): number => {
    if (!trump) {
        if (leadSuit && card.suit === leadSuit) {
            return RANK_VALUES[card.rank] + 100;
        }
        return RANK_VALUES[card.rank];
    }

    const cardColor = getCardColor(card.suit);
    const trumpColor = getCardColor(trump);

    // 1. Right Bower: Jack of Trump
    if (card.rank === 'J' && card.suit === trump) {
        return 1000;
    }

    // 2. Left Bower: Jack of same color as Trump
    if (card.rank === 'J' && cardColor === trumpColor && card.suit !== trump) {
        return 900;
    }

    // 3. Trump Suit
    if (card.suit === trump) {
        return RANK_VALUES[card.rank] + 500;
    }

    // 4. Lead Suit (if not trump)
    if (leadSuit && card.suit === leadSuit) {
        return RANK_VALUES[card.rank] + 100;
    }

    // 5. Off Suit (Trash)
    return RANK_VALUES[card.rank];
};

export const determineWinner = (cardsPlayed: { playerId: string; card: Card }[], trump: Suit, leadSuit: Suit): string => {
    let winningPlayerId = cardsPlayed[0].playerId;
    let highestValue = -1;

    cardsPlayed.forEach(({ playerId, card }) => {
        const value = getCardValue(card, trump, leadSuit);
        if (value > highestValue) {
            highestValue = value;
            winningPlayerId = playerId;
        }
    });

    return winningPlayerId;
};

export const getEffectiveSuit = (card: Card, trump: Suit | null): Suit => {
    if (!trump) return card.suit;

    if (card.rank === 'J') {
        const cardColor = getCardColor(card.suit);
        const trumpColor = getCardColor(trump);
        if (cardColor === trumpColor) {
            return trump;
        }
    }

    return card.suit;
};

export const isValidPlay = (
    cardToPlay: Card,
    hand: Card[],
    leadSuit: Suit | null,
    trump: Suit | null
): boolean => {
    if (!leadSuit) return true;

    const effectiveCardSuit = getEffectiveSuit(cardToPlay, trump);
    if (effectiveCardSuit === leadSuit) return true;

    const hasLeadSuit = hand.some(c => getEffectiveSuit(c, trump) === leadSuit);
    if (hasLeadSuit) return false;

    return true;
};

/**
 * Calculate hand strength based on the "Bible" weighting system.
 * 
 * Bible Points:
 * - Right Bower: 3.0
 * - Left Bower: 2.5
 * - Trump Ace: 2.0
 * - Trump K/Q/10/9: 1.0 - 0.5
 * - Off-Suit Ace: 1.0
 * - Void Bonus: +0.8 (creates ruffing opportunities)
 */
export const calculateBibleHandStrength = (hand: Card[], suit: Suit): { total: number; reasoning: string } => {
    let score = 0;
    const reasons: string[] = [];
    const oppositeSuit = getOppositeSuit(suit);

    // Filter cards to see what we have in the target suit
    hand.forEach(card => {
        const isRight = card.rank === 'J' && card.suit === suit;
        const isLeft = card.rank === 'J' && card.suit === oppositeSuit;
        const isTrump = card.suit === suit || isLeft;

        if (isRight) {
            score += 3.0;
            reasons.push('Right Bower (+3.0)');
        } else if (isLeft) {
            score += 2.5;
            reasons.push('Left Bower (+2.5)');
        } else if (isTrump) {
            if (card.rank === 'A') { score += 2.0; reasons.push('Trump Ace (+2.0)'); }
            else if (card.rank === 'K') { score += 1.0; reasons.push('Trump King (+1.0)'); }
            else { score += 0.5; reasons.push(`Trump ${card.rank} (+0.5)`); }
        } else if (card.rank === 'A') {
            score += 1.0;
            reasons.push(`Off-suit Ace of ${card.suit} (+1.0)`);
        }
    });

    // Void Bonus
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    suits.forEach(s => {
        if (s === suit) return; // Don't check target trump suit for voids
        const count = hand.filter(c => {
            // Left bower is effectively part of the trump suit
            if (c.rank === 'J' && c.suit === getOppositeSuit(suit)) return false;
            return c.suit === s;
        }).length;

        if (count === 0) {
            score += 0.8;
            reasons.push(`Void in ${s} (+0.8)`);
        }
    });

    return { total: score, reasoning: reasons.join(', ') };
};

const getOppositeSuit = (suit: string): string => {
    const map: Record<string, string> = {
        'hearts': 'diamonds',
        'diamonds': 'hearts',
        'clubs': 'spades',
        'spades': 'clubs'
    };
    return map[suit] || '';
};

export const shouldCallTrump = (
    hand: Card[],
    suit: Suit,
    personality: BotPersonality = { aggressiveness: 5, riskTolerance: 5, consistency: 5, archetype: 'Generic' },
    position: number = 0, // 0: Seat 1, 1: Seat 2, 2: Seat 3, 3: Dealer
    isRound2: boolean = false
): { call: boolean; reasoning: string; strength: number } => {
    const { total, reasoning } = calculateBibleHandStrength(hand, suit);

    // Thresholds based on Aggressiveness (Bible says 7.0 is standard)
    // Range: 5.0 (Hyper-Aggressive) to 9.0 (Conservative)
    let threshold = 7.0 + (5 - personality.aggressiveness) * 0.4;

    // Positional Adjustments
    let posReason = '';
    if (position === 3) { // Dealer
        threshold -= 0.5; // Dealer is more aggressive
        posReason = 'Dealer bonus (-0.5 threshold)';
    } else if (position === 1) { // Dealer's Partner (Assist)
        threshold -= 1.0; // Assist even more aggressively
        posReason = 'Assist bonus (-1.0 threshold)';
    } else if (isRound2 && position === 0) { // Seat 1 in Round 2 (Next Call)
        threshold -= 1.5; // Highly aggressive on "Next"
        posReason = 'Next Call bonus (-1.5 threshold)';
    }

    const call = total >= threshold;
    const finalReasoning = [
        `Strength: ${total.toFixed(1)} (Threshold: ${threshold.toFixed(1)})`,
        reasoning,
        posReason,
        personality.archetype
    ].filter(Boolean).join(' | ');

    return { call, reasoning: finalReasoning, strength: total };
};

export const getBestBid = (
    hand: Card[],
    personality: BotPersonality,
    position: number,
    isRound2: boolean
): { suit: Suit | null; reasoning: string; strength: number } => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    let bestSuit: Suit | null = null;
    let maxStrength = -1;
    let bestReasoning = 'No strong suits found.';

    suits.forEach(suit => {
        const result = shouldCallTrump(hand, suit, personality, position, isRound2);
        if (result.call && result.strength > maxStrength) {
            maxStrength = result.strength;
            bestSuit = suit;
            bestReasoning = result.reasoning;
        }
    });

    return { suit: bestSuit, reasoning: bestReasoning, strength: maxStrength };
};

// --- New AI Logic ---

export const getBotMove = (
    hand: Card[],
    currentTrick: { playerId: string; card: Card }[],
    trump: Suit,
    playerIds: string[],
    myId: string
): Card => {
    const leadCard = currentTrick.length > 0 ? currentTrick[0].card : null;
    const leadSuit = leadCard ? getEffectiveSuit(leadCard, trump) : null;

    const validCards = hand.filter(c => isValidPlay(c, hand, leadSuit, trump));
    if (validCards.length === 0) return hand[0]; // Fallback

    // Determine current winner
    let currentHighValue = -1;
    let currentHighId = '';
    if (currentTrick.length > 0) {
        currentTrick.forEach(p => {
            const val = getCardValue(p.card, trump, leadSuit);
            if (val > currentHighValue) {
                currentHighValue = val;
                currentHighId = p.playerId;
            }
        });
    }

    const myIndex = playerIds.indexOf(myId);
    const partnerId = playerIds[(myIndex + 2) % 4];
    const partnerIsWinning = currentHighId === partnerId;

    // 1. If leading
    if (currentTrick.length === 0) {
        // Find best non-trump Ace, else best Trump
        const nonTrumpAces = validCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
        if (nonTrumpAces.length > 0) return nonTrumpAces[0];

        // Otherwise play highest valid card
        return validCards.sort((a, b) => getCardValue(b, trump, null) - getCardValue(a, trump, null))[0];
    }

    // 2. If partner is winning, throw away lowest card
    if (partnerIsWinning) {
        return validCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit))[0];
    }

    // 3. If partner is not winning, try to win with the lowest possible card
    const winningCards = validCards.filter(c => getCardValue(c, trump, leadSuit) > currentHighValue);
    if (winningCards.length > 0) {
        // Play the LOWEST card that still wins
        return winningCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit))[0];
    }

    // 4. Can't win, play lowest card
    return validCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit))[0];
};

// --- Sorting Utility ---

const SUIT_SORT_ORDER: Record<Suit, number> = {
    'spades': 0,
    'hearts': 1,
    'clubs': 2,
    'diamonds': 3
};

export const sortHand = (hand: Card[], trump: Suit | null): Card[] => {
    // Filter out any undefined or invalid cards
    const validHand = hand.filter(card => card && card.suit && card.rank);

    return [...validHand].sort((a, b) => {
        const suitA = getEffectiveSuit(a, trump);
        const suitB = getEffectiveSuit(b, trump);

        // If same effective suit, sort by rank
        if (suitA === suitB) {
            const valA = getCardValue(a, trump, null);
            const valB = getCardValue(b, trump, null);
            return valB - valA; // High to low
        }

        // If one is trump, it goes first (leftmost)
        if (trump) {
            if (suitA === trump) return -1;
            if (suitB === trump) return 1;
        }

        // Otherwise sort by suit order
        return SUIT_SORT_ORDER[suitA] - SUIT_SORT_ORDER[suitB];
    });
};
