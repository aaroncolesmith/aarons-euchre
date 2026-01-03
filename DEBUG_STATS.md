// DEBUGGING STEPS - Run in browser console

// 1. Check if getAllPlayerStats works
import { getAllPlayerStats } from './utils/supabaseStats';
const stats = await getAllPlayerStats();
console.log('Supabase stats:', stats);
console.log('Number of players:', Object.keys(stats).length);

// 2. Check localStorage
const localProfiles = localStorage.getItem('euchre_global_profiles');
const localStats = localStorage.getItem('euchre_global_stats_v3');
console.log('localStorage profiles:', localProfiles);
console.log('localStorage stats v3:', localStats);

// 3. Check if the modal component is using the right data
// Open the stats modal and check the browser console for:
// - "[STATS] Loaded from Supabase: X players"
// -  OR "[STATS] Using localStorage fallback: X players"
// - OR "[STATS] Error loading from Supabase..."
