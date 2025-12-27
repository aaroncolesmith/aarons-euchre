// Anti-Freeze Watchdog System for Euchre Game
// This utility detects and auto-recovers from stuck game states

export interface WatchdogState {
    phase: string;
    currentPlayerIndex: number;
    currentPlayerIsBot: boolean;
    lastUpdateTime: number;
    isLoner: boolean;
    trumpCallerIndex: number | null;
}

const FREEZE_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Check if the game is stuck (same state for too long)
 */
export function isGameFrozen(
    currentState: WatchdogState,
    lastState: WatchdogState | null
): boolean {
    if (!lastState) return false;

    // If phase changed, not frozen
    if (currentState.phase !== lastState.phase) return false;

    // If current player changed, not frozen
    if (currentState.currentPlayerIndex !== lastState.currentPlayerIndex) return false;

    // If it's been more than FREEZE_TIMEOUT since last update, consider frozen
    const timeSinceUpdate = Date.now() - lastState.lastUpdateTime;

    // Only consider it frozen if it's a bot's turn and they haven't moved
    if (currentState.currentPlayerIsBot && timeSinceUpdate > FREEZE_TIMEOUT_MS) {
        console.error('[FREEZE DETECTED]', {
            phase: currentState.phase,
            currentPlayerIndex: currentState.currentPlayerIndex,
            timeSinceUpdate: `${(timeSinceUpdate / 1000).toFixed(1)}s`,
            isLoner: currentState.isLoner,
            trumpCallerIndex: currentState.trumpCallerIndex
        });
        return true;
    }

    return false;
}

/**
 * Diagnose why the game might be frozen
 */
export function diagnoseFreezeReason(state: WatchdogState): string {
    const reasons: string[] = [];

    if (state.currentPlayerIsBot) {
        reasons.push('Bot player turn');
    }

    if (state.isLoner && state.trumpCallerIndex !== null) {
        const partnerIndex = (state.trumpCallerIndex + 2) % 4;
        if (state.currentPlayerIndex === partnerIndex) {
            reasons.push('⚠️ CRITICAL: Current player is partner during loner!');
        }
    }

    if (state.phase === 'playing') {
        reasons.push('In playing phase');
    } else if (state.phase === 'bidding') {
        reasons.push('In bidding phase');
    } else if (state.phase === 'waiting_for_trick') {
        reasons.push('Waiting for trick to clear');
    }

    return reasons.join(' | ');
}

/**
 * Generate a recovery action for a frozen game
 */
export function generateRecoveryAction(state: WatchdogState): { type: string; payload?: any } | null {
    // If stuck in waiting_for_trick, clear it
    if (state.phase === 'waiting_for_trick') {
        return { type: 'CLEAR_TRICK' };
    }

    // If it's a loner and current player is the partner, skip them
    if (state.isLoner && state.trumpCallerIndex !== null) {
        const partnerIndex = (state.trumpCallerIndex + 2) % 4;
        if (state.currentPlayerIndex === partnerIndex) {
            const nextIndex = (partnerIndex + 1) % 4;
            return {
                type: 'FORCE_NEXT_PLAYER',
                payload: { nextPlayerIndex: nextIndex }
            };
        }
    }

    // If bot is stuck, force them to pass/play
    if (state.currentPlayerIsBot) {
        if (state.phase === 'bidding') {
            return {
                type: 'PASS_BID',
                payload: { playerIndex: state.currentPlayerIndex }
            };
        }
    }

    return null;
}
