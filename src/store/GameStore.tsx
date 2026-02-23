import { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from 'react';
import { GameState, Suit, HandResult, PlayerStats, Player, GameEvent, Card } from '../types/game';
import { supabase } from '../lib/supabase';
import { createDeck, dealHands, shuffleDeck } from '../utils/deck';
import { createTrumpCallLog } from '../utils/trumpCallLogger';
import { BOT_PERSONALITIES, calculateBibleHandStrength, shouldCallTrump, shouldGoAlone, getBestBid, getBotMove, sortHand, getEffectiveSuit, determineWinner, getCardValue } from '../utils/rules';
import { saveBotDecision } from '../utils/supabaseStats';
import { debugGameState, suggestFix } from '../utils/freezeDebugger';
import { createHeartbeatSnapshot, detectFreeze, applyRecovery, logFreezeToCloud } from '../utils/heartbeat';
import { saveMultiplePlayerStats, clearAllPlayerStats, getAllPlayerStats, mergeAllStats } from '../utils/supabaseStats';
import { logPlayEvent } from '../utils/eventLogger';
import Logger from '../utils/logger';

// --- Actions ---
type Action =
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
    | { type: 'FORCE_PHASE'; payload: { phase: GameState['phase'] } }
    | { type: 'FORCE_NEXT_PLAYER'; payload: { nextPlayerIndex: number } };

// --- Constants ---
export const BOT_NAMES_POOL = ['Fizz', 'J-Bock', 'Huber', 'Moses', 'Wooden', 'Buff'];
const TABLE_NAME_ADJECTIVES = ['Midnight', 'Emerald', 'Golden', 'Royal', 'Crimson', 'Azure', 'Silent', 'Dancing'];
const TABLE_NAME_NOUNS = ['Bower', 'Trump', 'Dealer', 'Ace', 'Table', 'Lounge', 'Deck', 'Circle'];

// --- Helpers ---
const generateTableCode = () => {
    const part1 = Math.floor(100 + Math.random() * 900);
    const part2 = Math.floor(100 + Math.random() * 900);
    return `${part1}-${part2}`;
};

const generateTableName = () => {
    const adj = TABLE_NAME_ADJECTIVES[Math.floor(Math.random() * TABLE_NAME_ADJECTIVES.length)];
    const noun = TABLE_NAME_NOUNS[Math.floor(Math.random() * TABLE_NAME_NOUNS.length)];
    return `The ${adj} ${noun}`;
};

const getTeamName = (n1: string | null, n2: string | null) => {
    const names = [n1 || 'Empty', n2 || 'Empty'].sort();
    return names.join(' & ');
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
    lonersConverted: 0,
    euchresMade: 0,
    euchred: 0,
    sweeps: 0,
    swept: 0,
});

// MIGRATION: One-time wipe of corrupted pre-V0.52 data
const MIGRATION_VERSION = 'v0.52-migration-complete';

const runDataMigration = () => {
    const migrationComplete = localStorage.getItem(MIGRATION_VERSION);

    if (!migrationComplete) {
        console.log('[MIGRATION] Detected first run after V0.52 - wiping corrupted data');

        // Wipe corrupted localStorage data
        localStorage.removeItem('euchre_global_profiles');
        localStorage.removeItem('euchre_trump_calls');

        // Mark migration as complete
        localStorage.setItem(MIGRATION_VERSION, 'true');

        console.log('[MIGRATION] Data wipe complete. Fresh start with V0.52+ data integrity fixes.');
    }
};

// Run migration on module load
runDataMigration();

const getGlobalStats = (): { [name: string]: PlayerStats } => {
    const saved = localStorage.getItem('euchre_global_stats_v4');
    return saved ? JSON.parse(saved) : {};
};

const saveGlobalStats = async (stats: { [name: string]: PlayerStats }) => {
    // Save to localStorage
    localStorage.setItem('euchre_global_stats_v4', JSON.stringify(stats));

    // Sync each player's stats to Supabase using unified util
    await saveMultiplePlayerStats(stats);
};

export const getSavedGames = (): { [id: string]: GameState } => {
    const saved = localStorage.getItem('euchre_active_games');
    return saved ? JSON.parse(saved) : {};
};

const saveActiveGame = (state: GameState) => {
    if (!state.tableCode) return;
    const games = getSavedGames();
    games[state.tableCode] = state;
    localStorage.setItem('euchre_active_games', JSON.stringify(games));
};

export const deleteActiveGame = async (tableCode: string) => {
    if (!tableCode) return;
    console.log(`[DELETE] Attempting to soft-delete game with code: ${tableCode}`);

    // Delete from localStorage (only, not cloud)
    const games = getSavedGames();
    if (games[tableCode]) {
        delete games[tableCode];
        localStorage.setItem('euchre_active_games', JSON.stringify(games));
        console.log(`[DELETE] Removed from localStorage: ${tableCode}`);
    }

    // SOFT DELETE from Supabase: Set deleted_at timestamp instead of hard delete
    // This preserves game history for debugging and analytics
    try {
        console.log(`[SOFT-DELETE] Marking game ${tableCode} as deleted in Supabase`);
        const { error, data } = await supabase
            .from('games')
            .update({
                deleted_at: new Date().toISOString()
            })
            .eq('code', tableCode)
            .select();

        if (error) {
            console.error('[SOFT-DELETE] Supabase error:', error);
        } else {
            console.log(`[SOFT-DELETE] Successfully soft-deleted from Supabase:`, data);
        }
    } catch (err) {
        console.error('[SOFT-DELETE] Exception soft-deleting from Supabase:', err);
    }
};

const createEmptyPlayer = (index: number): Player => ({
    id: `player-${index}`,
    name: null,
    isComputer: false,
    hand: [],
    stats: getEmptyStats()
});

const getOppositeSuit = (suit: string) => {
    if (suit === 'hearts') return 'diamonds';
    if (suit === 'diamonds') return 'hearts';
    if (suit === 'spades') return 'clubs';
    if (suit === 'clubs') return 'spades';
    return '';
};

const trackTrumpCall = (
    caller: Player,
    suit: Suit,
    dealerName: string,
    relationship: 'Self' | 'Teammate' | 'Opponent',
    upcard: Card | null,
    round: number,
    handOverride?: Card[]
) => {
    try {
        const isBot = caller.isComputer;
        let trumpCount = 0;
        let bowerCount = 0;
        let suitCount = 0;
        const leftSuit = getOppositeSuit(suit);

        const handToAnalyze = handOverride || caller.hand;

        handToAnalyze.forEach(c => {
            const isRight = c.suit === suit && c.rank === 'J';
            const isLeft = c.suit === leftSuit && c.rank === 'J';
            if (isRight || isLeft) bowerCount++;
            if (c.suit === suit || isLeft) trumpCount++;
            if (c.suit === suit) suitCount++;
        });

        const handString = handToAnalyze.map(c => `${c.rank}${c.suit.charAt(0).toUpperCase()}`).join(', ');

        const record = {
            WHO_CALLED_TRUMP: caller.name,
            USER_TYPE: isBot ? 'Bot' : 'Human',
            DEALER: relationship === 'Self' ? 'Self' : `${relationship} - ${dealerName}`,
            CARD_PICKED_UP: round === 1 && upcard ? `${upcard.rank} of ${upcard.suit}` : 'n/a',
            SUIT_CALLED: suit.charAt(0).toUpperCase() + suit.slice(1),
            BOWER_COUNT: bowerCount,
            TRUMP_COUNT: trumpCount,
            SUIT_COUNT: suitCount,
            HAND_AFTER_DISCARD: handString,
            TIMESTAMP: new Date().toISOString()
        };

        const existing = JSON.parse(localStorage.getItem('euchre_trump_analysis') || '[]');
        existing.push(record);
        localStorage.setItem('euchre_trump_analysis', JSON.stringify(existing));
    } catch (e) {
        console.error("Failed to track trump call", e);
    }
};

const INITIAL_STATE_FUNC = (): GameState => ({
    tableId: null,
    tableName: null,
    tableCode: null,
    currentViewPlayerName: null,
    currentUser: localStorage.getItem('euchre_current_user'),
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
    stepMode: false,
    history: [],
    eventLog: [],
    trumpCallLogs: [],
    logs: ['Welcome to Euchre. Create or join a table to begin.'],
    overlayMessage: null,
    overlayAcknowledged: {},
    lastActive: Date.now(),
});

const INITIAL_STATE = INITIAL_STATE_FUNC();

