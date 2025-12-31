import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getRecentTrumpCalls() {
    const { data, error } = await supabase
        .from('trump_calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching trump calls:', error);
        return;
    }

    console.log('--- RECENT TRUMP CALLS (Last 10) ---');
    data.forEach((call, i) => {
        const timestamp = new Date(call.created_at).toLocaleTimeString();
        console.log(`${i + 1}. [${timestamp}] Game: ${call.game_id} | Player: ${call.player_name} (${call.user_type})`);
        console.log(`   Action: Called ${call.suit.toUpperCase()} in Rd ${call.round}${call.is_loner ? ' (LONER)' : ''}`);
        console.log(`   Hand: ${call.hand_after_discard}`);
        console.log(`   Detailed Stats: ${call.trump_count} trumps, ${call.bower_count} bowers, ${call.suit_count} distribution`);
        console.log(`   Context: Dealer was ${call.dealer} (${call.dealer_relationship})`);
        if (call.round === 1) {
            console.log(`   Upcard (Round 1): ${call.top_card}`);
        }
        console.log('----------------------------------------------------');
    });
}

getRecentTrumpCalls();
