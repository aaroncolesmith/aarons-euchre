# Stats Reset V4 - Complete Wipe

**Date:** 2026-01-02  
**Version:** V1.38

---

## Problem

Player stats were completely corrupted due to multiple partial wipes and resets:

- **Huber:** Appeared in 36 games but `player_stats` showed only 6 games
- **Aaron:** Stats in active game (19 games, 473 hands) didn't match Supabase (6 games, 121 hands)
- **Inconsistent data** across all players - some had inflated stats, some had deflated stats

### Root Cause

Stats were wiped at various points but:
1. Active games kept old in-memory stats
2. Supabase table was partially reset
3. New games accumulated on top of corrupted baseline
4. Result: Complete data integrity failure

---

## Solution

**NUCLEAR RESET** - Wipe everything and start completely fresh.

### Changes Made

1. **SQL Migration (`003_stats_reset.sql`)**
   - `DELETE FROM player_stats;`
   - Clears all historical stats from Supabase

2. **localStorage Version Bump (v3 → v4)**
   - Changed `euchre_global_stats_v3` → `euchre_global_stats_v4`
   - Forces all clients to ignore old cached stats
   - All browsers start with empty stats object `{}`

3. **Code Updates**
   - `GameStore.tsx`: Updated get/save functions to use v4
   - `App.tsx`: Updated fallback loading to use v4

---

## How to Execute

### Step 1: Run SQL Migration
```sql
-- In Supabase SQL Editor
DELETE FROM player_stats;
```

### Step 2: Deploy Code
```bash
git add -A
git commit -m "V1.38: Complete stats reset"
git push origin main
```

### Step 3: All Clients Auto-Reset
- When users load the app, they'll use v4 (empty)
- Old v3 stats ignored
- Fresh stats start accumulating

---

## Expected Behavior After Reset

- ✅ All player stats show **0** initially
- ✅ First completed game → stats start counting
- ✅ All players in same game have consistent hand counts
- ✅ No more mystery 665 hands vs 121 hands discrepancies

---

## Future Prevention

To avoid this happening again:

1. **Never partially wipe stats** - Either keep them all or reset completely
2. **Bump version** whenever doing a reset (v5, v6, etc.)
3. **Document migrations** so we know what was wiped when
4. **Monitor for anomalies** - If hand counts don't make sense, investigate immediately

---

## Rollback (If Needed)

If we need to rollback:
```tsx
// Change back to v3 in GameStore.tsx and App.tsx
localStorage.getItem('euchre_global_stats_v3')
localStorage.setItem('euchre_global_stats_v3', ...)
```

But note: v3 data is corrupted, so rollback not recommended.

---

## Stats After This Reset

Everyone starts **FRESH**:
- Games Played: 0
- Hands Played: 0  
- Tricks Taken: 0
- Everything: 0

First completed game after deployment will create the first clean stats entry.

This is the **CORRECT** starting point for accurate, trustworthy statistics! 🎯
