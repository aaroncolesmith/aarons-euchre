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
    isRound2: boolean = false,
    turnedDownSuit: Suit | null = null
): { call: boolean; reasoning: string; strength: number } => {
    const { total, reasoning } = calculateBibleHandStrength(hand, suit);

    // CRITICAL: Count actual trumps (including Left Bower)
    const oppositeSuit = getOppositeSuit(suit);
    const trumpCards = hand.filter(c => c.suit === suit || (c.rank === 'J' && c.suit === oppositeSuit));
    const trumpCount = trumpCards.length;
    const hasRight = hand.some(c => c.rank === 'J' && c.suit === suit);

    // Thresholds based on Aggressiveness (Bible says 7.0 is standard)
    // Range: 5.0 (Hyper-Aggressive) to 9.0 (Conservative)
    let threshold = 7.0 + (5 - personality.aggressiveness) * 0.4;

    // Positional Adjustments
    // position: 1=S1, 2=S2 (Partner), 3=S3, 0=Dealer
    let posReason = '';
    if (position === 0) { // Dealer
        threshold -= 0.5;
        posReason = 'Dealer bonus (-0.5 threshold)';
    } else if (position === 2) { // Dealer's Partner (Assist)
        threshold -= 1.0;
        posReason = 'Assist bonus (-1.0 threshold)';
    }

    // NEXT CALL logic: Seat 1 in Round 2 gets a bonus ONLY for the same color suit
    const isNextSuit = isRound2 && position === 1 && turnedDownSuit && getCardColor(suit) === getCardColor(turnedDownSuit);
    if (isNextSuit) {
        threshold -= 1.5;
        posReason = 'Next Call bonus (-1.5 threshold)';
    }

    // MINIMUM TRUMP REQUIREMENT
    let call = total >= threshold;
    let fallbackReason = '';
    if (call && trumpCount < 2) {
        const isPowerhouseHand = hasRight && total >= 8.5; // Right Bower + 3 Aces + Voids
        if (!isPowerhouseHand) {
            call = false;
            fallbackReason = ` | BLOCKED: ${trumpCount} trump is not enough without massive power`;
        }
    }
    const finalReasoning = [
        `Strength: ${total.toFixed(1)} (Threshold: ${threshold.toFixed(1)})`,
        reasoning,
        posReason,
        fallbackReason,
        personality.archetype
    ].filter(Boolean).join(' | ');

    return { call, reasoning: finalReasoning, strength: total };
};

/**
 * Determine if bot should go alone
 * Conservative threshold: 10.5+ (Both bowers + Ace, or equivalent)
 * Aggressive personalities will go alone with slightly less
 */
export const shouldGoAlone = (
    hand: Card[],
    suit: Suit,
    personality: BotPersonality = { aggressiveness: 5, riskTolerance: 5, consistency: 5, archetype: 'Generic' }
): { goAlone: boolean; reasoning: string } => {
    const { total, reasoning } = calculateBibleHandStrength(hand, suit);

    // Count trump cards including left bower
    const oppositeSuit = getOppositeSuit(suit);
    const trumpCards = hand.filter(c => c.suit === suit || (c.rank === 'J' && c.suit === oppositeSuit));
    const trumpCount = trumpCards.length;

    // Check for key cards
    const hasRightBower = hand.some(c => c.rank === 'J' && c.suit === suit);
    const hasLeftBower = hand.some(c => c.rank === 'J' && c.suit === oppositeSuit);
    const hasTrumpAce = hand.some(c => c.rank === 'A' && c.suit === suit);
    const bowerCount = (hasRightBower ? 1 : 0) + (hasLeftBower ? 1 : 0);

    // Base loner threshold: 10.5 (Conservative - both bowers + ace level)
    // Aggressiveness adjusts threshold: More aggressive = lower threshold
    let lonerThreshold = 11.0 - (personality.aggressiveness - 5) * 0.3;

    // MUST have at least 3 trump to go alone
    if (trumpCount < 3) {
        return {
            goAlone: false,
            reasoning: `Only ${trumpCount} trump - need at least 3 to go alone`
        };
    }

    // Strong loner indicators
    const hasBothBowers = hasRightBower && hasLeftBower;
    const hasThreeTopTrump = hasBothBowers && hasTrumpAce;

    // Bonus for having both bowers - nearly guaranteed 2 tricks
    if (hasBothBowers) {
        lonerThreshold -= 1.0;
    }

    // Decision logic
    const shouldGo = total >= lonerThreshold;

    let lonerReason = '';
    if (shouldGo) {
        const indicators = [];
        if (hasBothBowers) indicators.push('Both Bowers');
        if (hasTrumpAce) indicators.push('Trump Ace');
        if (trumpCount >= 4) indicators.push(`${trumpCount} Trump`);

        lonerReason = `LONER: Strength ${total.toFixed(1)} >= ${lonerThreshold.toFixed(1)} | ${indicators.join(', ')}`;
    } else {
        lonerReason = `No loner: Strength ${total.toFixed(1)} < ${lonerThreshold.toFixed(1)} threshold`;
    }

    return { goAlone: shouldGo, reasoning: lonerReason };
};