// --- Reducer ---
const gameReducer = (state: GameState, action: Action): GameState => {
    Logger.debug('Action Dispatched:', action);

    switch (action.type) {
        case 'CLEAR_OVERLAY':
            return {
                ...state,
                overlayMessage: null,
                overlayAcknowledged: {
                    ...state.overlayAcknowledged,
                    [state.currentUser || '']: true
                }
            };

        case 'LOGIN': {
            // Case-insensitive login but preserve the entered capitalization
            const enteredName = action.payload.userName;
            const normalizedName = enteredName.toLowerCase();

            // Check against known users (case-insensitive)
            const knownUsers = ['aaron', 'polina', 'gray-gray', 'mimi', 'micah', 'cherrie', 'peter-playwright', 'test'];
            const matchedUser = knownUsers.find(u => u === normalizedName);

            // Use the matched capitalization if found, otherwise use what was entered
            const displayName = matchedUser
                ? ['Aaron', 'Polina', 'Gray-Gray', 'Mimi', 'Micah', 'Cherrie', 'Peter-Playwright', 'TEST'][knownUsers.indexOf(matchedUser)]
                : enteredName;

            return { ...state, currentUser: displayName, phase: 'landing' };
        }

        case 'LOGOUT':
            localStorage.removeItem('euchre_current_user'); // Clear saved user
            return { ...INITIAL_STATE_FUNC(), currentUser: null }; // Force null user

        case 'LOAD_EXISTING_GAME': {
            const loaded = action.payload.gameState;
            const currentUser = state.currentUser;
            // Ensure the person rejoining sees themselves as the active viewer if they are in the game
            const isPlayerInGame = loaded.players?.some(p => p.name === currentUser);

            return {
                ...INITIAL_STATE_FUNC(),
                ...loaded,
                currentUser,
                currentViewPlayerName: isPlayerInGame ? currentUser : (loaded.currentViewPlayerName || currentUser),
                players: loaded.players || INITIAL_STATE_FUNC().players,
                scores: loaded.scores || INITIAL_STATE_FUNC().scores,
                teamNames: loaded.teamNames || INITIAL_STATE_FUNC().teamNames,
                eventLog: loaded.eventLog || [],
                history: loaded.history || [],
                tricksWon: loaded.tricksWon || INITIAL_STATE_FUNC().tricksWon,
                currentTrick: loaded.currentTrick || [],
                logs: loaded.logs || INITIAL_STATE_FUNC().logs,
            };
        }

        case 'EXIT_TO_LANDING':
            return { ...INITIAL_STATE_FUNC(), currentUser: state.currentUser, phase: 'landing' };

        case 'CREATE_TABLE': {
            const code = generateTableCode();
            const name = generateTableName();

            return {
                ...state,
                tableId: Math.random().toString(36).substr(2, 9),
                tableName: name,
                tableCode: code,
                currentViewPlayerName: action.payload.userName,
                phase: 'lobby',
                logs: [`Table "${name}" created. Share code ${code} with friends.`, ...state.logs]
            };
        }

        case 'JOIN_TABLE': {
            // Only update tableCode if not already set (prevents overwriting loaded state)
            const isAlreadyLoaded = state.tableCode === action.payload.code;

            return {
                ...state,
                tableCode: action.payload.code,
                // Preserve loaded table name and phase if already in this table
                tableName: isAlreadyLoaded ? state.tableName : 'The Royal Table',
                phase: isAlreadyLoaded ? state.phase : 'lobby',
                currentViewPlayerName: action.payload.userName,
                logs: [`Joined table ${action.payload.code} as ${action.payload.userName}.`, ...state.logs]
            };
        }

        case 'SIT_PLAYER': {
            const name = action.payload.name;
            const seatIndex = action.payload.seatIndex;

            const playersAfterRemoval = state.players.map((p, i) =>
                p.name === name ? createEmptyPlayer(i) : p
            );

            const playersAfterSitting = playersAfterRemoval.map((p, i) =>
                i === seatIndex ? {
                    ...p,
                    name,
                    isComputer: false,
                    stats: getEmptyStats(),
                    personality: BOT_PERSONALITIES[name] // Assign personality if it's a known bot name
                } : p
            );

            return {
                ...state,
                players: playersAfterSitting
            };
        }

        case 'ADD_BOT': {
            const botName = action.payload.botName;

            return {
                ...state,
                players: state.players.map((p, i) => i === action.payload.seatIndex ? {
                    ...p,
                    name: botName,
                    isComputer: true,
                    stats: getEmptyStats(),
                    personality: BOT_PERSONALITIES[botName]
                } : p)
            };
        }

        case 'AUTOFILL_BOTS': {
            const usedBotNames = state.players.filter(p => p.isComputer && p.name).map(p => p.name);
            const availableBots = BOT_NAMES_POOL.filter(name => !usedBotNames.includes(name));

            let botIndex = 0;
            return {
                ...state,
                players: state.players.map((p) => {
                    // If seat is empty, fill with next available bot
                    if (!p.name && botIndex < availableBots.length) {
                        const botName = availableBots[botIndex++];
                        return {
                            ...p,
                            name: botName,
                            isComputer: true,
                            stats: getEmptyStats()
                        };
                    }
                    return p;
                })
            };
        }

        case 'REMOVE_PLAYER': {
            return {
                ...state,
                players: state.players.map((p, i) => i === action.payload.seatIndex ? createEmptyPlayer(i) : p)
            };
        }

        case 'START_MATCH': {
            const ready = state.players.every(p => p.name !== null);
            if (!ready) {
                return { ...state, logs: ['All 4 seats must be filled to start.', ...state.logs] };
            }

            return {
                ...state,
                phase: 'randomizing_dealer',
                displayDealerIndex: 0,
                teamNames: {
                    team1: getTeamName(state.players[0].name, state.players[2].name),
                    team2: getTeamName(state.players[1].name, state.players[3].name)
                },
                logs: ['Game starting... shuffling deck.', ...state.logs]
            };
        }

        case 'LOAD_GLOBAL_STATS': {
            // No longer overwrite the current game stats!
            return state;
        }

        case 'TOGGLE_STEP_MODE':
            return { ...state, stepMode: !state.stepMode };

        case 'UPDATE_ANIMATION_DEALER': {
            return {
                ...state,
                displayDealerIndex: action.payload.index,
            };
        }

        case 'SET_DEALER': {
            const dealerIndex = action.payload.dealerIndex;
            // Use received hands/upcard if provided (Multiplayer/Deterministic), or generate if local host and valid
            const hands = action.payload.hands;
            const upcard = action.payload.upcard;

            // Validate hands and upcard
            const isValidHands = hands &&
                Array.isArray(hands) &&
                hands.length === 4 &&
                hands.every(h => Array.isArray(h) && h.length === 5 && h.every(c => c && c.suit && c.rank));
            const isValidUpcard = upcard && upcard.suit && upcard.rank;

            if (!isValidHands || !isValidUpcard) {
                // Determine deck locally if not provided or invalid (fallback)
                Logger.warn('Invalid hands or upcard received, generating locally');
                Logger.warn('Hands valid:', isValidHands, 'Upcard valid:', isValidUpcard);
                Logger.warn('Received hands:', JSON.stringify(hands));
                Logger.warn('Received upcard:', JSON.stringify(upcard));
                const deck = shuffleDeck(createDeck());
                const { hands: h, kitty: k } = dealHands(deck);
                return {
                    ...state,
                    // recursion or re-dispatch would be better but for now inline:
                    players: state.players.map((p, i) => ({
                        ...p,
                        hand: p.name === state.currentViewPlayerName && !p.isComputer ? sortHand(h[i], null) : h[i]
                    })),
                    phase: 'bidding',
                    dealerIndex: dealerIndex,
                    displayDealerIndex: undefined,
                    upcard: k[0],
                    biddingRound: 1,
                    trump: null,
                    trumpCallerIndex: null,
                    isLoner: false,
                    currentTrick: [],
                    tricksWon: state.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}),
                    currentPlayerIndex: (dealerIndex + 1) % 4,
                    logs: [`${state.players[dealerIndex].name} is dealing. ${state.players[(dealerIndex + 1) % 4].name} to bid.`, ...state.logs],
                    eventLog: [...state.eventLog, {
                        type: 'dealer',
                        dealerIndex,
                        dealerName: state.players[dealerIndex].name || 'Bot',
                        timestamp: Date.now()
                    }]
                };
            }

            const dealerEvent: GameEvent = {
                type: 'dealer',
                dealerIndex,
                dealerName: state.players[dealerIndex].name || 'Bot',
                timestamp: Date.now()
            };

            return {
                ...state,
                players: state.players.map((p, i) => ({
                    ...p,
                    hand: p.name === state.currentViewPlayerName && !p.isComputer ? sortHand(hands[i], null) : hands[i]
                })),
                phase: 'bidding',
                dealerIndex: dealerIndex,
                displayDealerIndex: undefined,
                upcard,
                biddingRound: 1,
                trump: null,
                trumpCallerIndex: null,
                isLoner: false,
                currentTrick: [],
                tricksWon: state.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}),
                currentPlayerIndex: (dealerIndex + 1) % 4,
                logs: [`${state.players[dealerIndex].name} is dealing. ${state.players[(dealerIndex + 1) % 4].name} to bid.`, ...state.logs],
                eventLog: [...state.eventLog, dealerEvent]
            };
        }

        case 'MAKE_BID': {
            const { suit, callerIndex, isLoner } = action.payload;

            // SAFETY: Only allow bid from current player
            if (callerIndex !== state.currentPlayerIndex) {
                Logger.warn(`[REDUCER] Ignored MAKE_BID from player ${callerIndex} (Current: ${state.currentPlayerIndex})`);
                return state;
            }

            const caller = state.players[callerIndex];
            const logMsg = `${caller.name} called ${suit}${isLoner ? ' (GOING ALONE!)' : ''}.`;

            // Track Analysis (Skip if Dealer Pickup - tracked in DISCARD_CARD)
            const dealerName = state.players[state.dealerIndex].name || 'Unknown';
            const relationship = callerIndex === state.dealerIndex ? 'Self' : (Math.abs(callerIndex - state.dealerIndex) === 2 ? 'Teammate' : 'Opponent');
            const isDealerPickup = state.biddingRound === 1 && callerIndex === state.dealerIndex;

            if (!isDealerPickup) {
                trackTrumpCall(caller, suit, dealerName, relationship, state.upcard, state.biddingRound);
            }

            const bidEvent: GameEvent = {
                type: 'bid',
                playerIndex: callerIndex,
                playerName: caller.name || 'Bot',
                suit,
                isLoner,
                round: state.biddingRound,
                timestamp: Date.now()
            };

            // EVENT SOURCING: Log bid
            logPlayEvent({
                gameCode: state.tableCode || 'unknown',
                handNumber: state.handsPlayed + 1,
                eventType: 'bid',
                eventData: {
                    suit,
                    isLoner,
                    round: state.biddingRound,
                    upcard: state.upcard
                },
                playerName: caller.name || undefined,
                playerSeat: callerIndex
            }).catch(err => console.error('[EVENT LOG] Failed to log bid:', err));

            const newPlayers = state.players.map((p, i) => {
                let updatedHand = p.hand;
                if (p.name === state.currentViewPlayerName && !p.isComputer) updatedHand = sortHand(p.hand, suit);

                if (i === callerIndex) {
                    return {
                        ...p,
                        hand: updatedHand,
                        lastDecision: action.payload.reasoning,
                        stats: {
                            ...p.stats,
                            callsMade: p.stats.callsMade + 1,
                            lonersAttempted: isLoner ? p.stats.lonersAttempted + 1 : p.stats.lonersAttempted
                        }
                    };
                }
                return { ...p, hand: updatedHand };
            });

            if (state.biddingRound === 1 && state.upcard) {
                const dealer = newPlayers[state.dealerIndex];
                const dealerHandWithUpcard = [...dealer.hand, state.upcard!]; // Dealer's hand AFTER picking up

                const updatedPlayers = newPlayers.map((p, i) => {
                    if (i === state.dealerIndex) {
                        const newHand = dealerHandWithUpcard;
                        return { ...p, hand: p.name === state.currentViewPlayerName && !p.isComputer ? sortHand(newHand, suit) : newHand };
                    }
                    return p;
                });

                // --- NEW LOGGING LOGIC ---
                // Only log here if the caller is NOT the dealer. 
                // If dealer called, we wait for the discard action to log the 5-card hand.
                let trumpLog = null;
                if (callerIndex !== state.dealerIndex) {
                    trumpLog = createTrumpCallLog(
                        caller,           // PERSON WHO CALLED
                        suit,
                        dealerName,
                        relationship,
                        state.upcard,
                        state.biddingRound,
                        state.tableCode || 'unknown'
                    );

                    // Save trump call to Supabase + localStorage
                    import('../utils/trumpCallLogger').then(({ saveTrumpCallLog }) => {
                        saveTrumpCallLog(trumpLog!).catch((err: any) => {
                            console.error('[GAME] Failed to save trump call:', err);
                        });
                    });
                }

                return {
                    ...state,
                    players: updatedPlayers,
                    trump: suit,
                    trumpCallerIndex: callerIndex,
                    isLoner,
                    phase: 'discard',
                    currentPlayerIndex: state.dealerIndex,
                    logs: [logMsg, ...state.logs],
                    eventLog: [...state.eventLog, bidEvent],
                    trumpCallLogs: trumpLog ? [...state.trumpCallLogs, trumpLog] : state.trumpCallLogs
                };
            }

            // Generate trump announcement message
            const generateTrumpMessage = () => {
                const currentViewer = state.currentViewPlayerName;
                const viewerIndex = state.players.findIndex(p => p.name === currentViewer);
                const callerName = caller.name || 'Bot';
                const firstPlayerIndex = (state.dealerIndex + 1) % 4;
                const firstPlayerName = state.players[firstPlayerIndex].name || 'Bot';

                // Determine relationships from viewer's perspective
                const isTeam1 = (idx: number) => idx === 0 || idx === 2;
                const viewerTeam1 = isTeam1(viewerIndex);
                const callerTeam1 = isTeam1(callerIndex);
                const firstPlayerTeam1 = isTeam1(firstPlayerIndex);

                const callerRelationship = viewerTeam1 === callerTeam1 ? 'teammate' : 'opponent';
                const firstPlayerRelationship = viewerTeam1 === firstPlayerTeam1 ? 'teammate' : 'opponent';

                const callerPrefix = callerIndex === viewerIndex ? 'You have' : `Your ${callerRelationship} ${callerName} has`;
                const firstPlayerPrefix = firstPlayerIndex === viewerIndex ? 'You play' : `Your ${firstPlayerRelationship} ${firstPlayerName} plays`;

                const suitName = suit.charAt(0).toUpperCase() + suit.slice(1);

                return `${callerPrefix} called ${suitName} as trump${isLoner ? ' and is going alone!' : '.'} ${firstPlayerPrefix} first.`;
            };

            // Pre-acknowledge all bots (they don't need to read the overlay)
            const botAcknowledgments = state.players
                .filter(p => p.isComputer && p.name)
                .reduce((acc, p) => ({ ...acc, [p.name!]: true }), {});

            // Log trump call
            const trumpLog = createTrumpCallLog(
                caller,
                suit,
                dealerName,
                relationship,
                null, // No upcard in round 2
                state.biddingRound,
                state.tableCode || 'unknown'
            );

            // Save trump call to Supabase + localStorage
            import('../utils/trumpCallLogger').then(({ saveTrumpCallLog }) => {
                saveTrumpCallLog(trumpLog).catch((err: any) => {
                    console.error('[GAME] Failed to save trump call:', err);
                });
            });

            return {
                ...state,
                players: newPlayers,
                trump: suit,
                trumpCallerIndex: callerIndex,
                isLoner,
                phase: 'playing',
                currentPlayerIndex: (state.dealerIndex + 1) % 4,
                logs: [logMsg, ...state.logs],
                eventLog: [...state.eventLog, bidEvent],
                overlayMessage: generateTrumpMessage(),
                overlayAcknowledged: botAcknowledgments, // Bots pre-acknowledged
                trumpCallLogs: [...state.trumpCallLogs, trumpLog]
            };
        }

        case 'PASS_BID': {
            const { playerIndex } = action.payload;

            // SAFETY: Only allow pass from current player
            if (playerIndex !== state.currentPlayerIndex) {
                Logger.warn(`[REDUCER] Ignored PASS_BID from player ${playerIndex} (Current: ${state.currentPlayerIndex})`);
                return state;
            }

            const passEvent: GameEvent = {
                type: 'pass',
                playerIndex: state.currentPlayerIndex,
                playerName: state.players[state.currentPlayerIndex].name || 'Bot',
                round: state.biddingRound,
                timestamp: Date.now()
            };

            const nextPlayer = (state.currentPlayerIndex + 1) % 4;
            if (nextPlayer === (state.dealerIndex + 1) % 4) {
                if (state.biddingRound === 1) {
                    return {
                        ...state,
                        biddingRound: 2,
                        currentPlayerIndex: nextPlayer,
                        logs: ['Everyone passed. Round 2 bidding starts.', ...state.logs],
                        eventLog: [...state.eventLog, passEvent]
                    };
                } else {
                    const validSuits = (['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).filter(s => s !== state.upcard?.suit);
                    return gameReducer(state, { type: 'MAKE_BID', payload: { suit: validSuits[0], callerIndex: state.dealerIndex, isLoner: false, reasoning: 'Stick the Dealer (Emergency Fallback)' } });
                }
            }
            return {
                ...state,
                players: state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, lastDecision: action.payload.reasoning } : p),
                currentPlayerIndex: nextPlayer,
                eventLog: [...state.eventLog, passEvent]
            };
        }
        case 'DISCARD_CARD': {
            const { playerIndex, cardId } = action.payload;

            // SAFETY: Only dealer can discard
            if (playerIndex !== state.dealerIndex || state.phase !== 'discard') {
                Logger.warn(`[REDUCER] Ignored DISCARD_CARD from player ${playerIndex} (Dealer: ${state.dealerIndex}, Phase: ${state.phase})`);
                return state;
            }

            const newHand = state.players[playerIndex].hand.filter(c => c.id !== cardId);

            // Generate trump announcement message for dealer pickup
            const generateDealerPickupMessage = () => {
                const currentViewer = state.currentViewPlayerName;
                const viewerIndex = state.players.findIndex(p => p.name === currentViewer);
                const dealerName = state.players[state.dealerIndex].name || 'Bot';
                const callerName = state.players[state.trumpCallerIndex!].name || 'Bot';
                const firstPlayerIndex = (state.dealerIndex + 1) % 4;
                const firstPlayerName = state.players[firstPlayerIndex].name || 'Bot';

                // Determine relationships from viewer's perspective
                const isTeam1 = (idx: number) => idx === 0 || idx === 2;
                const viewerTeam1 = isTeam1(viewerIndex);
                const callerTeam1 = isTeam1(state.trumpCallerIndex!);
                const firstPlayerTeam1 = isTeam1(firstPlayerIndex);

                const callerRelationship = viewerTeam1 === callerTeam1 ? 'teammate' : 'opponent';
                const firstPlayerRelationship = viewerTeam1 === firstPlayerTeam1 ? 'teammate' : 'opponent';

                const callerPrefix = state.trumpCallerIndex === viewerIndex ? 'You have' : `Your ${callerRelationship} ${callerName} has`;
                const dealerPrefix = state.dealerIndex === viewerIndex ? 'you' : `the dealer ${dealerName}`;
                const firstPlayerPrefix = firstPlayerIndex === viewerIndex ? 'You play' : `Your ${firstPlayerRelationship} ${firstPlayerName} plays`;

                const upcardRank = state.upcard?.rank || '?';
                const suitName = state.trump!.charAt(0).toUpperCase() + state.trump!.slice(1);

                return `${callerPrefix} ordered up the ${upcardRank} of ${suitName} to ${dealerPrefix}. ${suitName} is trump${state.isLoner ? ' and they are going alone!' : '.'} ${firstPlayerPrefix} first.`;
            };

            // Pre-acknowledge all bots (they don't need to read the overlay)
            const botAcknowledgments = state.players
                .filter(p => p.isComputer && p.name)
                .reduce((acc, p) => ({ ...acc, [p.name!]: true }), {});

            let finalTrumpCallLogs = state.trumpCallLogs;

            // --- NEW LOGGING LOGIC ---
            // If the dealer was the one who called trump, log their hand now (after discard)
            if (state.phase === 'discard' && state.trump && state.trumpCallerIndex === state.dealerIndex) {
                const caller = state.players[playerIndex];
                const trumpLog = createTrumpCallLog(
                    caller,
                    state.trump,
                    caller.name || 'Bot',
                    'Self',
                    state.upcard,
                    1,
                    state.tableCode || 'unknown',
                    newHand // 5-card hand after discard
                );

                // Save trump call to Supabase + localStorage
                import('../utils/trumpCallLogger').then(({ saveTrumpCallLog }) => {
                    saveTrumpCallLog(trumpLog).catch((err: any) => {
                        console.error('[GAME] Failed to save trump call:', err);
                    });
                });

                finalTrumpCallLogs = [...state.trumpCallLogs, trumpLog];
            }

            return {
                ...state,
                players: state.players.map((p, i) =>
                    i === playerIndex ? { ...p, hand: newHand, lastDecision: action.payload.reasoning } : p
                ),
                phase: 'playing',
                currentPlayerIndex: (state.dealerIndex + 1) % 4,
                overlayMessage: generateDealerPickupMessage(),
                overlayAcknowledged: botAcknowledgments, // Bots pre-acknowledged
                trumpCallLogs: finalTrumpCallLogs
            };
        }

        case 'PLAY_CARD': {
            const { playerIndex, cardId } = action.payload;

            // SAFETY: Only allow play from current player
            if (playerIndex !== state.currentPlayerIndex) {
                Logger.warn(`[REDUCER] Ignored PLAY_CARD from player ${playerIndex} (Current: ${state.currentPlayerIndex})`);
                return state;
            }

            const player = state.players[playerIndex];
            const card = player.hand.find(c => c.id === cardId);

            if (!card) {
                Logger.error(`Card ${cardId} not found in player ${playerIndex}'s hand. Hand:`, player.hand);
                return state;
            }

            const newTrick = [...state.currentTrick, { playerId: player.id, playerIndex, card }];
            const newPlayers = state.players.map((p, i) =>
                i === playerIndex ? { ...p, hand: p.hand.filter(c => c.id !== cardId) } : p
            );

            // EVENT SOURCING: Log card play
            const trickNum = Math.floor((20 - state.players.reduce((sum, p) => sum + p.hand.length, 0)) / (state.isLoner ? 3 : 4));
            logPlayEvent({
                gameCode: state.tableCode || 'unknown',
                handNumber: state.handsPlayed + 1,
                trickNumber: trickNum,
                eventType: 'play_card',
                eventData: {
                    card,
                    leadSuit: state.currentTrick[0]?.card ? getEffectiveSuit(state.currentTrick[0].card, state.trump) : null,
                    isLead: state.currentTrick.length === 0,
                    trump: state.trump
                },
                playerName: player.name || undefined,
                playerSeat: playerIndex
            }).catch(err => console.error('[EVENT LOG] Failed to log play_card:', err));

            let nextPlayerIndex = (playerIndex + 1) % 4;
            if (state.isLoner) {
                const partnerIndex = (state.trumpCallerIndex! + 2) % 4;
                if (nextPlayerIndex === partnerIndex) {
                    nextPlayerIndex = (nextPlayerIndex + 1) % 4;
                }
            }

            const playEvent: GameEvent = {
                type: 'play',
                playerIndex,
                playerName: player.name || 'Bot',
                card,
                trickIndex: Math.floor((20 - state.players.reduce((sum, p) => sum + p.hand.length, 0)) / (state.isLoner ? 3 : 4)),
                timestamp: Date.now()
            };

            if (newTrick.length < (state.isLoner ? 3 : 4)) {
                return {
                    ...state,
                    players: newPlayers,
                    currentTrick: newTrick,
                    currentPlayerIndex: nextPlayerIndex,
                    eventLog: [...state.eventLog, playEvent]
                };
            }

            const trickLeadSuit = getEffectiveSuit(newTrick[0].card, state.trump);
            const winnerId = determineWinner(newTrick, state.trump!, trickLeadSuit);
            const winnerIndex = state.players.findIndex(p => p.id === winnerId);
            const winnerName = state.players[winnerIndex].name;

            const finalPlayers = newPlayers.map((p, i) => {
                const participated = newTrick.some(t => t.playerId === p.id);
                if (!participated) return p;

                const isWinner = p.id === winnerId;
                const isPartnerOfWinner = i === (winnerIndex + 2) % 4;

                return {
                    ...p,
                    stats: {
                        ...p.stats,
                        tricksPlayed: p.stats.tricksPlayed + 1,
                        tricksTaken: isWinner ? p.stats.tricksTaken + 1 : p.stats.tricksTaken,
                        tricksWonTeam: (isWinner || isPartnerOfWinner) ? p.stats.tricksWonTeam + 1 : p.stats.tricksWonTeam
                    }
                };
            });

            return {
                ...state,
                players: finalPlayers,
                currentTrick: newTrick,
                tricksWon: { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] || 0) + 1 },
                currentPlayerIndex: winnerIndex,
                phase: 'waiting_for_trick',
                logs: [`${winnerName} won the trick.`, ...state.logs],
                eventLog: [...state.eventLog, playEvent]
            };
        }

        case 'CLEAR_TRICK': {
            // Calculate if hand is over
            // LONER FIX: If loner, exclude partner's cards from the count since they don't play
            let totalCardsLeft;
            if (state.isLoner && state.trumpCallerIndex !== null) {
                const partnerIndex = (state.trumpCallerIndex + 2) % 4;
                totalCardsLeft = state.players.reduce((sum, p, i) => {
                    // Don't count partner's cards
                    if (i === partnerIndex) return sum;
                    return sum + p.hand.length;
                }, 0);
            } else {
                totalCardsLeft = state.players.reduce((sum, p) => sum + p.hand.length, 0);
            }
            const isHandOver = totalCardsLeft === 0;

            let logs = state.logs;
            let overlayMessage = state.overlayMessage;

            if (isHandOver) {
                const t1Tricks = (state.tricksWon[state.players[0].id] || 0) + (state.tricksWon[state.players[2].id] || 0);
                const t2Tricks = (state.tricksWon[state.players[1].id] || 0) + (state.tricksWon[state.players[3].id] || 0);

                const isT1Caller = state.trumpCallerIndex === 0 || state.trumpCallerIndex === 2;
                const callerTricks = isT1Caller ? t1Tricks : t2Tricks;

                let p1 = 0, p2 = 0;
                if (callerTricks >= 3) {
                    if (state.isLoner && callerTricks === 5) {
                        if (isT1Caller) p1 = 4; else p2 = 4;
                    } else if (callerTricks === 5) {
                        if (isT1Caller) p1 = 2; else p2 = 2;
                    } else {
                        if (isT1Caller) p1 = 1; else p2 = 1;
                    }
                } else {
                    if (isT1Caller) p2 = 2; else p1 = 2;
                }

                const winnerTeam = (p1 > p2) ? state.teamNames.team1 : state.teamNames.team2;
                const loserTeam = (p1 > p2) ? state.teamNames.team2 : state.teamNames.team1;
                const pts = (p1 > p2) ? p1 : p2;

                const wTricks = Math.max(t1Tricks, t2Tricks);
                const lTricks = Math.min(t1Tricks, t2Tricks);

                let summary = `${winnerTeam} won the hand ${wTricks} tricks to ${lTricks} (+${pts})`;
                if (pts === 4) summary = `${winnerTeam} swept all tricks! (+4)`;
                else if (!isT1Caller === (p1 > p2)) summary = `${winnerTeam} EUCHRED ${loserTeam}! (+2)`;

                logs = [summary, ...state.logs];
                // NO OVERLAY during scoring - prevents deadlocks, message shows in logs instead
                overlayMessage = null;
            }

            // LONER FIX: After clearing trick, if next player should be skipped (partner), advance
            let nextPlayer = state.currentPlayerIndex;
            if (state.isLoner && !isHandOver && state.trumpCallerIndex !== null) {
                const partnerIndex = (state.trumpCallerIndex + 2) % 4;
                if (nextPlayer === partnerIndex) {
                    nextPlayer = (nextPlayer + 1) % 4;
                    Logger.debug(`[LONER] Skipping partner ${partnerIndex}, advancing to ${nextPlayer}`);
                }
            }

            return {
                ...state,
                currentTrick: [],
                currentPlayerIndex: nextPlayer,
                phase: isHandOver ? 'scoring' : 'playing',
                logs,
                overlayMessage
            };
        }

        case 'FINISH_HAND': {
            const t1P1 = state.players[0].id;
            const t1P2 = state.players[2].id;
            const t2P1 = state.players[1].id;
            const t2P2 = state.players[3].id;

            const t1Tricks = (state.tricksWon[t1P1] || 0) + (state.tricksWon[t1P2] || 0);
            const t2Tricks = (state.tricksWon[t2P1] || 0) + (state.tricksWon[t2P2] || 0);

            let p1 = 0, p2 = 0;
            const isT1Caller = state.trumpCallerIndex === 0 || state.trumpCallerIndex === 2;
            const callerTricks = isT1Caller ? t1Tricks : t2Tricks;
            const isTeam1 = (p: number) => p === 0 || p === 2;

            if (callerTricks >= 3) {
                if (state.isLoner && callerTricks === 5) {
                    if (isT1Caller) p1 = 4; else p2 = 4;
                } else if (callerTricks === 5) {
                    if (isT1Caller) p1 = 2; else p2 = 2;
                } else {
                    if (isT1Caller) p1 = 1; else p2 = 1;
                }
            } else {
                if (isT1Caller) p2 = 2; else p1 = 2;
            }

            const handResult: HandResult = {
                dealerIndex: state.dealerIndex,
                trump: state.trump!,
                trumpCallerIndex: state.trumpCallerIndex!,
                tricksWon: state.tricksWon,
                pointsScored: { team1: p1, team2: p2 },
                winningTeam: p1 > p2 ? 1 : 2,
                isLoner: state.isLoner,
                timestamp: Date.now(),
            };

            const newScores = { team1: state.scores.team1 + p1, team2: state.scores.team2 + p2 };
            const isGameOver = newScores.team1 >= 10 || newScores.team2 >= 10;

            const handEvent: GameEvent = {
                type: 'hand_result',
                result: handResult,
                timestamp: Date.now()
            };

            const newEventLog = [...state.eventLog, handEvent];

            // EVENT SOURCING: Log hand result
            logPlayEvent({
                gameCode: state.tableCode || 'unknown',
                handNumber: state.handsPlayed + 1,
                eventType: 'hand_won',
                eventData: {
                    winner_team: p1 > p2 ? 1 : 2,
                    team1_tricks: t1Tricks,
                    team2_tricks: t2Tricks,
                    points_scored: p1 > p2 ? p1 : p2,
                    team1_score: newScores.team1,
                    team2_score: newScores.team2,
                    euchre: callerTricks < 3,
                    sweep: callerTricks === 5,
                    isLoner: state.isLoner,
                    trump: state.trump,
                    trumpCaller: state.players[state.trumpCallerIndex!]?.name
                }
            }).catch(err => console.error('[EVENT LOG] Failed to log hand_won:', err));
            if (isGameOver) {
                newEventLog.push({
                    type: 'game_over',
                    scores: newScores,
                    winner: newScores.team1 >= 10 ? state.teamNames.team1 : state.teamNames.team2,
                    timestamp: Date.now()
                });

                // EVENT SOURCING: Log game completion
                logPlayEvent({
                    gameCode: state.tableCode || 'unknown',
                    handNumber: state.handsPlayed + 1,
                    eventType: 'game_won',
                    eventData: {
                        winner_team: newScores.team1 >= 10 ? 1 : 2,
                        final_score: newScores,
                        total_hands: state.handsPlayed + 1,
                        winners: newScores.team1 >= 10
                            ? [state.players[0].name, state.players[2].name]
                            : [state.players[1].name, state.players[3].name]
                    }
                }).catch(err => console.error('[EVENT LOG] Failed to log game_won:', err));
            }

            const updatedPlayers = state.players.map((p, i) => {
                const isWinner = isTeam1(i) ? p1 > 0 : p2 > 0;
                const isCaller = i === state.trumpCallerIndex;
                const isTeamCaller = isTeam1(i) === isT1Caller;
                const callerTricksWon = isT1Caller ? t1Tricks : t2Tricks;

                return {
                    ...p,
                    stats: {
                        ...p.stats,
                        handsPlayed: p.stats.handsPlayed + 1,
                        handsWon: isWinner ? p.stats.handsWon + 1 : p.stats.handsWon,
                        callsWon: (isCaller && isWinner) ? p.stats.callsWon + 1 : p.stats.callsWon,
                        lonersConverted: (isCaller && state.isLoner && callerTricksWon === 5) ? p.stats.lonersConverted + 1 : p.stats.lonersConverted,
                        euchresMade: (!isTeamCaller && isWinner) ? p.stats.euchresMade + 1 : p.stats.euchresMade,
                        euchred: (isTeamCaller && !isWinner) ? p.stats.euchred + 1 : p.stats.euchred,
                        sweeps: (isWinner && (isTeam1(i) ? t1Tricks === 5 : t2Tricks === 5)) ? p.stats.sweeps + 1 : p.stats.sweeps,
                        swept: (!isWinner && (isTeam1(i) ? t2Tricks === 5 : t1Tricks === 5)) ? p.stats.swept + 1 : p.stats.swept,
                    }
                };
            });

            return {
                ...state,
                players: updatedPlayers,
                scores: newScores,
                dealerIndex: (state.dealerIndex + 1) % 4,
                phase: isGameOver ? 'game_over' : 'waiting_for_next_deal',
                handsPlayed: state.handsPlayed + 1,
                history: [handResult, ...state.history].slice(0, 50),
                eventLog: newEventLog,
                logs: [isGameOver ? 'GAME OVER!' : 'Hand finished. Next deal in 4 seconds...', ...state.logs],
                overlayMessage: null,
            };
        }

        case 'FORCE_PHASE':
            return {
                ...state,
                phase: action.payload.phase,
                logs: [`(System) Auto-recovering stuck game state...`, ...state.logs]
            };

        case 'FORCE_NEXT_PLAYER':
            Logger.warn(`[FORCE_NEXT_PLAYER] Forcing advance from ${state.currentPlayerIndex} to ${action.payload.nextPlayerIndex}`);
            return {
                ...state,
                currentPlayerIndex: action.payload.nextPlayerIndex,
                logs: [`(System) Auto-advanced to next player (freeze recovery)`, ...state.logs]
            };

        default:
            return state;
    }
};

