import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials!');
    console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAaronGames() {
    console.log('🔍 Fetching all games from Supabase...\\n');

    const { data, error } = await supabase
        .from('games')
        .select('code, state, updated_at')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❌ No games found in database');
        return;
    }

    console.log(`📊 Total games in database: ${data.length}\\n`);

    // Filter for Aaron's games
    const aaronGames = data.filter((g: any) =>
        g.state && (
            g.state.currentUser === 'Aaron' ||
            g.state.players?.some((p: any) => p.name === 'Aaron')
        )
    );

    console.log(`👤 Games for user Aaron: ${aaronGames.length}\\n`);

    // Separate games by phase
    const completedGames = aaronGames.filter((g: any) => g.state.phase === 'game_over');
    const inProgressGames = aaronGames.filter((g: any) => g.state.phase !== 'game_over' && g.state.phase !== 'lobby');

    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 COMPLETED GAMES');
    console.log('═══════════════════════════════════════════════════════\\n');
    console.log(`Total: ${completedGames.length}\\n`);

    // Create formatted table for completed games
    console.log('LAST_ACTIVITY'.padEnd(25) +
        'PLAYER_LIST'.padEnd(40) +
        'TABLE_CODE'.padEnd(12) +
        'TABLE_NAME');
    console.log('-'.repeat(120));

    completedGames.forEach((g: any) => {
        const state = g.state;
        const lastActivity = state.lastActive
            ? new Date(state.lastActive).toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : new Date(g.updated_at).toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

        const players = state.players
            .filter((p: any) => p.name)
            .map((p: any) => p.name)
            .join(', ');

        const tableCode = state.tableCode || 'N/A';
        const tableName = state.tableName || 'Unnamed';

        console.log(
            lastActivity.padEnd(25) +
            players.padEnd(40) +
            tableCode.padEnd(12) +
            tableName
        );
    });

    console.log('\\n═══════════════════════════════════════════════════════');
    console.log('🎮 IN-PROGRESS GAMES');
    console.log('═══════════════════════════════════════════════════════\\n');
    console.log(`Total: ${inProgressGames.length}\\n`);

    console.log('LAST_ACTIVITY'.padEnd(25) +
        'PLAYER_LIST'.padEnd(40) +
        'TABLE_CODE'.padEnd(12) +
        'TABLE_NAME'.padEnd(25) +
        'PHASE');
    console.log('-'.repeat(120));

    inProgressGames.forEach((g: any) => {
        const state = g.state;
        const lastActivity = state.lastActive
            ? new Date(state.lastActive).toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : new Date(g.updated_at).toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

        const players = state.players
            .filter((p: any) => p.name)
            .map((p: any) => p.name)
            .join(', ');

        const tableCode = state.tableCode || 'N/A';
        const tableName = state.tableName || 'Unnamed';
        const phase = state.phase || 'unknown';

        console.log(
            lastActivity.padEnd(25) +
            players.padEnd(40) +
            tableCode.padEnd(12) +
            tableName.padEnd(25) +
            phase
        );
    });

    // Analysis
    console.log('\\n═══════════════════════════════════════════════════════');
    console.log('🔬 DIAGNOSTIC ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\\n');

    // Check for recent games that might not be showing
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentCompleted = completedGames.filter((g: any) => {
        const gameTime = g.state.lastActive ? new Date(g.state.lastActive) : new Date(g.updated_at);
        return gameTime > oneWeekAgo;
    });

    console.log(`✅ Games completed in last 7 days: ${recentCompleted.length}`);

    if (recentCompleted.length > 0) {
        console.log('\\nRecent completed games:');
        recentCompleted.forEach((g: any) => {
            const state = g.state;
            const gameTime = state.lastActive ? new Date(state.lastActive) : new Date(g.updated_at);
            console.log(`  - ${state.tableName} (${state.tableCode}) - ${gameTime.toLocaleString()}`);
            console.log(`    Winner: Team ${state.scores.team1 >= 10 ? '1' : '2'} (${state.scores.team1}-${state.scores.team2})`);
        });
    }

    // Check localStorage sync status
    console.log('\\n📱 CROSS-DEVICE SYNC ANALYSIS:');
    console.log('---------------------------------------------------');
    console.log('The issue you\'re experiencing (different game counts on phone vs laptop)');
    console.log('suggests that games are stored in BOTH:');
    console.log('  1. Supabase (cloud) - shown above');
    console.log('  2. localStorage (browser-specific) - different on each device');
    console.log('\\nThe UI likely merges both sources, which can cause discrepancies.');
    console.log('\\nTo verify:');
    console.log('  - Check browser console on each device');
    console.log('  - Run: localStorage.getItem("euchre_active_games")');
    console.log('  - Compare what\'s stored locally vs what\'s in Supabase above');
}

debugAaronGames().catch(console.error);
