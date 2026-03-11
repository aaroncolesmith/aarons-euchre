// Game Diagnostic Tool - Query game state from Supabase
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

interface DiagnosticReport {
    tableCode: string;
    phase: string;
    currentPlayerIndex: number;
    currentPlayerName: string;
    isBot: boolean;
    overlayMessage: string | null;
    currentTrick: any[];
    trump: string | null;
    lastActive: number;
    timeSinceActive: number;
    potentialIssues: string[];
}

async function diagnoseGame(tableCode: string): Promise<DiagnosticReport | null> {
    console.log(`🔍 Diagnosing game: ${tableCode}`);

    const { data, error } = await supabase
        .from('games')
        .select('state')
        .eq('code', tableCode)
        .single();

    if (error || !data) {
        console.error('❌ Game not found in database:', error);
        return null;
    }

    const state = data.state;
    const currentPlayer = state.players[state.currentPlayerIndex];
    const timeSinceActive = Date.now() - (state.lastActive || 0);

    // Detect potential issues
    const issues: string[] = [];

    if (!currentPlayer) {
        issues.push('CRITICAL: Current player is undefined');
    }

    if (currentPlayer?.isComputer && timeSinceActive > 15000) {
        issues.push(`Bot stuck for ${(timeSinceActive / 1000).toFixed(0)}s`);
    }

    if (state.phase === 'scoring' && state.overlayMessage) {
        issues.push('KNOWN BUG: Scoring phase with overlay (should be fixed in V0.38)');
    }

    if (state.isLoner && state.trumpCallerIndex !== null) {
        const partnerIndex = (state.trumpCallerIndex + 2) % 4;
        if (state.currentPlayerIndex === partnerIndex) {
            issues.push('CRITICAL: Current player is partner during loner');
        }
    }

    if (state.phase === 'waiting_for_trick' && timeSinceActive > 5000) {
        issues.push('Stuck in waiting_for_trick');
    }

    if (state.overlayMessage) {
        const humanPlayers = state.players.filter((p: any) => p.name && !p.isComputer);
        const acknowledged = humanPlayers.filter((p: any) => state.overlayAcknowledged[p.name]);
        if (acknowledged.length === humanPlayers.length && currentPlayer?.isComputer) {
            issues.push('All humans acknowledged overlay but bot is current player');
        }
    }

    const report: DiagnosticReport = {
        tableCode,
        phase: state.phase,
        currentPlayerIndex: state.currentPlayerIndex,
        currentPlayerName: currentPlayer?.name || 'UNDEFINED',
        isBot: currentPlayer?.isComputer || false,
        overlayMessage: state.overlayMessage,
        currentTrick: state.currentTrick,
        trump: state.trump,
        lastActive: state.lastActive,
        timeSinceActive: Math.floor(timeSinceActive / 1000),
        potentialIssues: issues
    };

    return report;
}

function printReport(report: DiagnosticReport) {
    console.log('\n═══════════════════════════════════════');
    console.log('📊 DIAGNOSTIC REPORT');
    console.log('═══════════════════════════════════════');
    console.log(`Game Code: ${report.tableCode}`);
    console.log(`Phase: ${report.phase}`);
    console.log(`Current Player: ${report.currentPlayerName} (${report.isBot ? 'BOT' : 'HUMAN'})`);
    console.log(`  └─ Position: ${report.currentPlayerIndex}`);
    console.log(`Trump: ${report.trump || 'None'}`);
    console.log(`Overlay: ${report.overlayMessage || 'None'}`);
    console.log(`Current Trick: ${report.currentTrick.length} cards played`);
    console.log(`Last Active: ${report.timeSinceActive}s ago`);

    if (report.potentialIssues.length > 0) {
        console.log('\n🚨 POTENTIAL ISSUES:');
        report.potentialIssues.forEach(issue => {
            console.log(`  • ${issue}`);
        });
    } else {
        console.log('\n✅ No obvious issues detected');
    }
    console.log('═══════════════════════════════════════\n');
}

// Main execution
const gameCode = process.argv[2];

if (!gameCode) {
    console.error('Usage: npx tsx diagnose_game.ts <game-code>');
    console.error('Example: npx tsx diagnose_game.ts 704-727');
    process.exit(1);
}

diagnoseGame(gameCode).then(report => {
    if (report) {
        printReport(report);

        if (report.potentialIssues.length > 0) {
            console.log('💡 SUGGESTED FIXES:');

            if (report.potentialIssues.some(i => i.includes('Bot stuck'))) {
                console.log('  • Force bot to take action (PASS_BID or PLAY_CARD)');
            }

            if (report.potentialIssues.some(i => i.includes('scoring phase'))) {
                console.log('  • Run FINISH_HAND action to advance game');
            }

            if (report.potentialIssues.some(i => i.includes('partner during loner'))) {
                console.log('  • Skip to next player with FORCE_NEXT_PLAYER action');
            }

            if (report.potentialIssues.some(i => i.includes('waiting_for_trick'))) {
                console.log('  • Force CLEAR_TRICK action');
            }

            console.log('\n');
        }

        process.exit(report.potentialIssues.length > 0 ? 1 : 0);
    } else {
        process.exit(1);
    }
});