const gameReducerFixed = (state: GameState, action: Action): GameState => {
    const newState = gameReducer(state, action);

    if (newState !== state && action.type !== 'UPDATE_ANIMATION_DEALER') {
        return { ...newState, lastActive: Date.now() };
    }
    return newState;
};

// --- Context ---
interface GameContextType {
    state: GameState;
    dispatch: (action: Action) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(gameReducerFixed, INITIAL_STATE);
    const channelRef = useRef<any>(null);
    const heartbeatSnapshotRef = useRef<ReturnType<typeof createHeartbeatSnapshot> | null>(null);
    const lastBotDecisionRef = useRef<string | null>(null);
    const lastGameStatsSavedRef = useRef<string | null>(null);

    // Enhanced dispatch that broadcasts to others
    const broadcastDispatch = async (action: Action) => {
        dispatch(action);
        if (channelRef.current && state.tableCode) {
            Logger.debug(`Broadcasting action: ${action.type}`);
            const result = await channelRef.current.send({
                type: 'broadcast',
                event: 'game_action',
                payload: action
            });
            if (result !== 'ok') {
                Logger.error('Failed to broadcast action', result);
            } else {
                Logger.debug('Broadcast success');
            }
        } else {
            Logger.warn('Cannot broadcast: No channel or table code');
        }
    };

