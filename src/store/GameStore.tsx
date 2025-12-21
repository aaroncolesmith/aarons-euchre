import { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from 'react';
import { GameState, Suit, HandResult, PlayerStats, Player, GameEvent } from '../types/game';
import { supabase } from '../lib/supabase';
import { createDeck, dealHands, shuffleDeck } from '../utils/deck';
import { getBestBid, getEffectiveSuit, determineWinner, shouldCallTrump, getBotMove, sortHand } from '../utils/rules';
import Logger from '../utils/logger';

// --- Actions ---
type Action =
    | { type: 'CREATE_TABLE'; payload: { userName: string } }
    | { type: 'JOIN_TABLE'; payload: { code: string; userName: string } }
    | { type: 'LOGIN'; payload: { userName: string } }
    | { type: 'LOGOUT' }
    | { type: 'LOAD_EXISTING_GAME'; payload: { gameState: GameState } }
    | { type: 'SIT_PLAYER'; payload: { seatIndex: number; name: string } }
    | { type: 'ADD_BOT'; payload: { seatIndex: number; botName?: string } }
    | { type: 'REMOVE_PLAYER'; payload: { seatIndex: number } }
    | { type: 'START_MATCH' }
    | { type: 'SET_DEALER'; payload: { dealerIndex: number } }
    | { type: 'UPDATE_ANIMATION_DEALER'; payload: { index: number } }
    | { type: 'MAKE_BID'; payload: { suit: Suit; callerIndex: number; isLoner: boolean } }
    | { type: 'PASS_BID'; payload: { playerIndex: number } }
    | { type: 'DISCARD_CARD'; payload: { playerIndex: number; cardId: string } }
    | { type: 'PLAY_CARD'; payload: { playerIndex: number; cardId: string } }
    | { type: 'CLEAR_TRICK' }
    | { type: 'FINISH_HAND' }
    | { type: 'TOGGLE_STEP_MODE' }
    | { type: 'LOAD_GLOBAL_STATS'; payload: { [name: string]: PlayerStats } }
    | { type: 'CLEAR_OVERLAY' }
    | { type: 'ADD_LOG'; payload: string }
    | { type: 'EXIT_TO_LANDING' };

// --- Constants ---
const BOT_NAMES_POOL = ['Josh', 'Jake', 'Jordan', 'Brien', 'Michael', 'Evan'];
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

const getGlobalStats = (): { [name: string]: PlayerStats } => {
    const saved = localStorage.getItem('euchre_global_profiles');
    return saved ? JSON.parse(saved) : {};
};

const saveGlobalStats = (stats: { [name: string]: PlayerStats }) => {
    localStorage.setItem('euchre_global_profiles', JSON.stringify(stats));
};

export const getSavedGames = (): { [id: string]: GameState } => {
    const saved = localStorage.getItem('euchre_active_games');
    return saved ? JSON.parse(saved) : {};
};

const saveActiveGame = (state: GameState) => {
    if (!state.tableId) return;
    const games = getSavedGames();
    games[state.tableId] = state;
    localStorage.setItem('euchre_active_games', JSON.stringify(games));
};

const deleteActiveGame = (tableId: string) => {
    const games = getSavedGames();
    delete games[tableId];
    localStorage.setItem('euchre_active_games', JSON.stringify(games));
};

const createEmptyPlayer = (index: number): Player => ({
    id: `player-${index}`,
    name: null,
    isComputer: false,
    hand: [],
    stats: getEmptyStats()
});

const INITIAL_STATE_FUNC = (): GameState => ({
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
    stepMode: false,
    history: [],
    eventLog: [],
    logs: ['Welcome to Euchre. Create or join a table to begin.'],
    overlayMessage: null,
});

const INITIAL_STATE = INITIAL_STATE_FUNC();

// --- Reducer ---
const gameReducer = (state: GameState, action: Action): GameState => {
    Logger.debug('Action Dispatched:', action);

    switch (action.type) {
        case 'CLEAR_OVERLAY':
            return { ...state, overlayMessage: null };

        case 'LOGIN':
            return { ...state, currentUser: action.payload.userName, phase: 'landing' };

        case 'LOGOUT':
            return INITIAL_STATE_FUNC();

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
            return {
                ...state,
                tableCode: action.payload.code,
                tableName: 'The Royal Table',
                currentViewPlayerName: action.payload.userName,
                phase: 'lobby',
                logs: [`Joined table ${action.payload.code} as ${action.payload.userName}.`, ...state.logs]
            };
        }

        case 'SIT_PLAYER': {
            const globalStats = getGlobalStats();
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
                    stats: globalStats[name] || getEmptyStats()
                } : p
            );

            return {
                ...state,
                players: playersAfterSitting
            };
        }

        case 'ADD_BOT': {
            const globalStats = getGlobalStats();
            const activeBotNames = state.players.map(p => p.name).filter(n => n && BOT_NAMES_POOL.includes(n));
            const availableBots = BOT_NAMES_POOL.filter(n => !activeBotNames.includes(n));

            if (availableBots.length === 0) return state;

            const botName = action.payload.botName || availableBots[Math.floor(Math.random() * availableBots.length)];

            return {
                ...state,
                players: state.players.map((p, i) => i === action.payload.seatIndex ? {
                    ...p,
                    name: botName,
                    isComputer: true,
                    stats: globalStats[botName] || getEmptyStats()
                } : p)
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
            return {
                ...state,
                players: state.players.map(p => p.name ? ({
                    ...p,
                    stats: action.payload[p.name] || p.stats
                }) : p)
            };
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
            const deck = shuffleDeck(createDeck());
            const { hands, kitty } = dealHands(deck);
            const upcard = kitty[0];

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
            const caller = state.players[callerIndex];
            const logMsg = `${caller.name} called ${suit}${isLoner ? ' (GOING ALONE!)' : ''}.`;

            const bidEvent: GameEvent = {
                type: 'bid',
                playerIndex: callerIndex,
                playerName: caller.name || 'Bot',
                suit,
                isLoner,
                round: state.biddingRound,
                timestamp: Date.now()
            };

            const newPlayers = state.players.map((p, i) => {
                let updatedHand = p.hand;
                if (p.name === state.currentViewPlayerName && !p.isComputer) updatedHand = sortHand(p.hand, suit);

                if (i === callerIndex) {
                    return {
                        ...p,
                        hand: updatedHand,
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
                const updatedPlayers = newPlayers.map((p, i) => {
                    if (i === state.dealerIndex) {
                        const newHand = [...dealer.hand, state.upcard!];
                        return { ...p, hand: p.name === state.currentViewPlayerName && !p.isComputer ? sortHand(newHand, suit) : newHand };
                    }
                    return p;
                });

                return {
                    ...state,
                    players: updatedPlayers,
                    trump: suit,
                    trumpCallerIndex: callerIndex,
                    isLoner,
                    phase: 'discard',
                    currentPlayerIndex: state.dealerIndex,
                    logs: [logMsg, ...state.logs],
                    eventLog: [...state.eventLog, bidEvent]
                };
            }

            return {
                ...state,
                players: newPlayers,
                trump: suit,
                trumpCallerIndex: callerIndex,
                isLoner,
                phase: 'playing',
                currentPlayerIndex: (state.dealerIndex + 1) % 4,
                logs: [logMsg, ...state.logs],
                eventLog: [...state.eventLog, bidEvent]
            };
        }

        case 'PASS_BID': {
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
                    return gameReducer(state, { type: 'MAKE_BID', payload: { suit: 'spades', callerIndex: state.dealerIndex, isLoner: false } });
                }
            }
            return {
                ...state,
                currentPlayerIndex: nextPlayer,
                eventLog: [...state.eventLog, passEvent]
            };
        }

        case 'DISCARD_CARD': {
            const { playerIndex, cardId } = action.payload;
            return {
                ...state,
                players: state.players.map((p, i) =>
                    i === playerIndex ? { ...p, hand: p.hand.filter(c => c.id !== cardId) } : p
                ),
                phase: 'playing',
                currentPlayerIndex: (state.dealerIndex + 1) % 4,
            };
        }

        case 'PLAY_CARD': {
            const { playerIndex, cardId } = action.payload;
            const player = state.players[playerIndex];
            const card = player.hand.find(c => c.id === cardId)!;

            const newTrick = [...state.currentTrick, { playerId: player.id, card }];
            const newPlayers = state.players.map((p, i) =>
                i === playerIndex ? { ...p, hand: p.hand.filter(c => c.id !== cardId) } : p
            );

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
            const totalCardsLeft = state.players.reduce((sum, p) => sum + p.hand.length, 0);
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
                overlayMessage = summary;
            }

            return {
                ...state,
                currentTrick: [],
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
            if (isGameOver) {
                newEventLog.push({
                    type: 'game_over',
                    scores: newScores,
                    winner: newScores.team1 >= 10 ? state.teamNames.team1 : state.teamNames.team2,
                    timestamp: Date.now()
                });
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

            if (isGameOver) {
                const globalStats = getGlobalStats();
                updatedPlayers.forEach((p) => {
                    if (!p.name) return;
                    const isGameWinner = isTeam1(state.players.indexOf(state.players.find(pl => pl.id === p.id)!)) ? newScores.team1 >= 10 : newScores.team2 >= 10;
                    const prevGlobal = globalStats[p.name] || getEmptyStats();

                    globalStats[p.name] = {
                        ...p.stats,
                        gamesPlayed: prevGlobal.gamesPlayed + 1,
                        gamesWon: isGameWinner ? prevGlobal.gamesWon + 1 : prevGlobal.gamesWon,
                        handsPlayed: prevGlobal.handsPlayed + p.stats.handsPlayed,
                        handsWon: prevGlobal.handsWon + p.stats.handsWon,
                        tricksPlayed: prevGlobal.tricksPlayed + p.stats.tricksPlayed,
                        tricksTaken: prevGlobal.tricksTaken + p.stats.tricksTaken,
                        tricksWonTeam: prevGlobal.tricksWonTeam + p.stats.tricksWonTeam,
                        callsMade: prevGlobal.callsMade + p.stats.callsMade,
                        callsWon: prevGlobal.callsWon + p.stats.callsWon,
                        lonersAttempted: prevGlobal.lonersAttempted + p.stats.lonersAttempted,
                        lonersConverted: prevGlobal.lonersConverted + p.stats.lonersConverted,
                        euchresMade: prevGlobal.euchresMade + p.stats.euchresMade,
                        euchred: prevGlobal.euchred + p.stats.euchred,
                        sweeps: prevGlobal.sweeps + p.stats.sweeps,
                        swept: prevGlobal.swept + p.stats.swept,
                    };
                });
                saveGlobalStats(globalStats);
            }

            if (isGameOver && state.tableId) {
                deleteActiveGame(state.tableId);
            }

            return {
                ...state,
                players: updatedPlayers,
                scores: newScores,
                dealerIndex: (state.dealerIndex + 1) % 4,
                phase: isGameOver ? 'game_over' : 'playing',
                handsPlayed: state.handsPlayed + 1,
                history: [handResult, ...state.history].slice(0, 10),
                eventLog: newEventLog,
                logs: [isGameOver ? 'GAME OVER!' : state.logs[0], ...state.logs],
                overlayMessage: isGameOver ? 'GAME OVER!' : null,
            };
        }

        default:
            return state;
    }
};

const gameReducerFixed = (state: GameState, action: Action): GameState => {
    const newState = gameReducer(state, action);
    if (action.type === 'FINISH_HAND' && newState.phase !== 'game_over') {
        const deck = shuffleDeck(createDeck());
        const { hands, kitty } = dealHands(deck);
        const upcard = kitty[0];
        return {
            ...newState,
            players: newState.players.map((p, i) => ({
                ...p,
                hand: p.name === state.currentViewPlayerName && !p.isComputer ? sortHand(hands[i], null) : hands[i]
            })),
            phase: 'bidding',
            upcard,
            biddingRound: 1,
            trump: null,
            trumpCallerIndex: null,
            isLoner: false,
            currentTrick: [],
            tricksWon: newState.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}),
            currentPlayerIndex: (newState.dealerIndex + 1) % 4,
        };
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

    // Enhanced dispatch that broadcasts to others
    const broadcastDispatch = (action: Action) => {
        dispatch(action);
        if (channelRef.current && state.tableCode) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'game_action',
                payload: action
            });
        }
    };

    useEffect(() => {
        const globalProfiles = getGlobalStats();
        dispatch({ type: 'LOAD_GLOBAL_STATS', payload: globalProfiles });

        const savedUser = localStorage.getItem('euchre_current_user');
        if (savedUser) dispatch({ type: 'LOGIN', payload: { userName: savedUser } });
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

    // Persist active game to cloud (Throttled)
    useEffect(() => {
        if (state.tableCode && state.phase !== 'login' && state.phase !== 'landing') {
            const syncToCloud = async () => {
                await supabase
                    .from('games')
                    .upsert({
                        code: state.tableCode,
                        state: state,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'code' });
            };
            syncToCloud();
        }
    }, [state]);

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

    useEffect(() => {
        if (state.phase === 'randomizing_dealer') {
            let count = 0;
            const maxCycles = 15 + Math.floor(Math.random() * 5);
            const interval = setInterval(() => {
                count++;
                dispatch({ type: 'UPDATE_ANIMATION_DEALER', payload: { index: count % 4 } });

                if (count >= maxCycles) {
                    clearInterval(interval);
                    setTimeout(() => {
                        dispatch({ type: 'SET_DEALER', payload: { dealerIndex: count % 4 } });
                    }, 500);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [state.phase]);

    useEffect(() => {
        if (state.phase === 'waiting_for_trick') {
            const timer = setTimeout(() => {
                dispatch({ type: 'CLEAR_TRICK' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [state.phase]);

    useEffect(() => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || !currentPlayer.isComputer || ['game_over', 'scoring', 'waiting_for_trick', 'randomizing_dealer', 'landing', 'lobby'].includes(state.phase)) return;
        if (state.stepMode) return;

        const timer = setTimeout(() => {
            if (state.phase === 'bidding') {
                if (state.biddingRound === 1) {
                    if (state.upcard && shouldCallTrump(currentPlayer.hand, state.upcard.suit)) {
                        dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard.suit, callerIndex: state.currentPlayerIndex, isLoner: false } });
                    } else {
                        dispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex } });
                    }
                } else {
                    const bestBid = getBestBid(currentPlayer.hand.filter(c => state.upcard && c.suit !== state.upcard.suit));
                    if (bestBid) {
                        dispatch({ type: 'MAKE_BID', payload: { suit: bestBid, callerIndex: state.currentPlayerIndex, isLoner: false } });
                    } else {
                        dispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex } });
                    }
                }
            } else if (state.phase === 'discard') {
                const cardToDiscard = [...currentPlayer.hand].sort((a, b) => a.rank.localeCompare(b.rank))[0];
                dispatch({ type: 'DISCARD_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: cardToDiscard.id } });
            } else if (state.phase === 'playing') {
                const cardToPlay = getBotMove(
                    currentPlayer.hand,
                    state.currentTrick,
                    state.trump!,
                    state.players.map(p => p.id),
                    currentPlayer.id
                );
                dispatch({ type: 'PLAY_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: cardToPlay.id } });
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [state.currentPlayerIndex, state.phase, state.players, state.trump, state.currentTrick, state.stepMode, state.biddingRound, state.upcard]);

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
