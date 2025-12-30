export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Color = 'red' | 'black';

export interface BotPersonality {
    aggressiveness: number; // 1-10
    riskTolerance: number; // 1-10
    consistency: number; // 1-10
    archetype: string;
}

export interface Card {
    suit: Suit;
    rank: Rank;
    id: string; // Unique identifier for React keys
}

export interface Player {
    id: string;
    name: string | null; // Null if seat is empty
    isComputer: boolean;
    hand: Card[];
    stats: PlayerStats;
    personality?: BotPersonality;
    lastDecision?: string; // For bot auditing
}

export interface PlayerStats {
    gamesWon: number;
    gamesPlayed: number;
    handsWon: number;
    handsPlayed: number;
    tricksPlayed: number;
    tricksTaken: number; // Individual won trick
    tricksWonTeam: number; // Team won trick
    callsMade: number;
    callsWon: number;
    lonersAttempted: number;
    lonersConverted: number;
    euchresMade: number; // Euchred opponent
    euchred: number; // Been euchred
    sweeps: number; // Team took all 5
    swept: number; // Opponent took all 5
}

export type GamePhase = 'login' | 'landing' | 'lobby' | 'randomizing_dealer' | 'bidding' | 'discard' | 'playing' | 'waiting_for_trick' | 'scoring' | 'waiting_for_next_deal' | 'game_over';

export interface HandResult {
    dealerIndex: number;
    trump: Suit;
    trumpCallerIndex: number;
    tricksWon: { [playerId: string]: number };
    pointsScored: { team1: number; team2: number };
    winningTeam: 1 | 2;
    isLoner: boolean;
    timestamp: number;
}

export type GameEvent =
    | { type: 'dealer'; dealerIndex: number; dealerName: string; timestamp: number }
    | { type: 'bid'; playerIndex: number; playerName: string; suit: Suit; isLoner: boolean; round: 1 | 2; timestamp: number }
    | { type: 'pass'; playerIndex: number; playerName: string; round: 1 | 2; timestamp: number }
    | { type: 'play'; playerIndex: number; playerName: string; card: Card; trickIndex: number; timestamp: number }
    | { type: 'hand_result'; result: HandResult; timestamp: number }
    | { type: 'game_over'; scores: { team1: number; team2: number }; winner: string; timestamp: number };

export interface TrumpCallLog {
    whoCalled: string;
    userType: 'Human' | 'Bot';
    dealer: string;
    cardPickedUp: string; // "n/a" if called in second round
    suitCalled: string;
    bowerCount: number;
    trumpCount: number;
    suitCount: number;
    handAfterDiscard: string; // Comma-separated card codes
    timestamp: number;
    gameId: string;
}

export interface GameState {
    tableId: string | null;
    tableName: string | null;
    tableCode: string | null;
    currentViewPlayerName: string | null;
    currentUser: string | null;
    eventLog: GameEvent[]; // Normalized event history
    trumpCallLogs: TrumpCallLog[]; // Trump calling analytics
    players: Player[];
    currentPlayerIndex: number;
    dealerIndex: number;
    upcard: Card | null; // The card turned up at start
    biddingRound: 1 | 2; // Round 1: bid upcard suit, Round 2: bid any other suit
    trump: Suit | null;
    trumpCallerIndex: number | null;
    isLoner: boolean;
    currentTrick: { playerId: string; card: Card }[];
    tricksWon: { [playerId: string]: number };
    handsPlayed: number;
    scores: { team1: number; team2: number };
    teamNames: { team1: string; team2: string }; // Added
    phase: GamePhase;
    stepMode: boolean; // For debugging slow-mo
    history: HandResult[];
    displayDealerIndex?: number; // For randomization animation
    logs: string[];
    overlayMessage: string | null;
    overlayAcknowledged: { [playerName: string]: boolean }; // Track who has acknowledged the overlay
    lastActive: number; // Timestamp of last activity
}
