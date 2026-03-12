import { GameState, Action } from '../types/game.ts';
import { lobbyReducer } from './reducers/lobbyReducer.ts';
import { matchReducer } from './reducers/matchReducer.ts';
import { scoringReducer } from './reducers/scoringReducer.ts';
import { systemReducer } from './reducers/systemReducer.ts';
import { INITIAL_STATE_FUNC as BASE_INITIAL_STATE_FUNC } from './reducers/utils.ts';
import Logger from '../utils/logger.ts';

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
    // 1. Idempotency Check: Skip if actionId already processed
    if (action.actionId && state.processedActionIds.includes(action.actionId)) {
        Logger.debug(`[ENGINE] Skipping duplicate action ${action.actionId}`);
        return state;
    }

    // 2. Version Check: If action has a version, it must be the "next" version or higher
    // If it's old, skip it.
    if (action.version !== undefined && action.version < state.stateVersion) {
        Logger.warn(`[ENGINE] Skipping stale action version ${action.version} (current: ${state.stateVersion})`);
        return state;
    }

    const newState = gameReducer(state, action);

    // If state changed, update metadata
    if (newState !== state && action.type !== 'UPDATE_ANIMATION_DEALER') {
        const nextVersion = action.version !== undefined ? Math.max(action.version, state.stateVersion + 1) : state.stateVersion + 1;
        
        return { 
            ...newState, 
            lastActive: Date.now(),
            stateVersion: nextVersion,
            processedActionIds: action.actionId 
                ? [...state.processedActionIds.slice(-99), action.actionId] // Keep last 100 IDs
                : state.processedActionIds
        };
    }
    return newState;
};
