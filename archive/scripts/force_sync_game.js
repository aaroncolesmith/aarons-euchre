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

async function forceSyncGame(code) {
    console.log(`\n🔄 Force syncing game: ${code}\n`);

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
    console.log(`Current player: ${state.currentPlayerIndex}`);
    console.log(`Current trick: ${state.currentTrick.length} cards`);

    // Add a sync marker to force clients to reload
    state.syncVersion = (state.syncVersion || 0) + 1;
    state.lastSyncTime = Date.now();

    state.logs = [
        `Admin: Force sync v${state.syncVersion} - please refresh browser`,
        ...state.logs
    ];

    console.log('\n📝 Force sync applied');
    console.log(`  Sync version: ${state.syncVersion}`);

    // Update in Supabase
    const { error: updateError } = await supabase
        .from('games')
        .update({
            state,
            updated_at: new Date().toISOString()
        })
        .eq('code', code);

    if (updateError) {
        console.error('\n❌ Error updating game:', updateError.message);
        return;
    }

    console.log('\n✅ Force sync complete!');
    console.log('   All players MUST hard refresh (Cmd+Shift+R / Ctrl+Shift+R)\n');
}

const gameCode = process.argv[2] || '207-244';
forceSyncGame(gameCode);
