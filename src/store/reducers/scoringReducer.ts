import { GameState, Action, HandResult } from '../../types/game.ts';

export const scoringReducer = (state: GameState, action: Action): GameState | null => {
    switch (action.type) {
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

            const newScores = {
                team1: state.scores.team1 + p1,
                team2: state.scores.team2 + p2
            };

            const isWinnerT1 = p1 > p2;
            const handCount = state.handsPlayed + 1;
            const isGameOver = state.isDailyChallenge ? (handCount >= 4) : (newScores.team1 >= 10 || newScores.team2 >= 10);
            const isTeam1 = (idx: number) => idx === 0 || idx === 2;

            const handResult: HandResult = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: Date.now(),
                dealerIndex: state.dealerIndex,
                trump: state.trump!,
                trumpCallerIndex: state.trumpCallerIndex!,
                isLoner: state.isLoner,
                tricksWon: state.tricksWon,
                scoresAtEnd: newScores,
                winningTeam: isWinnerT1 ? 1 : 2
            };

            const updatedPlayers = state.players.map((p, i) => {
                const playerTeam1 = isTeam1(i);
                const isWinner = (isWinnerT1 && playerTeam1) || (!isWinnerT1 && !playerTeam1);
                const isCaller = state.trumpCallerIndex === i;
                const isTeamCaller = (isT1Caller && playerTeam1) || (!isT1Caller && !playerTeam1);

                return {
                    ...p,
                    hand: [],
                    stats: {
                        ...p.stats,
                        handsPlayed: p.stats.handsPlayed + 1,
                        handsWon: isWinner ? p.stats.handsWon + 1 : p.stats.handsWon,
                        callsWon: (isCaller && isWinner) ? p.stats.callsWon + 1 : p.stats.callsWon,
                        lonersWon: (isCaller && state.isLoner && callerTricks === 5) ? p.stats.lonersWon + 1 : p.stats.lonersWon,
                        euchresMade: (!isTeamCaller && isWinner) ? p.stats.euchresMade + 1 : p.stats.euchresMade,
                        euchred: (isTeamCaller && !isWinner) ? p.stats.euchred + 1 : p.stats.euchred,
                        sweeps: (isWinner && (playerTeam1 ? t1Tricks === 5 : t2Tricks === 5)) ? p.stats.sweeps + 1 : p.stats.sweeps,
                        swept: (!isWinner && (playerTeam1 ? t2Tricks === 5 : t1Tricks === 5)) ? p.stats.swept + 1 : p.stats.swept,
                        pointsScored: p.stats.pointsScored + (playerTeam1 ? p1 : p2)
                    }
                };
            });

            return {
                ...state,
                players: updatedPlayers,
                scores: newScores,
                handsPlayed: handCount,
                dealerIndex: (state.dealerIndex + 1) % 4,
                phase: isGameOver ? 'game_over' : 'waiting_for_next_deal',
                history: [handResult, ...state.history].slice(0, 50),
                currentTrick: [],
                tricksWon: state.players.reduce((acc, pl) => ({ ...acc, [pl.id]: 0 }), {}),
                trump: null,
                trumpCallerIndex: null,
                isLoner: false,
                biddingRound: 1,
                upcard: null,
                logs: [isGameOver ? 'GAME OVER!' : `Hand finished. Next deal in 4 seconds... Score: ${newScores.team1} - ${newScores.team2}`, ...state.logs],
                eventLog: [...state.eventLog, {
                    type: 'hand_result',
                    handResult,
                    timestamp: Date.now()
                }]
            };
        }

        default:
            return null;
    }
};
