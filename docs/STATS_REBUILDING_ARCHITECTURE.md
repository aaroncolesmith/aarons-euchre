# Stats Rebuilding Architecture - Immutable Event Logging

**Purpose:** Never lose stats again. Always be able to rebuild from raw data.

---

## 🎯 **Goals:**

1. **Immutable Logs** - Game data never gets deleted or modified
2. **Stats Rebuilding** - Can reconstruct `player_stats` table at any time
3. **Audit Trail** - Know exactly what happened in every game
4. **Data Integrity** - No more mysterious stat corruptions

---

## 📊 **Current State:**

### What We Log Now:
| Table | What It Logs | Immutable? | Useful for Stats? |
|-------|-------------|------------|-------------------|
| `games` | Full game state | ❌ No (gets deleted) | ⚠️ Only active games |
| `trump_calls` | Trump calling decisions | ✅ Yes | ✅ Yes (for trump stats) |
| `bot_decisions` | Bot AI decisions | ✅ Yes | ⚠️ Partial (decision audit) |
| `player_stats` | Accumulated stats | ❌ No (gets wiped) | ✅ Yes (but corrupts) |

### The Problem:
- `games` table has everything we need, but we **delete completed games**
- `player_stats` accumulates, but can get corrupted and we can't verify it
- No way to rebuild stats if something goes wrong

---

## 💡 **Proposed Solution:**

### New Table: `game_results`

**Log every completed game with final stats - NEVER DELETE**

```sql
CREATE TABLE game_results (
    id UUID PRIMARY KEY,
    game_code TEXT NOT NULL,
    
    -- Players (4 seats)
    player_0_name TEXT,
    player_1_name TEXT,
    player_2_name TEXT,
    player_3_name TEXT,
    
    -- Final scores
    team1_score INTEGER,
    team2_score INTEGER,
    winner_team INTEGER, -- 1 or 2
    
    -- Game metadata
    hands_played INTEGER,
    total_tricks INTEGER,
    
    -- Per-player stats snapshot
    player_0_stats JSONB,
    player_1_stats JSONB,
    player_2_stats JSONB,
    player_3_stats JSONB,
    
    -- Timestamps
    game_started_at TIMESTAMP,
    game_ended_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 **Implementation:**

### When to Log:
Log to `game_results` when:
1. Game reaches `game_over` phase
2. Someone wins (score >= 10)
3. Before soft-deleting the game from `games` table

### Where in Code:
In `GameStore.tsx`, when game ends:

```typescript
case 'FINISH_HAND': {
    // ... existing scoring logic ...
    
    if (isGameOver) {
        // NEW: Log to game_results
        await logGameResult({
            gameCode: state.tableCode,
            players: state.players,
            scores: newScores,
            handsPlayed: state.handsPlayed,
            timestamp: Date.now()
        });
    }
}
```

### New Utility Function:
```typescript
// utils/gameResultLogger.ts
export async function logGameResult(data: {
    gameCode: string;
    players: Player[];
    scores: { team1: number; team2: number };
    handsPlayed: number;
    timestamp: number;
}) {
    const result = {
        game_code: data.gameCode,
        player_0_name: data.players[0].name,
        player_1_name: data.players[1].name,
        player_2_name: data.players[2].name,
        player_3_name: data.players[3].name,
        team1_score: data.scores.team1,
        team2_score: data.scores.team2,
        winner_team: data.scores.team1 >= 10 ? 1 : 2,
        hands_played: data.handsPlayed,
        player_0_stats: data.players[0].stats,
        player_1_stats: data.players[1].stats,
        player_2_stats: data.players[2].stats,
        player_3_stats: data.players[3].stats,
        game_ended_at: new Date(data.timestamp),
    };
    
    await supabase.from('game_results').insert(result);
}
```

---

## 🔍 **Stats Rebuilding:**

### Rebuild All Stats from Scratch:

```sql
WITH player_games AS (
    SELECT player_0_name as player, team1_score >= 10 AND team1_score > team2_score as won, player_0_stats as stats FROM game_results WHERE player_0_name IS NOT NULL
    UNION ALL
    SELECT player_1_name, team2_score >= 10 AND team2_score > team1_score, player_1_stats FROM game_results WHERE player_1_name IS NOT NULL
    UNION ALL
    SELECT player_2_name, team1_score >= 10 AND team1_score > team2_score, player_2_stats FROM game_results WHERE player_2_name IS NOT NULL
    UNION ALL
    SELECT player_3_name, team2_score >= 10 AND team2_score > team1_score, player_3_stats FROM game_results WHERE player_3_name IS NOT NULL
)
SELECT 
    player as player_name,
    COUNT(*) as games_played,
    SUM(CASE WHEN won THEN 1 ELSE 0 END) as games_won,
    SUM((stats->>'handsPlayed')::int) as hands_played,
    SUM((stats->>'handsWon')::int) as hands_won,
    SUM((stats->>'tricksPlayed')::int) as tricks_played,
    SUM((stats->>'tricksTaken')::int) as tricks_taken,
    SUM((stats->>'tricksWonTeam')::int) as tricks_won_team,
    SUM((stats->>'callsMade')::int) as calls_made,
    SUM((stats->>'callsWon')::int) as calls_won,
    SUM((stats->>'lonersAttempted')::int) as loners_attempted,
    SUM((stats->>'lonersConverted')::int) as loners_converted,
    SUM((stats->>'euchresMade')::int) as euchres_made,
    SUM((stats->>'euchred')::int) as euchred,
    SUM((stats->>'sweeps')::int) as sweeps,
    SUM((stats->>'swept')::int) as swept
FROM player_games
GROUP BY player
ORDER BY games_played DESC;
```

### Verify Current Stats:

```sql
-- Compare game_results aggregate vs player_stats table
-- They should match!
```

---

## ✅ **Benefits:**

1. **Never Lose Data** - Game results are immutable
2. **Rebuild Anytime** - Can reconstruct stats from scratch
3. **Audit Trail** - Can see every game a player participated in
4. **Verify Accuracy** - Can compare computed stats vs stored stats
5. **Historical Analysis** - Can query stats from specific date ranges

---

## 📅 **Rollout Plan:**

### Phase 1: Create Table (Now)
- Run `004_game_results_table.sql`
- Table exists but not used yet

### Phase 2: Start Logging (Next Deploy)
- Add `logGameResult()` function
- Call it when game ends
- Logs start accumulating

### Phase 3: Backfill (Optional)
- If we want historical data, parse `games` table event logs
- Extract completed games and backfill `game_results`

### Phase 4: Stats Rebuilding Function
- Create SQL function to rebuild `player_stats` from `game_results`
- Run it to verify accuracy
- Schedule periodic rebuilds (weekly?)

---

## 🎯 **Next Steps:**

1. **Run Migration** - `004_game_results_table.sql` in Supabase
2. **Implement Logger** - Add code to log game results
3. **Test** - Complete a game, verify it logs to table
4. **Deploy** - V1.39 with game result logging
5. **Monitor** - Watch data accumulate
6. **Rebuild** - Use it to rebuild stats and verify accuracy

**Want me to implement the logging code now?** 🚀
