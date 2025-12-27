// Universal Game Freeze Debugger
// Add this to help diagnose ANY type of freeze

export function debugGameState(state: any): string {
    const lines: string[] = [];

    lines.push('═══ GAME STATE DEBUG ═══');
    lines.push(`Phase: ${state.phase}`);
    lines.push(`Current Player: #${state.currentPlayerIndex} (${state.players[state.currentPlayerIndex]?.name || 'unnamed'})`);
    lines.push(`  └─ Is Bot: ${state.players[state.currentPlayerIndex]?.isComputer}`);
    lines.push(`  └─ Hand Size: ${state.players[state.currentPlayerIndex]?.hand?.length}`);

    if (state.overlayMessage) {
        lines.push(`⚠️  Overlay Active: "${state.overlayMessage}"`);
        lines.push(`  └─ Acknowledged by: ${Object.keys(state.overlayAcknowledged).filter(k => state.overlayAcknowledged[k]).join(', ')}`);
        const humans = state.players.filter((p: any) => p.name && !p.isComputer);
        const unacknowledged = humans.filter((p: any) => !state.overlayAcknowledged[p.name]);
        if (unacknowledged.length > 0) {
            lines.push(`  └─ ⚠️ WAITING FOR: ${unacknowledged.map((p: any) => p.name).join(', ')}`);
        }
    }

    if (state.phase === 'bidding') {
        lines.push(`Bidding Round: ${state.biddingRound}`);
        lines.push(`Upcard: ${state.upcard ? `${state.upcard.rank} of ${state.upcard.suit}` : 'none'}`);
    }

    if (state.phase === 'playing') {
        lines.push(`Trump: ${state.trump}`);
        lines.push(`Current Trick: ${state.currentTrick.length}/4 cards played`);
        if (state.isLoner) {
            lines.push(`⚡ LONER by player #${state.trumpCallerIndex}`);
            const partnerIndex = (state.trumpCallerIndex + 2) % 4;
            if (state.currentPlayerIndex === partnerIndex) {
                lines.push(`  └─ ⚠️⚠️⚠️ CRITICAL: Current player IS the partner!`);
            }
        }
    }

    if (state.phase === 'waiting_for_trick') {
        lines.push(`⏳ Waiting for trick to clear (should auto-clear in 3s)`);
    }

    // Check for common freeze conditions
    const freezeReasons: string[] = [];

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) {
        freezeReasons.push('Current player is undefined/null');
    }

    if (currentPlayer?.isComputer && state.phase === 'playing' && !state.overlayMessage) {
        const timeSinceActive = Date.now() - (state.lastActive || 0);
        if (timeSinceActive > 10000) {
            freezeReasons.push(`Bot hasn't played for ${(timeSinceActive / 1000).toFixed(0)}s`);
        }
    }

    if (state.overlayMessage) {
        const humans = state.players.filter((p: any) => p.name && !p.isComputer);
        const unacknowledged = humans.filter((p: any) => !state.overlayAcknowledged[p.name]);
        if (unacknowledged.length > 0 && currentPlayer?.isComputer) {
            freezeReasons.push('Waiting for human to acknowledge overlay, but current player is bot');
        }
    }

    if (state.phase === 'discard' && currentPlayer?.hand?.length !== 6) {
        freezeReasons.push(`In discard phase but current player has ${currentPlayer.hand?.length} cards (expected 6)`);
    }

    if (freezeReasons.length > 0) {
        lines.push('');
        lines.push('🚨 POTENTIAL FREEZE CAUSES:');
        freezeReasons.forEach(reason => lines.push(`  • ${reason}`));
    }

    lines.push('═══════════════════════');

    return lines.join('\n');
}

export function suggestFix(state: any): { action: string; description: string } | null {
    const currentPlayer = state.players[state.currentPlayerIndex];

    // Overlay stuck with bot as current player
    if (state.overlayMessage && currentPlayer?.isComputer) {
        const humans = state.players.filter((p: any) => p.name && !p.isComputer);
        const unacknowledged = humans.filter((p: any) => !state.overlayAcknowledged[p.name]);
        if (unacknowledged.length === 0) {
            return {
                action: 'CLEAR_OVERLAY',
                description: 'All humans acknowledged overlay, clearing it'
            };
        }
    }

    // Stuck in waiting_for_trick for too long
    if (state.phase === 'waiting_for_trick') {
        return {
            action: 'CLEAR_TRICK',
            description: 'Force clear the trick'
        };
    }

    // Loner partner issue
    if (state.isLoner && state.trumpCallerIndex !== null) {
        const partnerIndex = (state.trumpCallerIndex + 2) % 4;
        if (state.currentPlayerIndex === partnerIndex) {
            return {
                action: 'FORCE_NEXT_PLAYER',
                description: `Skip partner (${partnerIndex}) to next player (${(partnerIndex + 1) % 4})`
            };
        }
    }

    // Bot stuck
    if (currentPlayer?.isComputer && !state.overlayMessage) {
        const timeSinceActive = Date.now() - (state.lastActive || 0);
        if (timeSinceActive > 15000) {
            if (state.phase === 'bidding') {
                return {
                    action: 'PASS_BID',
                    description: 'Force bot to pass (stuck in bidding)'
                };
            } else if (state.phase === 'playing' && currentPlayer.hand?.length > 0) {
                return {
                    action: 'PLAY_CARD',
                    description: 'Force bot to play first card in hand'
                };
            }
        }
    }

    return null;
}
