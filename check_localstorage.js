// Check Browser localStorage for Old Game Data
// Open browser console (F12) and paste this code

// 1. Check what's in localStorage
console.log("=== CHECKING LOCALSTORAGE ===");
console.log("Current User:", localStorage.getItem('euchre_current_user'));

// 2. Check for active games
const activeGames = localStorage.getItem('euchre_active_games');
if (activeGames) {
    const games = JSON.parse(activeGames);
    console.log("Active Games Found:", Object.keys(games).length);
    console.log(games);

    // Filter for Aaron's completed games
    const completedGames = Object.values(games).filter(g =>
        g.phase === 'game_over' &&
        (g.currentUser === 'Aaron' || g.players?.some(p => p.name === 'Aaron'))
    );
    console.log("Aaron's Completed Games in localStorage:", completedGames.length);
    console.log(completedGames);
} else {
    console.log("No active games in localStorage");
}

// 3. Check all localStorage keys
console.log("\n=== ALL LOCALSTORAGE KEYS ===");
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.includes('euchre')) {
        console.log(key, ":", localStorage.getItem(key)?.substring(0, 100));
    }
}
