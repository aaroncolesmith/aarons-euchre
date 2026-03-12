import { GameState, Action } from '../../types/game.ts';
import { generateTableCode, generateTableName, createEmptyPlayer, getEmptyStats, BOT_PERSONALITIES, BOT_NAMES_POOL, getTeamName } from './utils.ts';

export const lobbyReducer = (state: GameState, action: Action): GameState | null => {
    switch (action.type) {
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
            const isAlreadyLoaded = state.tableCode === action.payload.code;
            return {
                ...state,
                tableCode: action.payload.code,
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
                    personality: BOT_PERSONALITIES[name]
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

        case 'START_DAILY_CHALLENGE': {
            const { userName, dateString } = action.payload;
            
            // Build fixed 4-player board: User, Huber, J-Bock, Wooden
            // We guarantee seats: 0 (User), 1 (Huber), 2 (J-Bock - Partner), 3 (Wooden)
            const botNames = ['Huber', 'J-Bock', 'Wooden'];
            const dailyPlayers = [
                {
                    ...createEmptyPlayer(0),
                    name: userName,
                    isComputer: false,
                    stats: getEmptyStats()
                },
                ...botNames.map((botName, i) => ({
                    ...createEmptyPlayer(i + 1),
                    name: botName,
                    isComputer: true,
                    stats: getEmptyStats(),
                    personality: BOT_PERSONALITIES[botName]
                }))
            ];

            return {
                ...state,
                isDailyChallenge: true,
                tableId: `daily-${dateString}-${userName}`,
                tableName: `Hand of the Day (${dateString})`,
                tableCode: `DAILY-${dateString}-${userName}`,
                currentViewPlayerName: userName,
                players: dailyPlayers,
                phase: 'waiting_for_next_deal',
                dealerIndex: 0,
                displayDealerIndex: 0,
                teamNames: {
                    team1: getTeamName(userName, 'J-Bock'),
                    team2: getTeamName('Huber', 'Wooden')
                },
                logs: [`Welcome to the Hand of the Day for ${dateString}!`, ...state.logs]
            };
        }

        default:
            return null;
    }
};
