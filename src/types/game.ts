export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Color = 'red' | 'black';

export type Action = (
    | { type: 'CREATE_TABLE'; payload: { userName: string } }
    | { type: 'JOIN_TABLE'; payload: { code: string; userName: string } }
    | { type: 'LOGIN'; payload: { userName: string } }
    | { type: 'LOGOUT' }
    | { type: 'LOAD_EXISTING_GAME'; payload: { gameState: GameState } }
    | { type: 'SIT_PLAYER'; payload: { seatIndex: number; name: string } }
    | { type: 'ADD_BOT'; payload: { seatIndex: number; botName: string } }
    | { type: 'AUTOFILL_BOTS' }
    | { type: 'REMOVE_PLAYER'; payload: { seatIndex: number } }
    | { type: 'START_MATCH' }
    | { type: 'START_DAILY_CHALLENGE'; payload: { userName: string; dateString: string } }
    | { type: 'UPDATE_ANIMATION_DEALER'; payload: { index: number } }
    | { type: 'SET_DEALER'; payload: { dealerIndex: number; hands?: Card[][]; upcard?: Card } }
    | { type: 'MAKE_BID'; payload: { suit: Suit; callerIndex: number; isLoner: boolean; reasoning?: string; strength?: number } }
    | { type: 'PASS_BID'; payload: { playerIndex: number; reasoning?: string; strength?: number } }
    | { type: 'DISCARD_CARD'; payload: { playerIndex: number; cardId: string; reasoning?: string } }
    | { type: 'PLAY_CARD'; payload: { playerIndex: number; cardId: string; reasoning?: string } }
    | { type: 'CLEAR_TRICK' }
    | { type: 'FINISH_HAND' }
    | { type: 'TOGGLE_STEP_MODE' }
    | { type: 'LOAD_GLOBAL_STATS'; payload: { [name: string]: PlayerStats } }
    | { type: 'CLEAR_OVERLAY' }
    | { type: 'ADD_LOG'; payload: string }
    | { type: 'EXIT_TO_LANDING' }
    | { type: 'PLAY_AGAIN' }
    | { type: 'FORCE_PHASE'; payload: { phase: GameState['phase'] } }
    | { type: 'FORCE_NEXT_PLAYER'; payload: { nextPlayerIndex: number } }
    | { type: 'SET_TAB'; payload: { tab: 'home' | 'stats' | 'game' } }
) & {
    version?: number;
    actionId?: string;
};

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
    userId?: string | null;
    isComputer: boolean;
    hand: Card[];
    stats: PlayerStats;
    personality?: BotPersonality;
    lastDecision?: string; // For bot auditing
    decisionHistory?: { timestamp: number; decision: string }[];
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
    lonersWon: number;
    pointsScored: number;
    euchresMade: number; // Euchred opponent
    euchred: number; // Been euchred
    sweeps: number; // Team took all 5
    swept: number; // Opponent took all 5
}

export type GamePhase = 'login' | 'landing' | 'lobby' | 'randomizing_dealer' | 'bidding' | 'discard' | 'playing' | 'waiting_for_trick' | 'scoring' | 'waiting_for_next_deal' | 'game_over';

export interface HandResult {
    id: string;
    dealerIndex: number;
    trump: Suit;
    trumpCallerIndex: number;
    tricksWon: { [playerId: string]: number };
    scoresAtEnd: { team1: number; team2: number };
    winningTeam: 1 | 2;
    isLoner: boolean;
    timestamp: number;
}

export type GameEvent =
    | { type: 'dealer'; dealerIndex: number; dealerName: string; timestamp: number }
    | { type: 'bid'; playerIndex: number; playerName: string; suit: Suit; isLoner: boolean; round: 1 | 2; timestamp: number }
    | { type: 'pass'; playerIndex: number; playerName: string; round: 1 | 2; timestamp: number }
    | { type: 'play'; playerIndex: number; playerName: string; card: Card; trickIndex: number; timestamp: number }
    | { 
        type: 'hand_result', 
        handResult: HandResult, 
        participantStats?: { name: string | null, seat: number, userId?: string | null, stats: PlayerStats }[],
        timestamp: number 
      }
    | { 
        type: 'game_over'; 
        scores: { team1: number; team2: number }; 
        winner: string; 
        winnerTeam?: 1 | 2;
        winnerPlayers?: string[];
        timestamp: number 
      };

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
    currentUserId: string | null;
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
    isBotThinking: boolean;
    history: HandResult[];
    displayDealerIndex?: number; // For randomization animation
    logs: string[];
    overlayMessage: string | null;
    overlayAcknowledged: { [playerName: string]: boolean }; // Track who has acknowledged the overlay
    lastActive: number; // Timestamp of last activity
    isDailyChallenge?: boolean; // Flag for Hand of the Day mode
    stateVersion: number; // Current version of the game state
    processedActionIds: string[]; // List of action IDs already processed to ensure idempotency
    activeTab: 'home' | 'stats' | 'game';
}
