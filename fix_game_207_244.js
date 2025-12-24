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

async function fixGame(code) {
    console.log(`\n🔧 Fixing game: ${code}\n`);

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

    console.log(`Current phase: ${state.phase}`);
    console.log(`Current trick has ${state.currentTrick.length} cards`);

    // Clear the corrupted trick and reset to waiting_for_trick
    state.currentTrick = [];
    state.phase = 'waiting_for_trick';

    // Add admin log
    state.logs = [
        'Admin: Cleared corrupted trick data and reset phase',
        ...state.logs
    ];

    state.eventLog = [
        ...state.eventLog,
        {
            type: 'admin_fix',
            details: { message: 'Cleared corrupted currentTrick with undefined playerIndex values' },
            timestamp: Date.now()
        }
    ];

    console.log('\n📝 Applying fixes:');
    console.log('  - Cleared currentTrick');
    console.log('  - Set phase to waiting_for_trick');
    console.log('  - Added admin log entry');

    // Update in Supabase
    const { error: updateError } = await supabase
        .from('games')
        .update({ state })
        .eq('code', code);

    if (updateError) {
        console.error('\n❌ Error updating game:', updateError.message);
        return;
    }

    console.log('\n✅ Game fixed successfully!');
    console.log('   Players should refresh to see the updated state.\n');
}

const gameCode = process.argv[2] || '207-244';
fixGame(gameCode);
