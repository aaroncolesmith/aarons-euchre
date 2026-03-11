import { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from 'react';
import { GameState, Action, PlayerStats } from '../types/game';
import { supabase } from '../lib/supabase';
import { createDeck, dealHands, shuffleDeck } from '../utils/deck';
import { shouldCallTrump, shouldGoAlone, getBestBid, getBotMove, getCardValue } from '../utils/rules';
import { saveMultiplePlayerStats, getAllPlayerStats, mergeAllStats } from '../utils/supabaseStats';
import Logger from '../utils/logger';

// Reducers
import { lobbyReducer } from './reducers/lobbyReducer';
import { matchReducer } from './reducers/matchReducer';
import { scoringReducer } from './reducers/scoringReducer';
import { systemReducer } from './reducers/systemReducer';
import { INITIAL_STATE_FUNC, BOT_PERSONALITIES, getEmptyStats } from './reducers/utils';

const INITIAL_STATE = INITIAL_STATE_FUNC();

// --- Combined Reducer ---
const gameReducer = (state: GameState, action: Action): GameState => {
    Logger.debug('Action Dispatched:', action);

    // 1. Try lobby actions
    const lobbyState = lobbyReducer(state, action);
    if (lobbyState) return lobbyState;

    // 2. Try match actions
    const matchState = matchReducer(state, action);
    if (matchState) return matchState;

    // 3. Try scoring actions
    const scoringState = scoringReducer(state, action);
    if (scoringState) return scoringState;

    // 4. Try system actions
    const systemState = systemReducer(state, action);
    if (systemState) return systemState;

    return state; // Default fallback
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
            }
        }
    };

    const getGlobalStats = (): { [name: string]: PlayerStats } => {
        const saved = localStorage.getItem('euchre_global_stats_v4');
        return saved ? JSON.parse(saved) : {};
    };

    const saveGlobalStats = async (stats: { [name: string]: PlayerStats }) => {
        localStorage.setItem('euchre_global_stats_v4', JSON.stringify(stats));
        await saveMultiplePlayerStats(stats);
    };

    const saveActiveGame = (state: GameState) => {
        if (!state.tableCode) return;
        const saved = localStorage.getItem('euchre_active_games');
        const games = saved ? JSON.parse(saved) : {};
        games[state.tableCode] = state;
        localStorage.setItem('euchre_active_games', JSON.stringify(games));
    };

    useEffect(() => {
        const savedUser = localStorage.getItem('euchre_current_user');
        if (savedUser) dispatch({ type: 'LOGIN', payload: { userName: savedUser } });

        const init = async () => {
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

    // Persist active game state
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
                lastGameStatsSavedRef.current = state.tableCode;
                return;
            }

            const syncGlobalStats = async () => {
                Logger.info(`[STATS] AUTHORITY (${state.currentUser}): Saving final match stats`);
                const globalStats = getGlobalStats();

                state.players.forEach((p, i) => {
                    if (!p.name) return;
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
                        lonersWon: (prevGlobal.lonersWon || 0) + p.stats.lonersWon,
                        pointsScored: (prevGlobal.pointsScored || 0) + p.stats.pointsScored,
                        euchresMade: (prevGlobal.euchresMade || 0) + p.stats.euchresMade,
                        euchred: (prevGlobal.euchred || 0) + p.stats.euchred,
                        sweeps: (prevGlobal.sweeps || 0) + p.stats.sweeps,
                        swept: (prevGlobal.swept || 0) + p.stats.swept,
                    } as PlayerStats;
                });

                try {
                    await saveGlobalStats(globalStats);
                } catch (err) {
                    Logger.error('[STATS] Global sync failed', err);
                }
                lastGameStatsSavedRef.current = state.tableCode!;
            };

            syncGlobalStats();
        }
    }, [state.phase, state.tableCode, state.currentUser]);

    // Dealer Animation and Selection
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
                        const firstHumanSeat = state.players.findIndex(p => p.name && !p.isComputer);
                        const myPlayerIndex = state.players.findIndex(p => p.name === state.currentUser);
                        const allBotsGame = state.players.every(p => p.isComputer);
                        const shouldIGenerate = allBotsGame ? true : (myPlayerIndex !== -1 && (myPlayerIndex === firstHumanSeat || firstHumanSeat === -1));

                        if (shouldIGenerate) {
                            const deck = shuffleDeck(createDeck());
                            const { hands, kitty } = dealHands(deck);
                            broadcastDispatch({
                                type: 'SET_DEALER',
                                payload: {
                                    dealerIndex: count % 4,
                                    hands,
                                    upcard: kitty[0]
                                }
                            });
                        }
                    }, 500);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [state.phase]);

    // Handle transition to next hand
    useEffect(() => {
        if (state.phase === 'waiting_for_next_deal') {
            const nextDealer = state.players[state.dealerIndex];
            const scoringAuthority = getScoringAuthority();
            const isBroadcaster = state.currentUser === scoringAuthority;

            const dealNewHand = () => {
                const deck = shuffleDeck(createDeck());
                const { hands, kitty } = dealHands(deck);
                broadcastDispatch({
                    type: 'SET_DEALER',
                    payload: {
                        dealerIndex: state.dealerIndex,
                        hands,
                        upcard: kitty[0]
                    }
                });
            };

            if (nextDealer.name === state.currentUser) {
                setTimeout(dealNewHand, 100);
            } else if (nextDealer.isComputer && isBroadcaster) {
                setTimeout(dealNewHand, 500);
            }
        }
    }, [state.phase, state.dealerIndex, state.currentUser]);

    // Trick/Hand Completion
    useEffect(() => {
        if (state.phase === 'waiting_for_trick') {
            const primaryHumanName = state.players.find(p => !p.isComputer && p.name)?.name;
            if (state.currentViewPlayerName !== primaryHumanName && !state.players.every(p => p.isComputer)) return;

            const timer = setTimeout(() => {
                broadcastDispatch({ type: 'CLEAR_TRICK' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [state.phase, state.players, state.currentViewPlayerName]);

    useEffect(() => {
        if (state.phase === 'scoring') {
            const primaryHumanName = state.players.find(p => !p.isComputer && p.name)?.name;
            if (state.currentViewPlayerName !== primaryHumanName && !state.players.every(p => p.isComputer)) return;

            const timer = setTimeout(() => {
                broadcastDispatch({ type: 'FINISH_HAND' });
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [state.phase, state.players, state.currentViewPlayerName]);

    // Bot Logic
    useEffect(() => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || !currentPlayer.isComputer || ['game_over', 'scoring', 'waiting_for_trick', 'randomizing_dealer', 'landing', 'lobby'].includes(state.phase)) return;
        if (state.stepMode) return;

        const primaryHumanName = state.players.find(p => !p.isComputer && p.name)?.name;
        if (state.currentViewPlayerName !== primaryHumanName) return;

        const decisionKey = `${state.tableCode}-${state.phase}-${state.biddingRound}-${state.currentPlayerIndex}-${currentPlayer.hand.length}`;
        if (lastBotDecisionRef.current === decisionKey) return;

        const timer = setTimeout(() => {
            if (lastBotDecisionRef.current === decisionKey) return;
            lastBotDecisionRef.current = decisionKey;

            const position = (state.currentPlayerIndex - state.dealerIndex + 4) % 4;
            const personality = currentPlayer.personality || BOT_PERSONALITIES[currentPlayer.name || ''] || { archetype: 'Generic' };
            if (state.phase === 'bidding') {
                if (state.biddingRound === 1 && state.upcard) {
                    const result = shouldCallTrump(currentPlayer.hand, state.upcard.suit, personality, position, false, null);
                    if (result.call) {
                        const lonerCheck = shouldGoAlone(currentPlayer.hand, state.upcard.suit, personality);
                        broadcastDispatch({
                            type: 'MAKE_BID',
                            payload: { suit: state.upcard.suit, callerIndex: state.currentPlayerIndex, isLoner: lonerCheck.goAlone, reasoning: result.reasoning }
                        });
                    } else {
                        broadcastDispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex, reasoning: result.reasoning } });
                    }
                } else if (state.biddingRound === 2) {
                    const result = getBestBid(currentPlayer.hand.filter(c => state.upcard && c.suit !== state.upcard.suit), personality, position, true, state.upcard?.suit || null);
                    if (result.suit) {
                        const lonerCheck = shouldGoAlone(currentPlayer.hand, result.suit, personality);
                        broadcastDispatch({
                            type: 'MAKE_BID',
                            payload: { suit: result.suit, callerIndex: state.currentPlayerIndex, isLoner: lonerCheck.goAlone, reasoning: result.reasoning }
                        });
                    } else if (state.currentPlayerIndex === state.dealerIndex) {
                        broadcastDispatch({
                            type: 'MAKE_BID',
                            payload: { suit: result.bestSuitAnyway, callerIndex: state.currentPlayerIndex, isLoner: false, reasoning: 'Stuck dealer' }
                        });
                    } else {
                        broadcastDispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex, reasoning: result.reasoning } });
                    }
                }
            } else if (state.phase === 'discard') {
                const cardToDiscard = [...currentPlayer.hand].sort((a, b) => getCardValue(a, state.trump, null) - getCardValue(b, state.trump, null))[0];
                broadcastDispatch({ type: 'DISCARD_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: cardToDiscard.id } });
            } else if (state.phase === 'playing') {
                const result = getBotMove(currentPlayer.hand, state.currentTrick, state.trump!, state.players.map(p => p.id), currentPlayer.id, state.trumpCallerIndex, personality);
                broadcastDispatch({ type: 'PLAY_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: result.card.id, reasoning: result.reasoning } });
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [state.currentPlayerIndex, state.phase]);

    return (
        <GameContext.Provider value={{ state, dispatch: broadcastDispatch }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within GameProvider');
    return context;
};
