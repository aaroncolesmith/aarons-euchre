import { GameState, Player, PlayerStats, Card, Suit } from '../../types/game';

export { generateTableCode, generateTableName } from '../../utils/gameUtils';
export { shuffleDeck, createDeck, dealHands } from '../../utils/deck';
export { sortHand, determineWinner, getEffectiveSuit, isValidPlay } from '../../utils/rules';
export { logPlayEvent } from '../../utils/eventLogger';
export { createTrumpCallLog } from '../../utils/trumpCallLogger';

// Helper for team names
export const getTeamName = (n1: string | null, n2: string | null) => {
    const names = [n1 || 'Empty', n2 || 'Empty'].sort();
    return names.join(' & ');
};

// Placeholder for trackTrumpCall logic if needed by reducers
export const trackTrumpCall = (
    _caller: Player,
    _suit: Suit,
    _dealerName: string,
    _relationship: string,
    _upcard: Card | null,
    _round: number,
    _handOverride?: Card[]
) => {
    // Logic moved to createTrumpCallLog and its counterparts
};

export const BOT_NAMES_POOL = ['Fizz', 'J-Bock', 'Huber', 'Moses', 'Wooden', 'Buff'];

export const BOT_PERSONALITIES: { [key: string]: any } = {
    'Fizz': { aggressiveness: 8, riskTolerance: 4, consistency: 7, archetype: 'Aggressive' },
    'J-Bock': { aggressiveness: 6, riskTolerance: 6, consistency: 5, archetype: 'Balanced' },
    'Huber': { aggressiveness: 4, riskTolerance: 4, consistency: 8, archetype: 'Conservative' },
    'Moses': { aggressiveness: 9, riskTolerance: 7, consistency: 3, archetype: 'Wildcard' },
    'Wooden': { aggressiveness: 3, riskTolerance: 2, consistency: 9, archetype: 'Methodical' },
    'Buff': { aggressiveness: 5, riskTolerance: 8, consistency: 4, archetype: 'High Risk' }
};

export const getEmptyStats = (): PlayerStats => ({
    gamesWon: 0,
    gamesPlayed: 0,
    handsWon: 0,
    handsPlayed: 0,
    tricksPlayed: 0,
    tricksTaken: 0,
    tricksWonTeam: 0,
    callsMade: 0,
    callsWon: 0,
    lonersAttempted: 0,
    lonersWon: 0,
    pointsScored: 0,
    euchresMade: 0,
    euchred: 0,
    sweeps: 0,
    swept: 0
});

export const createEmptyPlayer = (index: number): Player => ({
    id: `player-${index}`,
    name: null,
    isComputer: false,
    hand: [],
    stats: getEmptyStats()
});

export const INITIAL_STATE_FUNC = (): GameState => ({
    tableId: null,
    tableName: null,
    tableCode: null,
    currentViewPlayerName: null,
    currentUser: null,
    players: Array(4).fill(null).map((_, i) => createEmptyPlayer(i)),
    currentPlayerIndex: -1,
    dealerIndex: -1,
    upcard: null,
    biddingRound: 1,
    trump: null,
    trumpCallerIndex: null,
    isLoner: false,
    currentTrick: [],
    tricksWon: { 'player-0': 0, 'player-1': 0, 'player-2': 0, 'player-3': 0 },
    handsPlayed: 0,
    scores: { team1: 0, team2: 0 },
    teamNames: { team1: 'Team A', team2: 'Team B' },
    phase: 'login',
    logs: ['Welcome to Euchre. Enter your name to begin.'],
    overlayMessage: null,
    overlayAcknowledged: {},
    eventLog: [],
    history: [],
    trumpCallLogs: [],
    stepMode: false,
    isBotThinking: false,
    lastActive: Date.now(),
    stateVersion: 0,
    processedActionIds: []
});
