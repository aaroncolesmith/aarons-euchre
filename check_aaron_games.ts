import { createClient } from '@supabase/supabase-js';

// Load from .env directly
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials!');
    console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAaronGames() {
    console.log('Fetching all games from Supabase...\n');

    const { data, error } = await supabase
        .from('games')
        .select('code, state, updated_at')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data) {
        console.log('No data found');
        return;
    }

    console.log(`Total games in database: ${data.length}\n`);

    // Filter for Aaron
    const aaronGames = data.filter((g: any) =>
        g.state && (
            g.state.currentUser === 'Aaron' ||
            g.state.players?.some((p: any) => p.name === 'Aaron')
        )
    );

    console.log(`Games for user Aaron: ${aaronGames.length}\n`);
    console.log('Details:');
    console.log('==========================================');

    aaronGames.forEach((g: any, i: number) => {
        const state = g.state;
        console.log(`\n${i + 1}. ${state.tableName}`);
        console.log(`   DB Code (PK):  ${g.code}`);
        console.log(`   State.tableCode: ${state.tableCode}`);
        console.log(`   State.tableId:   ${state.tableId}`);
        console.log(`   Phase:         ${state.phase}`);
        console.log(`   Scores:        Team A: ${state.scores.team1}, Team B: ${state.scores.team2}`);
        console.log(`   LastActive:    ${state.lastActive ? new Date(state.lastActive).toLocaleString() : 'N/A'}`);
        console.log(`   DB Updated:    ${new Date(g.updated_at).toLocaleString()}`);
        console.log(`   Players:       ${state.players.map((p: any) => p.name || '(empty)').join(', ')}`);
    });

    // Check for duplicates by table name
    console.log('\n==========================================');
    console.log('Duplicate Analysis:\n');

    const nameCount: Record<string, number> = {};
    const codeCount: Record<string, number> = {};

    aaronGames.forEach((g: any) => {
        const name = g.state.tableName;
        const code = g.state.tableCode;
        nameCount[name] = (nameCount[name] || 0) + 1;
        codeCount[code] = (codeCount[code] || 0) + 1;
    });

    console.log('By Name:');
    Object.entries(nameCount).forEach(([name, count]) => {
        if (count as number > 1) {
            console.log(`  ⚠️  "${name}": ${count} games with this name`);

            // Show the codes for these games
            const codes = aaronGames
                .filter((g: any) => g.state.tableName === name)
                .map((g: any) => g.state.tableCode);
            console.log(`      Codes: ${codes.join(', ')}`);
        } else {
            console.log(`  ✓  "${name}": unique`);
        }
    });

    console.log('\nBy TableCode:');
    Object.entries(codeCount).forEach(([code, count]) => {
        if (count as number > 1) {
            console.log(`  ⚠️  Code "${code}": appears ${count} times (SHOULD BE UNIQUE!)`);
        }
    });

    if (Object.values(codeCount).every(c => c === 1)) {
        console.log('  ✓ All tableCodes are unique');
    }
}

checkAaronGames().catch(console.error);
