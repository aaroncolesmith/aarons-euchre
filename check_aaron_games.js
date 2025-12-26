// Quick script to check what games exist in Supabase for user Aaron
import { supabase } from './src/lib/supabase.ts';

async function checkAaronGames() {
    console.log('Fetching all games from Supabase...\n');

    const { data, error } = await supabase
        .from('games')
        .select('code, state')
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
    const aaronGames = data.filter(g =>
        g.state && (
            g.state.currentUser === 'Aaron' ||
            g.state.players?.some((p) => p.name === 'Aaron')
        )
    );

    console.log(`Games for user Aaron: ${aaronGames.length}\n`);
    console.log('Details:');
    console.log('---');

    aaronGames.forEach((g, i) => {
        const state = g.state;
        console.log(`${i + 1}. ${state.tableName}`);
        console.log(`   Code: ${g.code}`);
        console.log(`   TableCode: ${state.tableCode}`);
        console.log(`   TableId: ${state.tableId}`);
        console.log(`   Phase: ${state.phase}`);
        console.log(`   Scores: Team A: ${state.scores.team1}, Team B: ${state.scores.team2}`);
        console.log(`   LastActive: ${state.lastActive ? new Date(state.lastActive).toLocaleString() : 'N/A'}`);
        console.log(`   Players: ${state.players.map(p => p.name || '(empty)').join(', ')}`);
        console.log('');
    });

    // Check for duplicates by table name
    const nameCount = {};
    aaronGames.forEach(g => {
        const name = g.state.tableName;
        nameCount[name] = (nameCount[name] || 0) + 1;
    });

    console.log('Duplicate names:');
    Object.entries(nameCount).forEach(([name, count]) => {
        if (count > 1) {
            console.log(`  - "${name}": ${count} occurrences`);
        }
    });
}

checkAaronGames();
