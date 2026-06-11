import { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from 'react';
import { GameState, Action, PlayerStats } from '../types/game';
import { supabase } from '../lib/supabase';
import { createDeck, dealHands, shuffleDeck } from '../utils/deck';
import { shouldCallTrump, shouldGoAlone, getBestBid, getBotMove, getCardValue } from '../utils/rules';
import { getAllPlayerStats, mergeAllStats, syncUnsyncedDailies, clearLeaderboardStatsCache, LOCAL_STORAGE_KEY } from '../utils/supabaseStats';
import { useHostElection } from '../utils/presence';
import { createDailyRNG } from '../utils/rng';
import { getHandNumberFromDateString } from '../utils/dailyUtils';
import Logger from '../utils/logger';
import { getStableUserId } from '../utils/identity';
import { APP_VERSION } from '../version';

// Reducers
import { gameReducerFixed, INITIAL_STATE as ENGINE_INITIAL_STATE } from './engine';
import { BOT_PERSONALITIES, INITIAL_STATE_FUNC } from './reducers/utils';
import { fetchPlayEvents } from '../utils/eventLogger';

const getPlayedCardsThisHand = (eventLog: GameState['eventLog']) => {
    const lastHandResultIndex = [...eventLog].reverse().findIndex(event => event.type === 'hand_result');
    const startIndex = lastHandResultIndex === -1 ? 0 : eventLog.length - lastHandResultIndex;

    return eventLog
        .slice(startIndex)
        .filter((event): event is Extract<GameState['eventLog'][number], { type: 'play' }> => event.type === 'play')
        .map(event => event.card);
};

const INITIAL_STATE: GameState = {
    ...ENGINE_INITIAL_STATE,
    currentUser: typeof window !== 'undefined' ? localStorage.getItem('euchre_current_user') : null,
    currentUserId: typeof window !== 'undefined'
        ? getStableUserId(localStorage.getItem('euchre_current_user'), false)
        : null
};

// Fallback for crypto.randomUUID
const uuidv4 = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Reducer is moved to engine.ts
const reducer = gameReducerFixed;

// --- Context ---
interface GameContextType {
    state: GameState;
    dispatch: (action: Action) => void;
    isHost: boolean;
    onlinePlayers: string[];
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
    const channelRef = useRef<any>(null);
    const lastBotDecisionRef = useRef<string | null>(null);
    const lastGameStatsSavedRef = useRef<string | null>(null);
    const bootstrappedTablesRef = useRef<Set<string>>(new Set());
    const appOpenLoggedRef = useRef(false);
    const { isHost, onlinePlayers } = useHostElection(state.tableCode, state.currentUser);

    // Enhanced dispatch that calls the authoritative server
    const serverDispatch = async (action: Action) => {
        // Optimistically apply locally for smooth UI (Phase C: Optional)
        // However, LOGIN and local-only actions should stay local
        if (['LOGIN', 'LOAD_GLOBAL_STATS', 'CLEAR_HISTORY'].includes(action.type)) {
            dispatch(action);
            return;
        }

        if (action.type === 'LOGOUT') {
            supabase.auth.signOut();
            dispatch(action);
            return;
        }

        // LOAD_EXISTING_GAME needs special rehydration logic if hands are missing
        if (action.type === 'LOAD_EXISTING_GAME') {
            const gameState = action.payload.gameState;
            const needsRehydration = gameState.tableCode && 
                                   !gameState.tableCode.startsWith('DAILY-') &&
                                   gameState.players.every(p => !p.hand || p.hand.length === 0);
            
            if (needsRehydration) {
                rehydrateGame(gameState);
                return;
            }
            dispatch(action);
            return;
        }

        if (!state.tableCode || state.tableCode.startsWith('DAILY-') || state.tableCode.startsWith('EUKLE-')) {
            broadcastDispatch(action);
            return;
        }

        const actionWithId: Action = {
            ...action,
            actionId: action.actionId || uuidv4()
        };

        // --- OPTIMISTIC UI ---
        // Apply locally immediately so the user sees the card move/bid happen.
        // SET_DEALER is excluded: the server enriches it with server-generated
        // hands (T-10) so we must wait for the authoritative broadcast rather
        // than applying a handless action that would trigger the reducer's
        // random fallback and diverge from the server's deal.
        if (!['CREATE_TABLE', 'JOIN_TABLE', 'SET_DEALER'].includes(action.type)) {
            dispatch(actionWithId);
        }

        try {
            Logger.debug(`[SERVER AUTH] Sending intent: ${actionWithId.type} (${actionWithId.actionId})`);
            const shouldBootstrap =
                !!state.tableCode &&
                !state.tableCode.startsWith('DAILY-') &&
                !bootstrappedTablesRef.current.has(state.tableCode);

            const { error } = await supabase.functions.invoke('process-action', {
                body: {
                    action: actionWithId,
                    tableCode: state.tableCode,
                    bootstrapState: shouldBootstrap ? state : undefined
                }
            });

            if (error) {
                Logger.warn('[SERVER AUTH] Failed:', error);
                broadcastDispatch(actionWithId);
            } else if (shouldBootstrap && state.tableCode) {
                bootstrappedTablesRef.current.add(state.tableCode);
            }
        } catch (err) {
            Logger.error('[SERVER AUTH] Error:', err);
            broadcastDispatch(actionWithId);
        }
    };

    // Legacy broadcast for syncing between clients directly
    const broadcastDispatch = async (action: Action) => {
        const actionWithId: Action = {
            ...action,
            actionId: action.actionId || uuidv4()
        };

        dispatch(actionWithId);
        if (channelRef.current && state.tableCode) {
            Logger.debug(`Broadcasting action: ${actionWithId.type} (${actionWithId.actionId})`);
            await channelRef.current.send({
                type: 'broadcast',
                event: 'game_action',
                payload: actionWithId
            });
        }
    };

    const getGlobalStats = (): { [name: string]: PlayerStats } => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    };

    const saveActiveGame = (state: GameState) => {
        if (!state.tableCode) return;
        try {
            const saved = localStorage.getItem('euchre_active_games');
            const games: Record<string, GameState> = saved ? JSON.parse(saved) : {};

            games[state.tableCode] = state;

            // Prune: remove completed games older than 3 days, and cap at 20 entries.
            const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const pruned = Object.entries(games)
                .filter(([, g]) => {
                    const isOldCompleted = g.phase === 'game_over' && (now - (g.lastActive || 0)) > THREE_DAYS_MS;
                    return !isOldCompleted;
                })
                .sort(([, a], [, b]) => (b.lastActive || 0) - (a.lastActive || 0))
                .slice(0, 20);

            localStorage.setItem('euchre_active_games', JSON.stringify(Object.fromEntries(pruned)));
        } catch {
            // Quota exceeded or parse error — best effort; don't crash the game.
        }
    };

    const rehydrateGame = async (sanitizedState: GameState) => {
        if (!sanitizedState.tableCode) return;
        Logger.info(`[REHYDRATE] Fetching events for ${sanitizedState.tableCode}...`);
        
        const events = await fetchPlayEvents(sanitizedState.tableCode);
        if (events.length === 0) {
            Logger.warn('[REHYDRATE] No events found, using snapshot.');
            dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: sanitizedState } });
            return;
        }

        // Start from initial state and apply all events
        let fullState: GameState = { 
            ...(INITIAL_STATE_FUNC() as GameState), 
            tableCode: sanitizedState.tableCode 
        };
        
        events.forEach(event => {
            if (event.action) {
                fullState = gameReducerFixed(fullState, event.action);
            }
        });

        Logger.info(`[REHYDRATE] Reconstructed state to version ${fullState.stateVersion}`);
        dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: fullState } });
    };

    useEffect(() => {
        // One-time prune of old completed games.
        try {
            const saved = localStorage.getItem('euchre_active_games');
            if (saved) {
                const games: Record<string, GameState> = JSON.parse(saved);
                const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                const pruned = Object.entries(games).filter(
                    ([, g]) => !(g.phase === 'game_over' && (now - (g.lastActive || 0)) > THREE_DAYS_MS)
                );
                localStorage.setItem('euchre_active_games', JSON.stringify(Object.fromEntries(pruned)));
            }
        } catch { /* ignore */ }

        const loadStats = async (username: string | null) => {
            const localStats = getGlobalStats();
            const cloudStats = await getAllPlayerStats();
            const mergedStats = mergeAllStats(localStats, cloudStats);
            localStorage.setItem('euchre_global_stats_v4', JSON.stringify(mergedStats));
            dispatch({ type: 'LOAD_GLOBAL_STATS', payload: mergedStats });
            if (username) await syncUnsyncedDailies(username);
        };

        // Restore session from Supabase (cross-device) or localStorage (legacy fallback).
        // onAuthStateChange fires immediately with INITIAL_SESSION if a session exists.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const username = session.user.user_metadata?.username as string | undefined;
                if (username) {
                    localStorage.setItem('euchre_current_user', username);
                    dispatch({ type: 'LOGIN', payload: { userName: username, userId: session.user.id } });
                    // H-4: Log one APP_OPEN per session for DAU tracking
                    if (!appOpenLoggedRef.current) {
                        appOpenLoggedRef.current = true;
                        supabase.from('play_events').insert({
                            game_code: 'app',
                            hand_number: 0,
                            event_type: 'APP_OPEN',
                            event_data: { version: APP_VERSION },
                            player_name: username
                        }).then();
                    }
                }
            }
        });

        // After listener is set up, check for no-session case and fall back to localStorage.
        supabase.auth.getSession().then(({ data: { session } }) => {
            const username = session?.user?.user_metadata?.username as string | undefined;
            if (!session) {
                const savedUser = localStorage.getItem('euchre_current_user');
                if (savedUser) dispatch({ type: 'LOGIN', payload: { userName: savedUser } });
            }
            loadStats(username || localStorage.getItem('euchre_current_user'));
        });

        return () => subscription.unsubscribe();
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
            .on('broadcast', { event: 'authoritative_action' }, ({ payload }) => {
                Logger.info('[SERVER AUTH] Authority confirmed action:', payload.action.type);
                dispatch(payload.action);
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

    // Handle Match Persistence and Transitions
    useEffect(() => {
        if (state.tableCode || state.currentUser) {
            Logger.setMetadata({
                tableCode: state.tableCode || undefined,
                userName: state.currentUser || undefined,
                appVersion: APP_VERSION
            });
        }
    }, [state.tableCode, state.currentUser]);

    // Persist active game to localStorage for fast local restore.
    // Cloud state is owned exclusively by the process-action edge function,
    // which writes a sanitized (hand-stripped) snapshot — never the full state.
    // We only checkpoint on phase transitions (not every action) to avoid
    // writing megabytes of state on every card play.
    useEffect(() => {
        if (!state.tableCode || state.phase === 'login' || state.phase === 'landing') return;
        saveActiveGame(state);
    }, [state.phase, state.tableCode, state.handsPlayed, state.scores]);


    // Handle Match Completion and Stats Saving
    // Regular games: stats are derived server-side from play_events via
    //   refresh_player_stats_from_events(), triggered by the bot cascade (T-11).
    //   No client write needed.
    // Daily games: run client-side, so we send a SYNC_PLAYER_STATS action to
    //   the edge function which atomically increments each player's career stats
    //   using the service role key (bypasses anon-key RLS on player_stats).
    useEffect(() => {
        if (state.phase !== 'game_over' || !state.tableCode) return;
        if (lastGameStatsSavedRef.current === state.tableCode) return;

        const isDaily = state.tableCode.startsWith('DAILY-');
        const isEukle = state.tableCode.startsWith('EUKLE-');
        if (isEukle) {
            // Eukle: submit score to eukle_scores (differentiated from daily stats).
            const syncEukleScore = async () => {
                const heroIdx = state.players.findIndex(p => p.name === state.currentUser);
                if (heroIdx === -1) return;
                const isTeam1 = heroIdx === 0 || heroIdx === 2;
                const won = isTeam1 ? state.scores.team1 >= 10 : state.scores.team2 >= 10;
                const eukleNumber = parseInt(state.tableCode!.split('-')[1], 10);
                try {
                    await supabase.functions.invoke('process-action', {
                        body: {
                            tableCode: state.tableCode!,
                            action: {
                                type: 'SUBMIT_EUKLE_SCORE',
                                payload: {
                                    player_name: state.currentUser,
                                    eukle_number: eukleNumber,
                                    won,
                                    team_points: isTeam1 ? state.scores.team1 : state.scores.team2,
                                    opp_points: isTeam1 ? state.scores.team2 : state.scores.team1,
                                }
                            }
                        }
                    });
                    Logger.info(`[STATS] Eukle #${eukleNumber} score submitted`);
                } catch (err) {
                    Logger.error('[STATS] Eukle score submission failed', err);
                }
                lastGameStatsSavedRef.current = state.tableCode!;
            };
            syncEukleScore();
            return;
        }
        if (!isDaily) {
            // Regular games: server already handled stats via the cascade. Mark done.
            lastGameStatsSavedRef.current = state.tableCode;
            // Refresh leaderboard display from cloud (stats may have just updated).
            const refreshDisplay = async () => {
                clearLeaderboardStatsCache();
                const cloudStats = await getAllPlayerStats();
                const localStats = getGlobalStats();
                const merged = mergeAllStats(localStats, cloudStats);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
                dispatch({ type: 'LOAD_GLOBAL_STATS', payload: merged });
            };
            refreshDisplay();
            return;
        }

        // Daily game: build per-player deltas and sync via edge function.
        const syncDailyStats = async () => {
            Logger.info(`[STATS] Syncing daily game stats for ${state.tableCode}`);

            const playerDeltas = state.players
                .filter(p => p.name)
                .map((p, i) => {
                    const isTeam1 = i === 0 || i === 2;
                    const wonGame = isTeam1
                        ? state.scores.team1 >= 10
                        : state.scores.team2 >= 10;
                    return {
                        name: p.name!,
                        ...p.stats,
                        gamesPlayed: 1,       // override — one game per session
                        gamesWon: wonGame ? 1 : 0,
                    };
                });

            try {
                await supabase.functions.invoke('process-action', {
                    body: {
                        tableCode: state.tableCode!,
                        action: { type: 'SYNC_PLAYER_STATS', payload: { playerDeltas } }
                    }
                });
                Logger.info(`[STATS] Daily stats synced for ${playerDeltas.length} players`);
            } catch (err) {
                Logger.error('[STATS] Daily stats sync failed', err);
            }

            // Refresh leaderboard display (bust cache so new stats appear immediately)
            clearLeaderboardStatsCache();
            const cloudStats = await getAllPlayerStats();
            const localStats = getGlobalStats();
            const merged = mergeAllStats(localStats, cloudStats);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            dispatch({ type: 'LOAD_GLOBAL_STATS', payload: merged });

            lastGameStatsSavedRef.current = state.tableCode!;
        };

        syncDailyStats();
    }, [state.phase, state.tableCode]);

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
                        const allBotsGame = state.players.every(p => p.isComputer);
                        // If all bots, randomizely generate dealer.
                        // If humans exist, ONLY the `isHost` human will generate and broadcast.
                        const shouldIGenerate = allBotsGame ? true : isHost;

                        if (shouldIGenerate) {
                            const isEukle = !!state.tableCode?.startsWith('EUKLE-');
                            const isSeededLocal = state.isDailyChallenge || isEukle;
                            if (isSeededLocal) {
                                // Daily / Eukle: generate locally so the seeded deck is deterministic
                                let seed: string;
                                if (isEukle) {
                                    seed = `eukle-${state.tableCode!.split('-')[1]}-${state.handsPlayed}`;
                                } else {
                                    const dateStr = state.tableCode?.split('-').slice(1, 4).join('-') ?? '';
                                    const handNum = dateStr ? getHandNumberFromDateString(dateStr) : 0;
                                    seed = `hand-${handNum}-${state.handsPlayed}`;
                                }
                                const deck = shuffleDeck(createDeck(), createDailyRNG(seed));
                                const { hands, kitty } = dealHands(deck);
                                serverDispatch({
                                    type: 'SET_DEALER',
                                    payload: { dealerIndex: count % 4, hands, upcard: kitty[0] }
                                });
                            } else {
                                // Multiplayer: server generates the deck (T-10). Send only the
                                // dealer index; the edge function enriches with hands before
                                // broadcasting, preventing any client from rigging the deal.
                                serverDispatch({
                                    type: 'SET_DEALER',
                                    payload: { dealerIndex: count % 4 }
                                });
                            }
                        }
                    }, 500);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [state.phase]);

    // Handle transition to next hand.
    // For regular multiplayer games the server cascade (T-11) handles dealing,
    // so this effect only runs for Daily Challenge and all-bot local games.
    useEffect(() => {
        if (state.phase !== 'waiting_for_next_deal') return;

        const isRegularMultiplayer =
            !!state.tableCode &&
            !state.tableCode.startsWith('DAILY-') &&
            !state.players.every(p => p.isComputer);

        if (isRegularMultiplayer) return; // server cascade owns this

        const nextDealer = state.players[state.dealerIndex];

        const dealNewHand = () => {
            const isDaily = state.isDailyChallenge;
            const dailySeed = isDaily && state.tableCode ? `${state.tableCode.split('-').slice(1, 4).join('-')}-hand-${state.handsPlayed}` : undefined;
            const deck = shuffleDeck(createDeck(), isDaily ? createDailyRNG(dailySeed!) : undefined);
            const { hands, kitty } = dealHands(deck);
            serverDispatch({
                type: 'SET_DEALER',
                payload: { dealerIndex: state.dealerIndex, hands, upcard: kitty[0] }
            });
        };

        if (nextDealer.name === state.currentUser) {
            setTimeout(dealNewHand, 100);
        } else if (nextDealer.isComputer && isHost) {
            setTimeout(dealNewHand, 500);
        }
    }, [state.phase, state.dealerIndex, state.currentUser, isHost]);

    // Trick/Hand Completion.
    // For regular multiplayer games the server cascade (T-11) sends CLEAR_TRICK
    // and FINISH_HAND, so the client effects only run for Daily and all-bot games.
    useEffect(() => {
        if (state.phase !== 'waiting_for_trick') return;

        const isRegularMultiplayer =
            !!state.tableCode &&
            !state.tableCode.startsWith('DAILY-') &&
            !state.players.every(p => p.isComputer);
        if (isRegularMultiplayer) return;

        if (!isHost && !state.players.every(p => p.isComputer)) return;

        const timer = setTimeout(() => {
            serverDispatch({ type: 'CLEAR_TRICK' });
        }, 3000);
        return () => clearTimeout(timer);
    }, [state.phase, state.players, isHost]);

    useEffect(() => {
        if (state.phase !== 'scoring') return;

        const isRegularMultiplayer =
            !!state.tableCode &&
            !state.tableCode.startsWith('DAILY-') &&
            !state.players.every(p => p.isComputer);
        if (isRegularMultiplayer) return;

        if (!isHost && !state.players.every(p => p.isComputer)) return;

        const timer = setTimeout(() => {
            serverDispatch({ type: 'FINISH_HAND' });
        }, 2000);
        return () => clearTimeout(timer);
    }, [state.phase, state.players, isHost]);

    // Bot Logic (client-side).
    // For regular multiplayer games the server cascade (T-11) drives bot moves,
    // so this effect is disabled for those games to prevent racing the server.
    // It remains active for Daily Challenge and all-bot local games.
    useEffect(() => {
        const isRegularMultiplayer =
            !!state.tableCode &&
            !state.tableCode.startsWith('DAILY-') &&
            !state.players.every(p => p.isComputer);
        if (isRegularMultiplayer) return;

        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || !currentPlayer.isComputer || ['game_over', 'scoring', 'waiting_for_trick', 'randomizing_dealer', 'landing', 'lobby'].includes(state.phase)) return;
        if (state.stepMode) return;

        if (!isHost && !state.players.every(p => p.isComputer)) return;

        const decisionKey = `${state.tableCode}-${state.phase}-${state.biddingRound}-${state.currentPlayerIndex}-${currentPlayer.hand.length}`;
        if (lastBotDecisionRef.current === decisionKey) return;

        const timer = setTimeout(() => {
            if (lastBotDecisionRef.current === decisionKey) return;
            lastBotDecisionRef.current = decisionKey;

            const position = (state.currentPlayerIndex - state.dealerIndex + 4) % 4;
            const personality = currentPlayer.personality || BOT_PERSONALITIES[currentPlayer.name || ''] || { archetype: 'Generic' };
            if (state.phase === 'bidding') {
                if (state.biddingRound === 1 && state.upcard) {
                    const result = shouldCallTrump(
                        currentPlayer.hand,
                        state.upcard.suit,
                        personality,
                        position,
                        false,
                        null,
                        {
                            scores: state.scores,
                            myIndex: state.currentPlayerIndex
                        }
                    );
                    if (result.call) {
                        const lonerCheck = shouldGoAlone(currentPlayer.hand, state.upcard.suit, personality);
                        serverDispatch({
                            type: 'MAKE_BID',
                            payload: { suit: state.upcard.suit, callerIndex: state.currentPlayerIndex, isLoner: lonerCheck.goAlone, reasoning: result.reasoning }
                        });
                    } else {
                        serverDispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex, reasoning: result.reasoning } });
                    }
                } else if (state.biddingRound === 2) {
                    const result = getBestBid(
                        currentPlayer.hand.filter(c => state.upcard && c.suit !== state.upcard.suit),
                        personality,
                        position,
                        true,
                        state.upcard?.suit || null,
                        {
                            scores: state.scores,
                            myIndex: state.currentPlayerIndex
                        }
                    );
                    if (result.suit) {
                        const lonerCheck = shouldGoAlone(currentPlayer.hand, result.suit, personality);
                        serverDispatch({
                            type: 'MAKE_BID',
                            payload: { suit: result.suit, callerIndex: state.currentPlayerIndex, isLoner: lonerCheck.goAlone, reasoning: result.reasoning }
                        });
                    } else if (state.currentPlayerIndex === state.dealerIndex) {
                        serverDispatch({
                            type: 'MAKE_BID',
                            payload: { suit: result.bestSuitAnyway, callerIndex: state.currentPlayerIndex, isLoner: false, reasoning: 'Stuck dealer' }
                        });
                    } else {
                        serverDispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex, reasoning: result.reasoning } });
                    }
                }
            } else if (state.phase === 'discard') {
                const cardToDiscard = [...currentPlayer.hand].sort((a, b) => getCardValue(a, state.trump, null) - getCardValue(b, state.trump, null))[0];
                        serverDispatch({ type: 'DISCARD_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: cardToDiscard.id } });
            } else if (state.phase === 'playing') {
                const playedCardsThisHand = getPlayedCardsThisHand(state.eventLog);
                const result = getBotMove(
                    currentPlayer.hand,
                    state.currentTrick,
                    state.trump!,
                    state.players.map(p => p.id),
                    currentPlayer.id,
                    state.trumpCallerIndex,
                    personality,
                    { playedCardsThisHand }
                );
                serverDispatch({ type: 'PLAY_CARD', payload: { playerIndex: state.currentPlayerIndex, cardId: result.card.id, reasoning: result.reasoning } });
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [state.currentPlayerIndex, state.phase, isHost, state.players, state.tableCode, state.biddingRound, state.stepMode]);

    return (
        <GameContext.Provider value={{ state, dispatch: serverDispatch, isHost, onlinePlayers }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within GameProvider');
    return context;
};

// --- Local Storage Helpers for Active Games ---
export const getSavedGames = (): { [code: string]: GameState } => {
    const saved = localStorage.getItem('euchre_active_games');
    return saved ? JSON.parse(saved) : {};
};

export const deleteActiveGame = async (tableCode: string) => {
    try {
        const saved = localStorage.getItem('euchre_active_games');
        if (saved) {
            const games = JSON.parse(saved);
            delete games[tableCode];
            localStorage.setItem('euchre_active_games', JSON.stringify(games));
        }
    } catch { /* ignore quota / parse errors */ }
    
    // Attempt to soft-delete from Supabase if we have cloud access
    try {
        await supabase.from('games')
            .update({ deleted_at: new Date().toISOString() })
            .eq('code', tableCode);
    } catch (e) {
        // Ignore error
    }
};
