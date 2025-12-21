import { Card, Suit, Rank } from '../types/game';

const RANK_VALUES: Record<Rank, number> = {
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
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

export const shouldCallTrump = (hand: Card[], suit: Suit): boolean => {
    let count = 0;
    hand.forEach(card => {
        const effectiveSuit = getEffectiveSuit(card, suit);
        if (effectiveSuit === suit) {
            count++;
        }
        if (card.rank === 'J' && card.suit === suit) count += 1;
        if (card.rank === 'A' && card.suit === suit) count += 0.5;
    });

    return count >= 3;
};

export const getBestBid = (hand: Card[]): Suit | null => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    let bestSuit: Suit | null = null;
    let maxStrength = 0;

    suits.forEach(suit => {
        let strength = 0;
        hand.forEach(card => {
            const effectiveSuit = getEffectiveSuit(card, suit);
            if (effectiveSuit === suit) {
                strength += 1;
                if (card.rank === 'J') strength += 1;
                if (card.rank === 'A') strength += 0.5;
            }
        });

        if (strength > maxStrength && strength >= 3) {
            maxStrength = strength;
            bestSuit = suit;
        }
    });

    return bestSuit;
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
    return [...hand].sort((a, b) => {
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