export const getBestBid = (
    hand: Card[],
    personality: BotPersonality,
    position: number,
    isRound2: boolean,
    turnedDownSuit: Suit | null = null
): { suit: Suit | null; reasoning: string; strength: number; bestSuitAnyway: Suit; bestStrengthAnyway: number; bestReasoningAnyway: string } => {
    const suits: Suit[] = (['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).filter(s => s !== turnedDownSuit);
    let bestSuit: Suit | null = null;
    let maxStrength = -1;
    let bestReasoning = 'No strong suits found.';

    let bestSuitAnyway: Suit = suits[0];
    let bestStrengthAnyway = -1;
    let bestReasoningAnyway = '';

    suits.forEach(suit => {
        const result = shouldCallTrump(hand, suit, personality, position, isRound2, turnedDownSuit);

        if (result.strength > bestStrengthAnyway) {
            bestStrengthAnyway = result.strength;
            bestSuitAnyway = suit;
            bestReasoningAnyway = result.reasoning;
        }

        if (result.call && result.strength > maxStrength) {
            maxStrength = result.strength;
            bestSuit = suit;
            bestReasoning = result.reasoning;
        }
    });

    return {
        suit: bestSuit,
        reasoning: bestReasoning,
        strength: maxStrength,
        bestSuitAnyway,
        bestStrengthAnyway,
        bestReasoningAnyway
    };
};

// --- New AI Logic ---

export const getBotMove = (
    hand: Card[],
    currentTrick: { playerId: string; card: Card }[],
    trump: Suit,
    playerIds: string[],
    myId: string,
    trumpCallerIndex: number | null,
    personality: BotPersonality = { aggressiveness: 5, riskTolerance: 5, consistency: 5, archetype: 'Generic' }
): { card: Card; reasoning: string } => {
    const leadCard = currentTrick.length > 0 ? currentTrick[0].card : null;
    const leadSuit = leadCard ? getEffectiveSuit(leadCard, trump) : null;

    const validCards = hand.filter(c => isValidPlay(c, hand, leadSuit, trump));
    if (validCards.length === 0) return { card: hand[0], reasoning: 'Fallback: No valid cards' };

    const myIndex = playerIds.indexOf(myId);
    const partnerIndex = (myIndex + 2) % 4;
    const partnerId = playerIds[partnerIndex];
    const isMaker = trumpCallerIndex === myIndex;
    const isPartnerOfMaker = trumpCallerIndex === partnerIndex;
    const isDefender = !isMaker && !isPartnerOfMaker;

    // Determine current winner and if partner is winning
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
    const partnerIsWinning = currentHighId === partnerId;
    const isLastPlayer = currentTrick.length === 3;

    // --- STRATEGY: LEADING ---
    if (currentTrick.length === 0) {
        // 1. If Maker or Partner of Maker: Draw Trump
        if (isMaker || isPartnerOfMaker) {
            const highTrumps = validCards.filter(c => getEffectiveSuit(c, trump) === trump)
                .sort((a, b) => getCardValue(b, trump, null) - getCardValue(a, trump, null));

            if (highTrumps.length > 0 && (isMaker || highTrumps[0].rank === 'J')) {
                return {
                    card: highTrumps[0],
                    reasoning: `Maker/Partner drawing trump: ${highTrumps[0].rank} of ${highTrumps[0].suit}`
                };
            }
        }

        // 2. Lead strong non-trump Aces
        const nonTrumpAces = validCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
        if (nonTrumpAces.length > 0) {
            return { card: nonTrumpAces[0], reasoning: 'Leading strong non-trump Ace' };
        }

        // 3. Defenders: Lead through the maker (if maker is to our left)
        const makerIsNext = (myIndex + 1) % 4 === trumpCallerIndex;
        if (isDefender && makerIsNext) {
            // Lead a weak suit to force the maker to play early
            const weakCards = validCards.filter(c => getEffectiveSuit(c, trump) !== trump)
                .sort((a, b) => RANK_VALUES[a.rank] - RANK_VALUES[b.rank]);
            if (weakCards.length > 0) {
                return { card: weakCards[0], reasoning: 'Defender leading weak through maker' };
            }
        }

        // Default: Lowest non-trump or lowest trump if forced
        const sortedCards = [...validCards].sort((a, b) => getCardValue(b, trump, null) - getCardValue(a, trump, null));
        return { card: sortedCards[0], reasoning: 'Leading highest calculated card' };
    }

    // --- STRATEGY: SECOND HAND ---
    if (currentTrick.length === 1) {
        // "Second Hand Low" - don't waste high cards if lead is low
        const leadVal = getCardValue(currentTrick[0].card, trump, leadSuit);
        if (isDefender && leadVal < 100) { // Off-suit lead
            const lowCards = validCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit));

            // If we have the Right Bower, but lead is junk, maybe save it
            if (validCards.some(c => getCardValue(c, trump, leadSuit) === 1000)) {
                return { card: lowCards[0], reasoning: 'Second Hand Low: Saving Right Bower' };
            }
        }
    }

    // --- STRATEGY: THIRD/FOURTH HAND ---

    // 1. If partner is winning, sluff lowest possible card
    if (partnerIsWinning) {
        // If we are last, any valid card is fine, pick the absolute lowest value to save high cards
        const sortedByValue = validCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit));
        const sluffCard = sortedByValue[0];
        const lastReason = isLastPlayer ? " (Last player, protecting partner's win)" : "";

        // Use personality for reasoning flavor
        const isConservative = personality.riskTolerance <= 4;
        const conserveReason = isConservative ? " [Defensive Play]" : "";

        return {
            card: sluffCard,
            reasoning: `${personality.archetype}: Partner winning trick (${currentHighValue}). Saving ${sluffCard.rank} of ${sluffCard.suit}${lastReason}${conserveReason}`
        };
    }

    // 2. Try to win with the lowest possible card (Efficiency)
    const winningCards = validCards.filter(c => getCardValue(c, trump, leadSuit) > currentHighValue);
    if (winningCards.length > 0) {
        // Sort winners by value (low to high) to pick the most efficient winner
        const sortedWinners = winningCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit));

        // Strategy: 3rd Hand High. If we aren't last, we might want to play a strong winner to force the 4th player.
        // However, "low to high" winner selection is generally more efficient in Euchre.
        const cardToPlay = sortedWinners[0];
        return { card: cardToPlay, reasoning: `Winning trick efficiently with ${cardToPlay.rank} of ${cardToPlay.suit}` };
    }

    // 3. Can't win, sluff lowest card or create void
    const offSuits = validCards.filter(c => getEffectiveSuit(c, trump) !== trump);
    if (offSuits.length > 0) {
        // Sort by suit frequency (highest frequency first to create void)
        const suitCounts: Record<string, number> = {};
        offSuits.forEach(c => {
            const s = getEffectiveSuit(c, trump);
            suitCounts[s] = (suitCounts[s] || 0) + 1;
        });

        const bestSluff = offSuits.sort((a, b) => {
            const countA = suitCounts[getEffectiveSuit(a, trump)];
            const countB = suitCounts[getEffectiveSuit(b, trump)];
            if (countA !== countB) return countB - countA; // More cards in suit = better sluff
            return RANK_VALUES[a.rank] - RANK_VALUES[b.rank]; // Else lowest rank
        })[0];

        return { card: bestSluff, reasoning: `Cannot win trick: Sluffing to create void (${bestSluff.rank} of ${bestSluff.suit})` };
    }

    // Default: Sluff lowest card (likely a trump if we reached here)
    const lowest = validCards.sort((a, b) => getCardValue(a, trump, leadSuit) - getCardValue(b, trump, leadSuit))[0];
    return { card: lowest, reasoning: 'Cannot win trick: Sluffing lowest available card' };
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
