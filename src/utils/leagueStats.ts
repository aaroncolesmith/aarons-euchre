// League summary data helper
export function getLeagueSummary(players: any[]) {
    const totalGamesPlayed = players.reduce((sum, p) => sum + p.gamesPlayed, 0);
    const totalWins = players.reduce((sum, p) => sum + p.gamesWon, 0);
    const totalLosses = players.reduce((sum, p) => sum + (p.gamesPlayed - p.gamesWon), 0);
    const dataIntegrityOK = totalWins === totalLosses;

    return {
        totalPlayers: players.length,
        totalGamesPlayed,
        totalWins,
        totalLosses,
        dataIntegrityOK,
        message: dataIntegrityOK
            ? 'Data is balanced ✓'
            : `Data integrity issue: ${totalWins} wins ≠ ${totalLosses} losses`
    };
}

export function clearAllPlayerStats() {
    if (confirm('⚠️ This will permanently delete ALL player statistics.\n\nThis includes:\n- Game records\n- Hand statistics\n- Trump call history\n\nAre you absolutely sure?')) {
        localStorage.removeItem('euchre_global_profiles');
        localStorage.removeItem('euchre_trump_calls');
        alert('All statistics cleared! Refreshing page...');
        window.location.reload();
    }
}
