import { Card, Suit, Rank } from '../types/game';
import Logger from './logger';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

export const createDeck = (): Card[] => {
    const deck: Card[] = [];
    SUITS.forEach((suit) => {
        RANKS.forEach((rank) => {
            deck.push({
                suit,
                rank,
                id: `${rank}-${suit}`,
            });
        });
    });
    Logger.debug(`Created new deck with ${deck.length} cards.`);
    return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    Logger.debug('Deck shuffled.');
    return newDeck;
};

export const dealHands = (deck: Card[]): { hands: Card[][]; kitty: Card[] } => {
    if (deck.length !== 24) {
        Logger.error('Attempted to deal with an invalid deck size', deck.length);
        throw new Error('Deck must have 24 cards');
    }

    // Standard deal: 5 cards to 4 players, 4 cards remaining for kitty
    const hands: Card[][] = [[], [], [], []];
    let cardIndex = 0;

    // Dealing 5 cards to each player (simplified 1-1-1-1 loop for now, real euchre is 3-2-3-2 etc but math works out same for randomness)
    for (let i = 0; i < 5; i++) {
        for (let p = 0; p < 4; p++) {
            hands[p].push(deck[cardIndex]);
            cardIndex++;
        }
    }

    const kitty = deck.slice(cardIndex);
    Logger.info(`Dealt 4 hands of 5 cards. Kitty has ${kitty.length} cards.`);

    return { hands, kitty };
};
