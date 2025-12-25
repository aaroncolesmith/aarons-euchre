// Quick test script to check localStorage stats
console.log('🔍 Checking Euchre Stats in localStorage...\n');

const stats = localStorage.getItem('euchre_global_profiles');

if (!stats) {
    console.log('❌ No stats found in localStorage');
    console.log('Key should be: euchre_global_profiles');
} else {
    const parsed = JSON.parse(stats);
    console.log('✅ Stats found!');
    console.log(JSON.stringify(parsed, null, 2));

    console.log('\n📊 Summary:');
    Object.keys(parsed).forEach(name => {
        const player = parsed[name];
        console.log(`\n${name}:`);
        console.log(`  Games: ${player.gamesPlayed} (${player.gamesWon} won)`);
        console.log(`  Hands: ${player.handsPlayed} (${player.handsWon} won)`);
        console.log(`  Tricks: ${player.tricksPlayed} (${player.tricksTaken} taken)`);
        console.log(`  Calls: ${player.callsMade} (${player.callsWon} won)`);
    });
}
