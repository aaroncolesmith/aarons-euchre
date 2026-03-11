# Cross-Device Game Display Issue - Diagnosis

## Problem Statement

Aaron's games are showing differently across devices:

### Phone (Safari PWA / Bookmarklet)
- **In Progress**: 4 games
- **Completed**: 9 games
- Last completed: "Azure Trump"

### Laptop (Brave Browser)
- **In Progress**: 1 game  
- **Completed**: 10 games
- Last completed: "Azure Trump"

### Cloud (Supabase - Source of Truth)
- **In Progress**: 1 game ("The Azure Dealer")
- **Completed**: 7 games
- Last completed: **"The Azure Bower"** (NOT "Azure Trump")

---

## Root Cause Analysis

### Issue #1: No Game Named "Azure Trump" in Cloud

The Supabase query shows NO game called "Azure Trump". This suggests:

1. **localStorage Stale Data**: Both devices have old games in `localStorage` that were never synced to cloud
2. **Missing Recent Game**: Aaron mentions completing a game recently that isn't showing - this might not be in cloud OR localStorage

### Issue #2: Hybrid Storage Model

The app uses a **hybrid storage model**:

1. **localStorage** (browser-specific, per-device)
   - Stores games locally in each browser
   - Different data on phone vs laptop
   - Key: `euchre_active_games`

2. **Supabase** (cloud, shared)
   - Should be the single source of truth
   - Only has 8 total games for Aaron (1 in-progress, 7 completed)

3. **Merge Function** (`mergeLocalAndCloudGames`)
   - Combines localStorage + cloud games
   - Prefers cloud if timestamps are equal/newer
   - Can cause discrepancies if localStorage has games not in cloud

### Issue #3: Sync Gaps

From `cloudGames.ts` (lines 9-13):
```typescript
.from('games')
.select('state, updated_at')
.order('updated_at', { ascending: false })
.limit(100); // Only look at last 100 games
```

The query limits to 100 games, but more importantly:
- Not all games may be getting saved to Supabase
- localStorage could have games that never made it to cloud

---

## Diagnostic Results from Supabase

### Completed Games (7 total):
```
LAST_ACTIVITY       | TABLE_NAME           | TABLE_CODE | PLAYERS
--------------------|----------------------|------------|---------------------------
12/30, 11:19 AM     | The Azure Bower      | 196-950    | Aaron, Fizz, J-Bock, Huber
12/29, 07:02 PM     | The Dancing Table    | 438-193    | Aaron, Gray-Gray, Mimi, Huber
12/29, 08:17 AM     | The Midnight Ace     | 496-240    | Aaron, Fizz, J-Bock, Huber
12/28, 12:27 PM     | The Midnight Ace     | 116-667    | Aaron, Fizz, J-Bock, Huber
12/27, 09:02 AM     | The Midnight Table   | 889-256    | Aaron, Wooden, Moses, J-Bock
12/26, 12:59 PM     | The Midnight Bower   | 596-684    | Aaron, Fizz, J-Bock, Moses
12/26, 12:59 PM     | The Silent Circle    | 662-704    | Aaron, Huber, J-Bock, Fizz
```

### In-Progress Games (1 total):
```
LAST_ACTIVITY       | TABLE_NAME       | TABLE_CODE | PHASE   | PLAYERS
--------------------|------------------|------------|---------|---------------------------
01/01, 08:37 AM     | The Azure Dealer | 189-648    | bidding | Aaron, Wooden, Moses, Buff
```

**❌ NO "Azure Trump" game exists in Supabase**

---

## Why Different Counts?

### Phone vs Laptop Discrepancy

Each device has different `localStorage` data:

1. **Phone localStorage**: Contains old games not in cloud (possibly "Azure Trump")
2. **Laptop localStorage**: Contains different old games
3. **Merge = Cloud + LocalStorage**: Results in different totals

### Where is the "Recently Completed" Game?

Aaron mentioned completing a game recently that's not showing. Possible causes:

1. **Never Saved to Cloud**: Check GameStore.tsx sync logic
2. **Wrong Filter**: Game might be in cloud but not showing due to filter/query issue  
3. **Different User**: Game might be under different username (case sensitivity?)
4. **Still "In Progress"**: Game might not have triggered game_over phase

---

## Recommended Fixes

### 🔍 Immediate Diagnostics

1. **Check localStorage on each device:**
   ```javascript
   // Run in browser console on phone
   console.log(JSON.parse(localStorage.getItem('euchre_active_games')));
   
   // Run in browser console on laptop
   console.log(JSON.parse(localStorage.getItem('euchre_active_games')));
   ```

2. **Find "Azure Trump":**
   ```sql
   SELECT * FROM games 
   WHERE state->>'tableName' LIKE '%Trump%'
   ```

3. **Check for games saved today:**
   ```sql
   SELECT * FROM games
   WHERE updated_at > NOW() - INTERVAL '24 hours'
   AND (state->>'currentUser' = 'Aaron' OR state->'players' @> '[{"name": "Aaron"}]')
   ```

### 🛠️ Code Fixes Needed

#### Fix #1: Ensure All Games Sync to Cloud

Check `GameStore.tsx` - make sure games are being saved to Supabase:

```typescript
// Around line 1224 - syncToCloud function
// Verify this is being called reliably
```

#### Fix #2: Clear Stale localStorage

Add a "Clear Cache" button in the UI:

```typescript
const clearLocalGames = () => {
    localStorage.removeItem('euchre_active_games');
    setRefreshKey(prev => prev + 1); // Trigger cloud re-fetch
};
```

#### Fix #3: Add Cloud-First Mode

Update `mergeLocalAndCloudGames` to prefer cloud completely:

```typescript
// Option: CLOUD_ONLY mode - ignore localStorage entirely
export function mergeLocalAndCloudGames(localGames: GameState[], cloudGames: GameState[], cloudOnly = false): GameState[] {
    if (cloudOnly) {
        return cloudGames.sort(...);
    }
    // ... existing merge logic
}
```

### 🧹 Cleanup Steps

1. **On Phone**: `localStorage.removeItem('euchre_active_games')`
2. **On Laptop**: `localStorage.removeItem('euchre_active_games')`
3. **Refresh both devices**: Cloud games should now be the only source
4. **Verify count matches**: Should both show 1 in-progress, 7 completed

---

## Next Steps

1. ✅ **Run diagnostic script** (already completed)
   - Result: 7 completed games, 1 in-progress in Supabase

2. 🔍 **Find "Azure Trump"**
   - Check if it exists in cloud under different name
   - Check localStorage on both devices

3. 🔍 **Find missing recent game**
   - Check Supabase for games from last 48 hours
   - Verify game reached "game_over" phase

4. 🛠️ **Implement fix**
   - Add localStorage clear functionality
   - Improve cloud sync reliability
   - Add "Cloud-only" mode toggle

---

## Files to Reference

- **src/App.tsx**: Lines 1095-1130 (game merging logic)
- **src/utils/cloudGames.ts**: Cloud fetch and merge functions
- **src/store/GameStore.tsx**: Game persistence to Supabase
- **supabase_migrations/create_active_games_table.sql**: DB schema

---

## SQL Queries

See `query_aaron_completed_games.sql` for ready-to-run queries.

---

## Summary

The cross-device issue is caused by **localStorage containing different stale data** on each device, which is then **merged with Supabase data**. The cloud only has 7 completed games, but localStorage has additional old games that are creating the discrepancy.

**The "Azure Trump" game doesn't exist in Supabase** - it's only in localStorage on one or both devices.

**Solution**: Clear localStorage on both devices and rely only on cloud data, OR investigate why some games aren't syncing to cloud.
