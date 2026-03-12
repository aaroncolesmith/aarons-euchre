import { GameState, Action } from '../types/game';
import { lobbyReducer } from './reducers/lobbyReducer';
import { matchReducer } from './reducers/matchReducer';
import { scoringReducer } from './reducers/scoringReducer';
import { systemReducer } from './reducers/systemReducer';
import { INITIAL_STATE_FUNC as BASE_INITIAL_STATE_FUNC } from './reducers/utils';
import Logger from '../utils/logger';

export const INITIAL_STATE = BASE_INITIAL_STATE_FUNC();

export const gameReducer = (state: GameState, action: Action): GameState => {
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

export const gameReducerFixed = (state: GameState, action: Action): GameState => {
    const newState = gameReducer(state, action);

    if (newState !== state && action.type !== 'UPDATE_ANIMATION_DEALER') {
        return { ...newState, lastActive: Date.now() };
    }
    return newState;
};
