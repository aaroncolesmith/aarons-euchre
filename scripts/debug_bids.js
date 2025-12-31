import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBotDecisions() {
    console.log('--- DEBUGGING BOT DECISIONS (Last 5 Bids) ---');

    const { data: decisions, error } = await supabase
        .from('bot_decisions')
        .select('*')
        .eq('decision_type', 'bid')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    decisions.forEach((d, i) => {
        console.log(`${i + 1}. Player: ${d.player_name} | Decision: ${d.decision}`);
        console.log(`   Reasoning: ${d.reasoning}`);
        console.log(`   Strength: ${d.hand_strength}`);
        console.log(`   Phase: ${d.game_phase}`);
        console.log('--------------------------------------------');
    });
}

debugBotDecisions();
