import { GameState, Action, GameEvent } from '../../types/game.ts';
import { shuffleDeck, createDeck, dealHands, sortHand, trackTrumpCall, createTrumpCallLog, determineWinner, logPlayEvent, getEffectiveSuit, isValidPlay } from './utils.ts';
import { createDailyRNG } from '../../utils/rng.ts';
export const matchReducer = (state: GameState, action: Action): GameState | null => {
    switch (action.type) {
        case 'SET_DEALER': {
            const dealerIndex = action.payload.dealerIndex;
            const hands = action.payload.hands;
            const upcard = action.payload.upcard;

            const isValidHands = hands &&
                Array.isArray(hands) &&
                hands.length === 4 &&
                hands.every(h => Array.isArray(h) && h.length === 5 && h.every(c => c && c.suit && c.rank));
            const isValidUpcard = upcard && upcard.suit && upcard.rank;

            if (!isValidHands || !isValidUpcard) {
                const isDaily = state.isDailyChallenge;
                const dailySeed = isDaily && state.tableCode ? `${state.tableCode.replace('DAILY-', '')}-hand-${state.handsPlayed}` : undefined;
                const deck = shuffleDeck(createDeck(), isDaily ? createDailyRNG(dailySeed!) : undefined);
                const { hands: h, kitty: k } = dealHands(deck);
                return {
                    ...state,
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
                eventLog: [...state.eventLog, {
                    type: 'dealer',
                    dealerIndex,
                    dealerName: state.players[dealerIndex].name || 'Bot',
                    timestamp: Date.now()
                }]
            };
        }

        case 'MAKE_BID': {
            const { suit, callerIndex, isLoner } = action.payload;

            if (callerIndex !== state.currentPlayerIndex) {
                return state;
            }

            const caller = state.players[callerIndex];
            const logMsg = `${caller.name} called ${suit}${isLoner ? ' (GOING ALONE!)' : ''}.`;
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
            }).catch(() => { });

            const newPlayers = state.players.map((p, i) => {
                let updatedHand = p.hand;
                if (p.name === state.currentViewPlayerName && !p.isComputer) updatedHand = sortHand(p.hand, suit);

                if (i === callerIndex) {
                    return {
                        ...p,
                        hand: updatedHand,
                        lastDecision: action.payload.reasoning,
                        decisionHistory: action.payload.reasoning 
                            ? [...(p.decisionHistory || []), { timestamp: Date.now(), decision: action.payload.reasoning }].slice(-5)
                            : p.decisionHistory,
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
                const updatedPlayers = newPlayers.map((p, i) => {
                    if (i === state.dealerIndex) {
                        const newHand = [...p.hand, state.upcard!];
                        return { ...p, hand: p.name === state.currentViewPlayerName && !p.isComputer ? sortHand(newHand, suit) : newHand };
                    }
                    return p;
                });

                let trumpLog = null;
                if (callerIndex !== state.dealerIndex) {
                    trumpLog = createTrumpCallLog(
                        caller,
                        suit,
                        dealerName,
                        relationship,
                        state.upcard,
                        state.biddingRound,
                        state.tableCode || 'unknown',
                        isLoner
                    );

                    import('../../utils/trumpCallLogger').then(({ saveTrumpCallLog }) => {
                        saveTrumpCallLog(trumpLog!).catch(() => { });
                    });
                }

                const botAcknowledgments = state.players
                    .filter(p => (p.isComputer || !p.name))
                    .reduce((acc, p) => ({ ...acc, [p.name || `player-${p.id}`]: true }), {});

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
                    overlayMessage: logMsg,
                    overlayAcknowledged: botAcknowledgments,
                    trumpCallLogs: trumpLog ? [...state.trumpCallLogs, trumpLog] : state.trumpCallLogs
                };
            }

            const botAcknowledgments = state.players
                .filter(p => (p.isComputer || !p.name))
                .reduce((acc, p) => ({ ...acc, [p.name || `player-${p.id}`]: true }), {});

            const tLog = createTrumpCallLog(
                caller,
                suit,
                dealerName,
                relationship,
                null,
                state.biddingRound,
                state.tableCode || 'unknown',
                isLoner
            );

            import('../../utils/trumpCallLogger').then(({ saveTrumpCallLog }) => {
                saveTrumpCallLog(tLog).catch(() => { });
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
                overlayMessage: logMsg,
                overlayAcknowledged: botAcknowledgments,
                trumpCallLogs: [...state.trumpCallLogs, tLog]
            };
        }

        case 'PASS_BID': {
            const { playerIndex } = action.payload;

            if (playerIndex !== state.currentPlayerIndex) {
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
                    return null;
                }
            }
            return {
                ...state,
                players: state.players.map((p, i) => i === state.currentPlayerIndex ? { 
                    ...p, 
                    lastDecision: action.payload.reasoning,
                    decisionHistory: action.payload.reasoning 
                        ? [...(p.decisionHistory || []), { timestamp: Date.now(), decision: action.payload.reasoning }].slice(-5)
                        : p.decisionHistory
                } : p),
                currentPlayerIndex: nextPlayer,
                eventLog: [...state.eventLog, passEvent]
            };
        }

        case 'DISCARD_CARD': {
            const { playerIndex, cardId } = action.payload;

            if (playerIndex !== state.dealerIndex || state.phase !== 'discard') {
                return state;
            }

            const newHand = state.players[playerIndex].hand.filter(c => c.id !== cardId);

            const botAcknowledgments = state.players
                .filter(p => (p.isComputer || !p.name))
                .reduce((acc, p) => ({ ...acc, [p.name || `player-${p.id}`]: true }), {});

            let finalTrumpCallLogs = state.trumpCallLogs;
            if (state.trump && state.trumpCallerIndex === state.dealerIndex) {
                const caller = state.players[playerIndex];
                const trumpLog = createTrumpCallLog(
                    caller,
                    state.trump,
                    caller.name || 'Bot',
                    'Self',
                    state.upcard,
                    1,
                    state.tableCode || 'unknown',
                    state.isLoner,
                    newHand
                );

                import('../../utils/trumpCallLogger').then(({ saveTrumpCallLog }) => {
                    saveTrumpCallLog(trumpLog).catch(() => { });
                });

                finalTrumpCallLogs = [...state.trumpCallLogs, trumpLog];
            }

            return {
                ...state,
                players: state.players.map((p, i) =>
                    i === playerIndex ? { 
                        ...p, 
                        hand: newHand, 
                        lastDecision: action.payload.reasoning,
                        decisionHistory: action.payload.reasoning 
                            ? [...(p.decisionHistory || []), { timestamp: Date.now(), decision: action.payload.reasoning }].slice(-5)
                            : p.decisionHistory
                    } : p
                ),
                phase: 'playing',
                currentPlayerIndex: (state.dealerIndex + 1) % 4,
                overlayMessage: `${state.players[playerIndex].name} discarded. Let's play!`,
                overlayAcknowledged: botAcknowledgments,
                trumpCallLogs: finalTrumpCallLogs
            };
        }

        case 'PLAY_CARD': {
            const { playerIndex, cardId } = action.payload;

            if (playerIndex !== state.currentPlayerIndex) {
                return state;
            }

            const player = state.players[playerIndex];
            const card = player.hand.find(c => c.id === cardId);

            if (!card) return state;

            const leadSuit = state.currentTrick.length > 0 ? getEffectiveSuit(state.currentTrick[0].card, state.trump) : null;
            if (!isValidPlay(card, player.hand, leadSuit, state.trump)) {
                return state;
            }

            const newTrick = [...state.currentTrick, { playerId: player.id, playerIndex, card }];
            const newPlayers = state.players.map((p, i) =>
                i === playerIndex ? { 
                    ...p, 
                    hand: p.hand.filter(c => c.id !== cardId),
                    lastDecision: action.payload.reasoning,
                    decisionHistory: action.payload.reasoning 
                        ? [...(p.decisionHistory || []), { timestamp: Date.now(), decision: action.payload.reasoning }].slice(-5)
                        : p.decisionHistory
                } : p
            );

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
            }).catch(() => { });

            let nextIdx = (playerIndex + 1) % 4;
            if (state.isLoner) {
                const partnerIdx = (state.trumpCallerIndex! + 2) % 4;
                if (nextIdx === partnerIdx) nextIdx = (nextIdx + 1) % 4;
            }

            const playEv: GameEvent = {
                type: 'play',
                playerIndex,
                playerName: player.name || 'Bot',
                card,
                trickIndex: trickNum,
                timestamp: Date.now()
            };

            if (newTrick.length < (state.isLoner ? 3 : 4)) {
                return {
                    ...state,
                    players: newPlayers,
                    currentTrick: newTrick,
                    currentPlayerIndex: nextIdx,
                    eventLog: [...state.eventLog, playEv]
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
                eventLog: [...state.eventLog, playEv]
            };
        }

        case 'CLEAR_TRICK': {
            let totalCardsLeft;
            if (state.isLoner && state.trumpCallerIndex !== null) {
                const partnerIdx = (state.trumpCallerIndex + 2) % 4;
                totalCardsLeft = state.players.reduce((sum, p, i) => (i === partnerIdx ? sum : sum + p.hand.length), 0);
            } else {
                totalCardsLeft = state.players.reduce((sum, p) => sum + p.hand.length, 0);
            }
            const isHandOver = totalCardsLeft === 0;

            let logs = state.logs;
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

                const winTeam = (p1 > p2) ? state.teamNames.team1 : state.teamNames.team2;
                const pts = Math.max(p1, p2);
                logs = [`${winTeam} won the hand (+${pts})`, ...state.logs];
            }

            let nxtIdx = state.currentPlayerIndex;
            if (state.isLoner && !isHandOver && state.trumpCallerIndex !== null) {
                const partnerIdx = (state.trumpCallerIndex + 2) % 4;
                if (nxtIdx === partnerIdx) nxtIdx = (nxtIdx + 1) % 4;
            }

            return {
                ...state,
                currentTrick: [],
                currentPlayerIndex: nxtIdx,
                phase: isHandOver ? 'scoring' : 'playing',
                logs,
                overlayMessage: null
            };
        }

        case 'FORCE_NEXT_PLAYER':
            return {
                ...state,
                currentPlayerIndex: action.payload.nextPlayerIndex,
                logs: [`(System) Forced next player move.`, ...state.logs]
            };

        default:
            return null;
    }
};
