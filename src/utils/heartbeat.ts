// Heartbeat Monitor - Detects and auto-recovers from game freezes
// Runs every 10 seconds to ensure game is progressing

import Logger from './logger';

export interface HeartbeatState {
    phase: string;
    currentPlayerIndex: number;
    currentPlayerIsBot: boolean;
    lastActive: number;
    isLoner: boolean;
    trumpCallerIndex: number | null;
    overlayMessage: string | null;
    currentTrick: any[];
}

interface RecoveryAction {
    type: string;
    payload?: any;
    reason: string;
}

const FREEZE_THRESHOLD_MS = 20000; // 20 seconds without state change = freeze

/**
 * Check if game is frozen and needs intervention
 */
export function detectFreeze(
    currentState: HeartbeatState,
    previousCheck: HeartbeatState | null
): RecoveryAction | null {

    if (!previousCheck) return null;

    const timeSinceLastActive = Date.now() - currentState.lastActive;
    const stateUnchanged =
        currentState.phase === previousCheck.phase &&
        currentState.currentPlayerIndex === previousCheck.currentPlayerIndex;

    // If state hasn't changed and it's been too long, investigate
    if (!stateUnchanged || timeSinceLastActive < FREEZE_THRESHOLD_MS) {
        return null; // Game is progressing normally
    }

    Logger.warn('[HEARTBEAT] Potential freeze detected', {
        phase: currentState.phase,
        timeSince: `${(timeSinceLastActive / 1000).toFixed(0)}s`,
        currentPlayer: currentState.currentPlayerIndex
    });

    // Diagnose the specific freeze type and return recovery action

    // 1. waiting_for_next_deal freeze
    if (currentState.phase === 'waiting_for_next_deal') {
        return {
            type: 'FORCE_DEAL',
            reason: 'Stuck in waiting_for_next_deal - forcing card deal'
        };
    }

    // 2. waiting_for_trick freeze
    if (currentState.phase === 'waiting_for_trick') {
        return {
            type: 'CLEAR_TRICK',
            reason: 'Stuck in waiting_for_trick - clearing trick'
        };
    }

    // 3. scoring freeze
    if (currentState.phase === 'scoring') {
        return {
            type: 'FINISH_HAND',
            reason: 'Stuck in scoring - finishing hand'
        };
    }

    // 4. Loner partner stuck
    if (currentState.isLoner && currentState.trumpCallerIndex !== null) {
        const partnerIndex = (currentState.trumpCallerIndex + 2) % 4;
        if (currentState.currentPlayerIndex === partnerIndex) {
            return {
                type: 'FORCE_NEXT_PLAYER',
                payload: { nextPlayerIndex: (partnerIndex + 1) % 4 },
                reason: 'Current player is partner during loner - skipping'
            };
        }
    }

    // 5. Bot stuck in bidding
    if (currentState.phase === 'bidding' && currentState.currentPlayerIsBot) {
        return {
            type: 'PASS_BID',
            payload: { playerIndex: currentState.currentPlayerIndex },
            reason: 'Bot stuck in bidding - forcing pass'
        };
    }

    // 6. Bot stuck in discard
    if (currentState.phase === 'discard' && currentState.currentPlayerIsBot) {
        return {
            type: 'AUTO_DISCARD',
            reason: 'Bot stuck in discard phase'
        };
    }

    // 7. Bot stuck in playing
    if (currentState.phase === 'playing' && currentState.currentPlayerIsBot) {
        return {
            type: 'FORCE_BOT_PLAY',
            reason: 'Bot stuck in playing phase'
        };
    }

    // 8. Generic overlay stuck
    if (currentState.overlayMessage) {
        return {
            type: 'CLEAR_OVERLAY',
            reason: 'Overlay blocking progress'
        };
    }

    Logger.error('[HEARTBEAT] Freeze detected but no recovery action available', currentState);
    return null;
}

/**
 * Apply a recovery action
 */
export function applyRecovery(
    action: RecoveryAction,
    dispatch: (action: any) => void
): void {
    Logger.warn(`[HEARTBEAT RECOVERY] Applying: ${action.reason}`);

    switch (action.type) {
        case 'FORCE_DEAL':
            // Trigger the waiting_for_next_deal timeout immediately
            dispatch({ type: 'FORCE_PHASE', payload: { phase: 'waiting_for_next_deal' } });
            break;

        case 'CLEAR_TRICK':
            dispatch({ type: 'CLEAR_TRICK' });
            break;

        case 'FINISH_HAND':
            dispatch({ type: 'FINISH_HAND' });
            break;

        case 'FORCE_NEXT_PLAYER':
            dispatch({ type: 'FORCE_NEXT_PLAYER', payload: action.payload });
            break;

        case 'PASS_BID':
            dispatch({ type: 'PASS_BID', payload: action.payload });
            break;

        case 'CLEAR_OVERLAY':
            dispatch({ type: 'CLEAR_OVERLAY' });
            break;

        case 'FORCE_BOT_PLAY':
        case 'AUTO_DISCARD':
            Logger.warn(`[HEARTBEAT] ${action.type} needs implementation`);
            break;

        default:
            Logger.error('[HEARTBEAT] Unknown recovery action type', action);
    }
}

/**
 * Create a heartbeat state snapshot
 */
export function createHeartbeatSnapshot(gameState: any): HeartbeatState {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    return {
        phase: gameState.phase,
        currentPlayerIndex: gameState.currentPlayerIndex,
        currentPlayerIsBot: currentPlayer?.isComputer || false,
        lastActive: gameState.lastActive || Date.now(),
        isLoner: gameState.isLoner || false,
        trumpCallerIndex: gameState.trumpCallerIndex,
        overlayMessage: gameState.overlayMessage,
        currentTrick: gameState.currentTrick || []
    };
}
