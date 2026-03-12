import { GameState, Action } from '../../types/game.ts';
import { INITIAL_STATE_FUNC } from './utils.ts';

export const systemReducer = (state: GameState, action: Action): GameState | null => {
    switch (action.type) {
        case 'LOGIN': {
            const enteredName = action.payload.userName;
            const normalizedName = enteredName.toLowerCase();
            const knownUsers = ['aaron', 'polina', 'gray-gray', 'mimi', 'micah', 'cherrie', 'peter-playwright', 'test'];
            const matchedUser = knownUsers.find(u => u === normalizedName);
            const displayName = matchedUser
                ? ['Aaron', 'Polina', 'Gray-Gray', 'Mimi', 'Micah', 'Cherrie', 'Peter-Playwright', 'TEST'][knownUsers.indexOf(matchedUser)]
                : enteredName;
            return { ...state, currentUser: displayName, phase: 'landing' };
        }

        case 'LOGOUT':
            localStorage.removeItem('euchre_current_user');
            return { ...INITIAL_STATE_FUNC(), currentUser: null };

        case 'LOAD_EXISTING_GAME': {
            const loaded = action.payload.gameState;
            const currentUser = state.currentUser;
            const isPlayerInGame = loaded.players?.some(p => p.name === currentUser);
            return {
                ...INITIAL_STATE_FUNC(),
                ...loaded,
                currentUser,
                currentViewPlayerName: isPlayerInGame ? currentUser : (loaded.currentViewPlayerName || currentUser)
            };
        }

        case 'EXIT_TO_LANDING':
            return { ...INITIAL_STATE_FUNC(), currentUser: state.currentUser, phase: 'landing' };

        case 'PLAY_AGAIN': {
            const tableCode = state.tableCode;
            const tableId = state.tableId;
            const tableName = state.tableName;
            const players = state.players.map((p, i) => ({
                ...INITIAL_STATE_FUNC().players[i],
                name: p.name,
                isComputer: p.isComputer,
                personality: p.personality
            }));

            return {
                ...INITIAL_STATE_FUNC(),
                tableCode,
                tableId,
                tableName,
                players,
                currentUser: state.currentUser,
                currentViewPlayerName: state.currentViewPlayerName,
                phase: 'lobby',
                logs: [`Game reset. Starting a new match at ${tableName}.`, ...state.logs]
            };
        }

        case 'CLEAR_OVERLAY':
            return {
                ...state,
                overlayMessage: null,
                overlayAcknowledged: {
                    ...state.overlayAcknowledged,
                    [state.currentUser || '']: true
                }
            };

        case 'TOGGLE_STEP_MODE':
            return { ...state, stepMode: !state.stepMode };

        case 'UPDATE_ANIMATION_DEALER':
            return {
                ...state,
                displayDealerIndex: action.payload.index,
            };

        case 'FORCE_PHASE':
            return {
                ...state,
                phase: action.payload.phase,
                logs: [`(System) Forced state recovery to ${action.payload.phase}`, ...state.logs]
            };

        default:
            return null;
    }
};
