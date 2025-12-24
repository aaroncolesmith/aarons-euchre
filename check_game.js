import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGame(code) {
    console.log(`\n🔍 Checking game: ${code}\n`);

    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single();

    if (error) {
        console.error('❌ Error fetching game:', error.message);
        return;
    }

    if (!data) {
        console.log('❌ Game not found');
        return;
    }

    const state = data.state;

    console.log('📊 Game State Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Table: ${state.tableName}`);
    console.log(`Phase: ${state.phase}`);
    console.log(`Code: ${state.tableCode}`);
    console.log(`Current Player: ${state.currentPlayerIndex}`);
    console.log(`Dealer: ${state.dealerIndex}`);
    console.log(`Trump: ${state.trump || 'Not set'}`);
    console.log(`Bidding Round: ${state.biddingRound}`);
    console.log(`\nScores:`);
    console.log(`  ${state.teamNames.team1}: ${state.scores.team1}`);
    console.log(`  ${state.teamNames.team2}: ${state.scores.team2}`);

    console.log(`\n👥 Players:`);
    state.players.forEach((p, i) => {
        console.log(`  [${i}] ${p.name || 'Empty'} - ${p.hand.length} cards ${p.isComputer ? '(Bot)' : ''}`);
    });

    console.log(`\n🃏 Current Trick: ${state.currentTrick.length} cards played`);
    if (state.currentTrick.length > 0) {
        state.currentTrick.forEach(t => {
            console.log(`  - ${t.card.rank} of ${t.card.suit} (Player ${t.playerIndex})`);
        });
    }

    console.log(`\n📋 Event Log (last 10):`);
    state.eventLog.slice(-10).forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.type}: ${JSON.stringify(event.details || {})}`);
    });

    // Check for issues
    console.log(`\n⚠️  Potential Issues:`);
    const issues = [];

    // Check if stuck in playing with empty hands
    if (state.phase === 'playing') {
        const allEmpty = state.players.every(p => p.hand.length === 0);
        if (allEmpty) {
            issues.push('❌ STUCK: Phase is "playing" but all players have empty hands');
        }
    }

    // Check if current player index is valid
    if (state.currentPlayerIndex >= state.players.length) {
        issues.push(`❌ Invalid currentPlayerIndex: ${state.currentPlayerIndex} (only ${state.players.length} players)`);
    }

    // Check if dealer index is valid
    if (state.dealerIndex >= state.players.length) {
        issues.push(`❌ Invalid dealerIndex: ${state.dealerIndex} (only ${state.players.length} players)`);
    }

    // Check for duplicate card IDs across all hands
    const allCardIds = state.players.flatMap(p => p.hand.map(c => c.id));
    const uniqueCardIds = new Set(allCardIds);
    if (allCardIds.length !== uniqueCardIds.size) {
        issues.push(`❌ Duplicate card IDs found in hands`);
    }

    if (issues.length === 0) {
        console.log('✅ No obvious issues detected');
    } else {
        issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n═══════════════════════════════════════\n');
}

const gameCode = process.argv[2] || '207-244';
checkGame(gameCode);