    useEffect(() => {
        // 1. Immediate Login Restoration (No Async Wait)
        const savedUser = localStorage.getItem('euchre_current_user');
        if (savedUser) dispatch({ type: 'LOGIN', payload: { userName: savedUser } });

        const performTotalWipe = async () => {
            const WIPE_VERSION = 'total-wipe-v1.03-absolute-zero';
            if (localStorage.getItem(WIPE_VERSION)) return false;

            console.log('🚨 PERFORMING ABSOLUTE STATS WIPE (V1.03)...');
            await clearAllPlayerStats();

            // Clear ALL legacy keys
            ['euchre_global_profiles', 'euchre_global_stats_v1', 'euchre_global_stats_v2', 'euchre_global_stats_v3'].forEach(k => localStorage.removeItem(k));

            localStorage.setItem(WIPE_VERSION, 'true');
            console.log('✅ WIPE COMPLETE.');

            window.location.reload();
            return true;
        };

        const init = async () => {
            if (await performTotalWipe()) return;

            // Load local stats (v4)
            const localStats = getGlobalStats();
            const cloudStats = await getAllPlayerStats();
            const mergedStats = mergeAllStats(localStats, cloudStats);

            localStorage.setItem('euchre_global_stats_v4', JSON.stringify(mergedStats));
            dispatch({ type: 'LOAD_GLOBAL_STATS', payload: mergedStats });
        };

        init();
    }, []);

