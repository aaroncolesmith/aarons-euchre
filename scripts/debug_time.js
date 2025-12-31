import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDecisionTime() {
    const { data, error } = await supabase
        .from('bot_decisions')
        .select('player_name, decision, reasoning, created_at')
        .eq('decision_type', 'bid')
        .order('created_at', { ascending: false })
        .limit(3);

    data.forEach(d => {
        console.log(`${d.created_at} | ${d.player_name} | ${d.decision}`);
    });
}

debugDecisionTime();