    // Multiplayer Sync Logic
    useEffect(() => {
        if (!state.tableCode) {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            return;
        }

        const channelId = `table-${state.tableCode}`;
        const channel = supabase.channel(channelId);

        channel
            .on('broadcast', { event: 'game_action' }, ({ payload }) => {
                Logger.debug('Received Remote Action:', payload);
                dispatch(payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    Logger.info(`Connected to table: ${state.tableCode}`);
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [state.tableCode]);

    // Self-Healing: Detect and fix stuck "Playing" state
    useEffect(() => {
        if (state.phase === 'playing' && state.tableCode) {
            const allHandsEmpty = state.players.every(p => p.hand.length === 0);
            if (allHandsEmpty) {
                const lastEvent = state.eventLog.length > 0 ? state.eventLog[state.eventLog.length - 1] : null;
                // If the last event was a hand_result, we MUST be in 'waiting_for_next_deal'
                if (lastEvent && lastEvent.type === 'hand_result') {
                    Logger.warn('Self-Healing: Detected stuck state (Playing w/ Result). Forcing transition.');
                    dispatch({ type: 'FORCE_PHASE', payload: { phase: 'waiting_for_next_deal' } });
                }
            }
        }
    }, [state.phase, state.players, state.eventLog, state.tableCode]);

    // Persist active game to cloud (Throttled)
    useEffect(() => {
        if (state.tableCode && state.phase !== 'login' && state.phase !== 'landing') {
            const syncToCloud = async () => {
                // If game is over, we still want to push the final state once, then delete
                await supabase
                    .from('games')
                    .upsert({
                        code: state.tableCode,
                        state: state,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'code' });

                if (state.phase === 'game_over') {
                    console.log(`[SYNC] Game ${state.tableCode} is OVER. Triggering cleanup in 10s...`);
                    // Wait a bit so other players can see the "Game Over" screen before the record vanishes
                    setTimeout(() => {
                        deleteActiveGame(state.tableCode!);
                    }, 10000);
                }
            };
            syncToCloud();
        }
    }, [state.tableCode, state.phase === 'game_over']);

    useEffect(() => {
        if (state.currentUser) {
            localStorage.setItem('euchre_current_user', state.currentUser);
        } else {
            localStorage.removeItem('euchre_current_user');
        }
    }, [state.currentUser]);

    useEffect(() => {
        if (['lobby', 'randomizing_dealer', 'bidding', 'discard', 'playing', 'waiting_for_trick', 'scoring', 'game_over'].includes(state.phase)) {
            saveActiveGame(state);
        }
    }, [state]);

    // Authority Check Helper
    const getScoringAuthority = () => {
        const humanPlayers = state.players.filter(p => p.name !== null && !p.isComputer);
        if (humanPlayers.length > 0) return humanPlayers[0].name;
        return state.currentUser;
    };

    // Handle Match Completion and Stats Saving (Authority Based)
    useEffect(() => {
        if (state.phase === 'game_over' && state.tableCode && lastGameStatsSavedRef.current !== state.tableCode) {
            const scoringAuthority = getScoringAuthority();

            if (state.currentUser !== scoringAuthority) {
                Logger.debug(`[STATS] Not the scoring authority (${scoringAuthority}). My name: ${state.currentUser}. Skipping Sync.`);
                lastGameStatsSavedRef.current = state.tableCode;
                return;
            }

            const syncGlobalStats = async () => {
                Logger.info(`[STATS] AUTHORITY (${state.currentUser}): Saving final match stats for table ${state.tableCode}`);
                const globalStats = getGlobalStats();

                state.players.forEach((p, i) => {
                    if (!p.name) return;
                    // Team 1 is 0 & 2, Team 2 is 1 & 3
                    const playerTeam = (i === 0 || i === 2) ? 'team1' : 'team2';
                    const isGameWinner = playerTeam === 'team1' ? state.scores.team1 >= 10 : state.scores.team2 >= 10;

                    const prevGlobal = globalStats[p.name] || getEmptyStats();

                    globalStats[p.name] = {
                        gamesPlayed: (prevGlobal.gamesPlayed || 0) + 1,
                        gamesWon: isGameWinner ? (prevGlobal.gamesWon || 0) + 1 : (prevGlobal.gamesWon || 0),
                        handsPlayed: (prevGlobal.handsPlayed || 0) + p.stats.handsPlayed,
                        handsWon: (prevGlobal.handsWon || 0) + p.stats.handsWon,
                        tricksPlayed: (prevGlobal.tricksPlayed || 0) + p.stats.tricksPlayed,
                        tricksTaken: (prevGlobal.tricksTaken || 0) + p.stats.tricksTaken,
                        tricksWonTeam: (prevGlobal.tricksWonTeam || 0) + p.stats.tricksWonTeam,
                        callsMade: (prevGlobal.callsMade || 0) + p.stats.callsMade,
                        callsWon: (prevGlobal.callsWon || 0) + p.stats.callsWon,
                        lonersAttempted: (prevGlobal.lonersAttempted || 0) + p.stats.lonersAttempted,
                        lonersConverted: (prevGlobal.lonersConverted || 0) + p.stats.lonersConverted,
                        euchresMade: (prevGlobal.euchresMade || 0) + p.stats.euchresMade,
                        euchred: (prevGlobal.euchred || 0) + p.stats.euchred,
                        sweeps: (prevGlobal.sweeps || 0) + p.stats.sweeps,
                        swept: (prevGlobal.swept || 0) + p.stats.swept,
                    };
                });

                try {
                    await saveMultiplePlayerStats(globalStats);
                    saveGlobalStats(globalStats);
                    Logger.info('[STATS] Global sync successful');
                } catch (err) {
                    Logger.error('[STATS] Global sync failed', err);
                }
                lastGameStatsSavedRef.current = state.tableCode!;
            };

            syncGlobalStats();
        }
    }, [state.phase, state.tableCode, state.currentUser]);

    useEffect(() => {
        if (state.phase === 'randomizing_dealer') {
            let count = 0;
            const maxCycles = 15 + Math.floor(Math.random() * 5);
            const interval = setInterval(() => {
                count++;
                broadcastDispatch({ type: 'UPDATE_ANIMATION_DEALER', payload: { index: count % 4 } });

                if (count >= maxCycles) {
                    clearInterval(interval);
                    setTimeout(() => {
                        // Determine who should generate the dealer
                        const firstHumanSeat = state.players.findIndex(p => p.name && !p.isComputer);
                        const myPlayerIndex = state.players.findIndex(p => p.name === state.currentUser);
                        const allBotsGame = state.players.every(p => p.isComputer);
                        const shouldIGenerate = allBotsGame ? true : (myPlayerIndex !== -1 && (myPlayerIndex === firstHumanSeat || firstHumanSeat === -1));

                        Logger.info(`Dealer selection: myIndex=${myPlayerIndex}, firstHuman=${firstHumanSeat}, allBots=${allBotsGame}, shouldGenerate=${shouldIGenerate}`);

                        if (shouldIGenerate) {
                            const deck = shuffleDeck(createDeck());
                            const { hands, kitty } = dealHands(deck);
                            const upcard = kitty[0];

                            Logger.info(`Generating and broadcasting dealer selection: ${count % 4}`);
                            broadcastDispatch({
                                type: 'SET_DEALER',
                                payload: {
                                    dealerIndex: count % 4,
                                    hands,
                                    upcard
                                }
                            });
                        }
                    }, 500);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [state.phase]);

    // Handle transition to next hand (Rotating Dealer)
    useEffect(() => {
        if (state.phase === 'waiting_for_next_deal') {
            const nextDealer = state.players[state.dealerIndex];

            // AUTHORITY CHECK: Use unified helper
            const scoringAuthority = getScoringAuthority();
            const isBroadcaster = state.currentUser === scoringAuthority;

            const dealCards = () => {
                const deck = shuffleDeck(createDeck());
                const { hands, kitty } = dealHands(deck);
                const upcard = kitty[0];

                Logger.info('[DEAL] Dealing new hand', { dealer: nextDealer.name, by: state.currentUser });

                broadcastDispatch({
                    type: 'SET_DEALER',
                    payload: {
                        dealerIndex: state.dealerIndex,
                        hands,
                        upcard
                    }
                });
            };

            // Attempt 1: If I'm the dealer, deal immediately
            if (nextDealer.name === state.currentUser) {
                Logger.info('[DEAL] I am the dealer - dealing immediately');
                const immediateTimer = setTimeout(dealCards, 100);
                return () => clearTimeout(immediateTimer);
            }

            // Attempt 2: If dealer is a bot, only the primary human deals after 500ms
            if (nextDealer.isComputer && isBroadcaster) {
                Logger.info('[DEAL] Dealer is bot - primary human dealing after 500ms');
                const botTimer = setTimeout(dealCards, 500);
                return () => clearTimeout(botTimer);
            }

            // Attempt 3: EMERGENCY FALLBACK - Anyone deals after 2s if Primary fails
            // But we still prefer the Primary if they are there
            const emergencyTimer = setTimeout(() => {
                const anyHumans = state.players.some(p => !p.isComputer && p.name);
                if (isBroadcaster || !anyHumans) {
                    Logger.error('[DEAL] EMERGENCY FALLBACK TRIGGERED');
                    dealCards();
                }
            }, 2000);

            return () => clearTimeout(emergencyTimer);
        }
    }, [state.phase, state.dealerIndex, state.currentUser, state.players, state.currentViewPlayerName]);

    useEffect(() => {
        if (state.phase === 'waiting_for_trick') {
            // AUTHORITY CHECK: Only the primary human should advance the state
            const humans = state.players.filter(p => !p.isComputer && p.name);
            const primaryHumanName = humans[0]?.name;
            if (state.currentViewPlayerName !== primaryHumanName && !state.players.every(p => p.isComputer)) return;

            const timer = setTimeout(() => {
                broadcastDispatch({ type: 'CLEAR_TRICK' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [state.phase, state.players, state.currentViewPlayerName]);

    // Auto-advance from scoring phase
    useEffect(() => {
        if (state.phase === 'scoring') {
            // AUTHORITY CHECK: Only the primary human should advance the state
            const humans = state.players.filter(p => !p.isComputer && p.name);
            const primaryHumanName = humans[0]?.name;
            if (state.currentViewPlayerName !== primaryHumanName && !state.players.every(p => p.isComputer)) return;

            const timer = setTimeout(() => {
                broadcastDispatch({ type: 'FINISH_HAND' });
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [state.phase, state.players, state.currentViewPlayerName]);

    useEffect(() => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || !currentPlayer.isComputer || ['game_over', 'scoring', 'waiting_for_trick', 'randomizing_dealer', 'landing', 'lobby'].includes(state.phase)) return;
        if (state.stepMode) return;

        // BOT AUTHORITY LOGIC (Multiplayer Fix)
        // Only the first human in the player list is responsible for triggering bot moves
        // This prevents multiple human clients from advancing a bot's turn simultaneously
        const humans = state.players.filter(p => !p.isComputer && p.name);
        const primaryHumanName = humans[0]?.name;
        if (state.currentViewPlayerName !== primaryHumanName) return;

        // DEDUPLICATION: Prevent duplicate bot decisions for the same state
        const decisionKey = `${state.tableCode}-${state.phase}-${state.biddingRound}-${state.currentPlayerIndex}-${currentPlayer.hand.length}-${state.currentTrick.length}`;
        if (lastBotDecisionRef.current === decisionKey) return;

        const timer = setTimeout(() => {
            // Re-check after timeout in case state changed
            if (lastBotDecisionRef.current === decisionKey) return;
            lastBotDecisionRef.current = decisionKey;
            const position = (state.currentPlayerIndex - state.dealerIndex + 4) % 4;
            // Ensure bot has personality - check BOT_PERSONALITIES first, then player.personality, finally use Generic fallback
            const personality = currentPlayer.personality
                || (currentPlayer.name ? BOT_PERSONALITIES[currentPlayer.name] : undefined)
                || { aggressiveness: 5, riskTolerance: 5, consistency: 5, archetype: 'Generic' };
            const isT1 = state.currentPlayerIndex === 0 || state.currentPlayerIndex === 2;
            const myScore = isT1 ? state.scores.team1 : state.scores.team2;
            const opponentScore = isT1 ? state.scores.team2 : state.scores.team1;

            if (state.phase === 'bidding') {
                if (state.biddingRound === 1) {
                    if (state.upcard) {
                        const result = shouldCallTrump(currentPlayer.hand, state.upcard.suit, personality, position, false, null);
                        if (result.call) {
                            // CHECK FOR LONER
                            const lonerCheck = shouldGoAlone(currentPlayer.hand, state.upcard.suit, personality);
                            const isLoner = lonerCheck.goAlone;

                            broadcastDispatch({
                                type: 'MAKE_BID',
                                payload: {
                                    suit: state.upcard.suit,
                                    callerIndex: state.currentPlayerIndex,
                                    isLoner,
                                    reasoning: isLoner ? `${result.reasoning} | ${lonerCheck.reasoning}` : result.reasoning,
                                    strength: result.strength
                                }
                            });
                            saveBotDecision({
                                gameCode: state.tableCode || 'unknown',
                                playerName: currentPlayer.name || 'Bot',
                                archetype: personality.archetype,
                                decisionType: 'bid',
                                decision: `Call ${state.upcard.suit}${isLoner ? ' (GOING ALONE!)' : ''}`,
                                reasoning: isLoner ? `${result.reasoning} | ${lonerCheck.reasoning}` : result.reasoning,
                                handStrength: result.strength,
                                currentScoreUs: myScore,
                                currentScoreThem: opponentScore,
                                gamePhase: 'bidding (round 1)',
                                handState: currentPlayer.hand,
                                tableState: { upcard: state.upcard, biddingRound: state.biddingRound },
                                aggressiveness: personality.aggressiveness,
                                riskTolerance: personality.riskTolerance,
                                consistency: personality.consistency
                            });
                        } else {
                            const { total: strength, reasoning: reasonFromCalc } = calculateBibleHandStrength(currentPlayer.hand, state.upcard.suit);
                            const reason = `Hand strength ${strength.toFixed(1)} below threshold for ${personality.archetype}. ${reasonFromCalc}`;
                            broadcastDispatch({
                                type: 'PASS_BID',
                                payload: {
                                    playerIndex: state.currentPlayerIndex,
                                    reasoning: reason,
                                    strength: strength
                                }
                            });
                            // Log the pass decision
                            saveBotDecision({
                                gameCode: state.tableCode || 'unknown',
                                playerName: currentPlayer.name || 'Bot',
                                archetype: personality.archetype,
                                decisionType: 'pass',
                                decision: `Pass on ${state.upcard.suit}`,
                                reasoning: reason,
                                handStrength: strength,
                                currentScoreUs: myScore,
                                currentScoreThem: opponentScore,
                                gamePhase: 'bidding (round 1)',
                                handState: currentPlayer.hand,
                                tableState: { upcard: state.upcard, biddingRound: state.biddingRound },
                                aggressiveness: personality.aggressiveness,
                                riskTolerance: personality.riskTolerance,
                                consistency: personality.consistency
                            });
                        }
                    }
                } else {
                    const result = getBestBid(
                        currentPlayer.hand.filter(c => state.upcard && c.suit !== state.upcard.suit),
                        personality,
                        position,
                        true,
                        state.upcard?.suit || null
                    );
                    if (result.suit) {
                        // CHECK FOR LONER
                        const lonerCheck = shouldGoAlone(currentPlayer.hand, result.suit, personality);
                        const isLoner = lonerCheck.goAlone;

                        broadcastDispatch({
                            type: 'MAKE_BID',
                            payload: {
                                suit: result.suit,
                                callerIndex: state.currentPlayerIndex,
                                isLoner,
                                reasoning: isLoner ? `${result.reasoning} | ${lonerCheck.reasoning}` : result.reasoning,
                                strength: result.strength
                            }
                        });
                        saveBotDecision({
                            gameCode: state.tableCode || 'unknown',
                            playerName: currentPlayer.name || 'Bot',
                            archetype: personality.archetype,
                            decisionType: 'bid',
                            decision: `Call ${result.suit}${isLoner ? ' (GOING ALONE!)' : ''}`,
                            reasoning: isLoner ? `${result.reasoning} | ${lonerCheck.reasoning}` : result.reasoning,
                            handStrength: result.strength,
                            currentScoreUs: myScore,
                            currentScoreThem: opponentScore,
                            gamePhase: 'bidding (round 2)',
                            handState: currentPlayer.hand,
                            tableState: { biddingRound: state.biddingRound, turnedDownSuit: state.upcard?.suit },
                            aggressiveness: personality.aggressiveness,
                            riskTolerance: personality.riskTolerance,
                            consistency: personality.consistency
                        });
                    } else if (state.currentPlayerIndex === state.dealerIndex) {
                        // STICK THE DEALER: Bot IS the dealer in round 2 and nothing met threshold
                        // CRITICAL: Only stick the actual dealer, verified by dealerIndex match
                        const forcedSuit = result.bestSuitAnyway;
                        const forcedReason = `STICK THE DEALER: Forced to call best available suit (${forcedSuit}). ${result.bestReasoningAnyway}`;
                        broadcastDispatch({
                            type: 'MAKE_BID',
                            payload: {
                                suit: forcedSuit,
                                callerIndex: state.currentPlayerIndex,
                                isLoner: false,
                                reasoning: forcedReason,
                                strength: result.bestStrengthAnyway
                            }
                        });
                        saveBotDecision({
                            gameCode: state.tableCode || 'unknown',
                            playerName: currentPlayer.name || 'Bot',
                            archetype: personality.archetype,
                            decisionType: 'bid',
                            decision: `Call ${forcedSuit} (STUCK)`,
                            reasoning: forcedReason,
                            handStrength: result.bestStrengthAnyway,
                            currentScoreUs: myScore,
                            currentScoreThem: opponentScore,
                            gamePhase: 'bidding (round 2 - STUCK)',
                            handState: currentPlayer.hand,
                            tableState: { biddingRound: state.biddingRound, turnedDownSuit: state.upcard?.suit },
                            aggressiveness: personality.aggressiveness,
                            riskTolerance: personality.riskTolerance,
                            consistency: personality.consistency
                        });
                    } else {
                        broadcastDispatch({
                            type: 'PASS_BID',
                            payload: {
                                playerIndex: state.currentPlayerIndex,
                                reasoning: result.reasoning,
                                strength: result.strength
                            }
                        });
                        // Log the pass decision
                        saveBotDecision({
                            gameCode: state.tableCode || 'unknown',
                            playerName: currentPlayer.name || 'Bot',
                            archetype: personality.archetype,
                            decisionType: 'pass',
                            decision: `Pass (best: ${result.bestSuitAnyway})`,
                            reasoning: result.reasoning,
                            handStrength: result.strength,
                            currentScoreUs: myScore,
                            currentScoreThem: opponentScore,
                            gamePhase: 'bidding (round 2)',
                            handState: currentPlayer.hand,
                            tableState: { biddingRound: state.biddingRound, turnedDownSuit: state.upcard?.suit, bestSuitAvailable: result.bestSuitAnyway },
                            aggressiveness: personality.aggressiveness,
                            riskTolerance: personality.riskTolerance,
                            consistency: personality.consistency
                        });
                    }
                }
            } else if (state.phase === 'discard') {
                // Dealer discard logic
                const cardToDiscard = [...currentPlayer.hand].sort((a, b) => {
                    const valA = getCardValue(a, state.trump, null);
                    const valB = getCardValue(b, state.trump, null);
                    return valA - valB;
                })[0];

                const reason = `Discarding lowest value card (${cardToDiscard.rank} of ${cardToDiscard.suit})`;
                broadcastDispatch({
                    type: 'DISCARD_CARD',
                    payload: {
                        playerIndex: state.currentPlayerIndex,
                        cardId: cardToDiscard.id,
                        reasoning: reason
                    }
                });

                saveBotDecision({
                    gameCode: state.tableCode || 'unknown',
                    playerName: currentPlayer.name || 'Bot',
                    archetype: personality.archetype,
                    decisionType: 'discard',
                    decision: `Discard ${cardToDiscard.rank}${cardToDiscard.suit}`,
                    reasoning: reason,
                    currentScoreUs: myScore,
                    currentScoreThem: opponentScore,
                    gamePhase: 'discard',
                    handState: currentPlayer.hand, // Hand before discard
                    tableState: { trump: state.trump, upcard: state.upcard },
                    aggressiveness: personality.aggressiveness,
                    riskTolerance: personality.riskTolerance,
                    consistency: personality.consistency
                });
            } else if (state.phase === 'playing') {
                try {
                    // CRITICAL: Ensure bot can ALWAYS play a card, even if logic fails
                    const { card: cardToPlay, reasoning: cardReason } = getBotMove(
                        currentPlayer.hand,
                        state.currentTrick,
                        state.trump!,
                        state.players.map(p => p.id),
                        currentPlayer.id,
                        state.trumpCallerIndex,
                        personality
                    );

                    if (cardToPlay) {
                        broadcastDispatch({
                            type: 'PLAY_CARD',
                            payload: {
                                playerIndex: state.currentPlayerIndex,
                                cardId: cardToPlay.id,
                                reasoning: cardReason
                            }
                        });

                        saveBotDecision({
                            gameCode: state.tableCode || 'unknown',
                            playerName: currentPlayer.name || 'Bot',
                            archetype: personality.archetype,
                            decisionType: 'play',
                            decision: `Play ${cardToPlay.rank}${cardToPlay.suit}`,
                            reasoning: cardReason,
                            currentScoreUs: myScore,
                            currentScoreThem: opponentScore,
                            gamePhase: 'playing',
                            handState: currentPlayer.hand,
                            tableState: { currentTrick: state.currentTrick, trump: state.trump },
                            aggressiveness: personality.aggressiveness,
                            riskTolerance: personality.riskTolerance,
                            consistency: personality.consistency
                        });
                    } else {
                        // Safety fallback
                        const fallbackCard = currentPlayer.hand[0];
                        broadcastDispatch({
                            type: 'PLAY_CARD',
                            payload: {
                                playerIndex: state.currentPlayerIndex,
                                cardId: fallbackCard.id,
                                reasoning: "Emergency fallback play"
                            }
                        });
                    }
                } catch (err) {
                    Logger.error('[BOT PLAY] Exception in bot play logic:', err);
                    if (currentPlayer.hand.length > 0) {
                        broadcastDispatch({
                            type: 'PLAY_CARD',
                            payload: {
                                playerIndex: state.currentPlayerIndex,
                                cardId: currentPlayer.hand[0].id,
                                reasoning: "Strategic failure recovery"
                            }
                        });
                    }
                }
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [state.currentPlayerIndex, state.phase, state.players, state.trump, state.currentTrick, state.stepMode, state.biddingRound, state.upcard]);

    // Bot Watchdog - Detect stuck bots and auto-sync
    useEffect(() => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || !currentPlayer.isComputer || ['game_over', 'scoring', 'waiting_for_trick', 'randomizing_dealer', 'landing', 'lobby'].includes(state.phase)) return;
        if (state.stepMode) return;

        // If a bot should have played but hasn't after 10 seconds, force a sync
        const watchdogTimer = setTimeout(async () => {
            Logger.warn(`Bot watchdog triggered: Bot ${currentPlayer.name} at position ${state.currentPlayerIndex} hasn't played. Forcing sync...`);

            // Try to reload game state from Supabase
            if (state.tableCode) {
                const { data } = await supabase
                    .from('games')
                    .select('state')
                    .eq('code', state.tableCode)
                    .single();

                if (data && data.state) {
                    Logger.info('Bot watchdog: Reloading state from server');
                    dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: data.state } });
                }
            }
        }, 10000); // 10 second watchdog

        return () => clearTimeout(watchdogTimer);
    }, [state.currentPlayerIndex, state.phase, state.tableCode]);

    // LONER FREEZE DETECTOR - Critical fix for partner getting stuck during loners
    useEffect(() => {
        // Only check during loners in playing phase
        if (!state.isLoner || state.phase !== 'playing' || state.trumpCallerIndex === null) return;

        const partnerIndex = (state.trumpCallerIndex + 2) % 4;
        const currentPlayer = state.players[state.currentPlayerIndex];

        // CRITICAL: If current player is the partner during a loner, this is a BUG
        if (state.currentPlayerIndex === partnerIndex) {
            Logger.error(`[LONER FREEZE DETECTED] Current player is partner! 
                Partner Index: ${partnerIndex}, 
                Current Index: ${state.currentPlayerIndex}, 
                Trump Caller: ${state.trumpCallerIndex}, 
                Player: ${currentPlayer?.name}`);

            // Auto-recover: Skip to next player
            const nextIndex = (partnerIndex + 1) % 4;
            setTimeout(() => {
                Logger.warn(`[AUTO-RECOVERY] Forcing advance to player ${nextIndex}`);
                broadcastDispatch({
                    type: 'FORCE_NEXT_PLAYER',
                    payload: { nextPlayerIndex: nextIndex }
                });
            }, 1000); // Small delay to let other processes settle
        }
    }, [state.currentPlayerIndex, state.isLoner, state.trumpCallerIndex, state.phase]);

    // UNIVERSAL FREEZE DETECTOR - Works for ALL freeze scenarios
    useEffect(() => {
        // Skip if in safe phases
        if (['login', 'landing', 'lobby', 'game_over', 'randomizing_dealer'].includes(state.phase)) return;

        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer) return;

        // Only check if it's a bot's turn (humans control their own pace)
        if (!currentPlayer.isComputer) return;

        const timer = setTimeout(() => {
            // Log diagnostic info
            const diagnostic = debugGameState(state);
            Logger.warn('[UNIVERSAL FREEZE DETECTOR]\n' + diagnostic);

            // Try to suggest and apply a fix
            const fix = suggestFix(state);
            if (fix) {
                Logger.warn(`[AUTO-FIX] Applying: ${fix.description}`);

                // Apply the fix
                if (fix.action === 'CLEAR_OVERLAY') {
                    broadcastDispatch({ type: 'CLEAR_OVERLAY' });
                } else if (fix.action === 'CLEAR_TRICK') {
                    broadcastDispatch({ type: 'CLEAR_TRICK' });
                } else if (fix.action === 'PASS_BID') {
                    broadcastDispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex } });
                } else if (fix.action === 'PLAY_CARD' && currentPlayer.hand.length > 0) {
                    const { card, reasoning } = getBotMove(
                        currentPlayer.hand,
                        state.currentTrick,
                        state.trump!,
                        state.players.map(p => p.id),
                        currentPlayer.id,
                        state.trumpCallerIndex
                    );
                    broadcastDispatch({ type: 'PLAY_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: card.id, reasoning } });
                } else if (fix.action === 'FORCE_NEXT_PLAYER') {
                    const nextIdx = (state.currentPlayerIndex + 1) % 4;
                    broadcastDispatch({ type: 'FORCE_NEXT_PLAYER', payload: { nextPlayerIndex: nextIdx } });
                }
            } else {
                Logger.error('[FREEZE DETECTOR] No auto-fix available for current state');
            }
        }, 12000); // Check after 12 seconds of inactivity

        return () => clearTimeout(timer);
    }, [state.currentPlayerIndex, state.phase, state.players, state.overlayMessage, state.currentTrick]);

    // HEARTBEAT MONITOR - Runs every 10s to detect ANY freeze
    useEffect(() => {
        // Skip if not in active gameplay
        if (['landing', 'login', 'lobby'].includes(state.phase)) return;

        const heartbeat = setInterval(() => {
            const currentSnapshot = createHeartbeatSnapshot(state);
            const recoveryAction = detectFreeze(currentSnapshot, heartbeatSnapshotRef.current);

            if (recoveryAction) {
                Logger.error('[HEARTBEAT] 🚨 FREEZE DETECTED - Auto-recovering', {
                    phase: state.phase,
                    reason: recoveryAction.reason
                });

                // Log freeze to cloud before attempting recovery
                logFreezeToCloud(state, recoveryAction, true).catch(err => {
                    Logger.warn('[HEARTBEAT] Failed to log freeze to cloud', err);
                });

                applyRecovery(recoveryAction, broadcastDispatch);
            }

            heartbeatSnapshotRef.current = currentSnapshot;
        }, 10000); // Check every 10 seconds

        return () => clearInterval(heartbeat);
    }, [state.phase, state.currentPlayerIndex, state.lastActive]);

    return (
        <GameContext.Provider value={{ state, dispatch: broadcastDispatch }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};
