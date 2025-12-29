# Trump Calls Analytics Migration

## Overview
This migration adds critical analytics fields to the `trump_calls` table that were missing in the initial Supabase migration. These fields are essential for debugging and analyzing trump calling patterns.

## Missing Fields Being Added
1. **user_type** - Whether the caller is Human or Bot
2. **dealer** - Name of the dealer for this hand
3. **dealer_relationship** - Relationship of dealer to caller (teammate/opponent/self/partner)
4. **bower_count** - Number of bowers (Jacks) in hand when trump was called
5. **trump_count** - Total number of trump cards (including bowers) in hand
6. **suit_count** - Number of cards in the called suit before trump was established
7. **hand_after_discard** - Comma-separated list of cards in hand after discarding

## How to Apply Migration

### Step 1: Run SQL Migration
Go to your Supabase project SQL Editor and execute:
```sql
supabase_migrations/add_trump_call_analytics_fields.sql
```

This will add the new columns to the existing `trump_calls` table without losing any data.

### Step 2: Verify Migration
After running the migration, verify the table structure:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trump_calls'
ORDER BY ordinal_position;
```

You should see all the new columns added.

### Step 3: Deploy Code Changes
The following files have been updated to save and retrieve the complete data:
- `src/utils/supabaseStats.ts` - saveTrumpCall() and getAllTrumpCalls()
- `src/utils/trumpCallLogger.ts` - saveTrumpCallLog()

After applying the migration, commit and deploy these code changes.

## Backward Compatibility
- Existing records will have default values:
  - `user_type` defaults to 'Human'
  - `bower_count`, `trump_count`, `suit_count` default to 0
  - `dealer`, `dealer_relationship`, `hand_after_discard` will be NULL for old records
- New records will have complete data
- The UI handles both old (incomplete) and new (complete) records gracefully

## Testing
After migration and deployment:
1. Play a game and call trump
2. Check the Stats → Trump Calls tab
3. Verify that new entries show:
   - Dealer name and relationship
   - Actual bower count, trump count, suit count
   - Complete hand after discard
   - Human/Bot designation

## Impact
This restores full analytical value to the trump calls table, enabling:
- Debugging trump calling decisions
- Analyzing hand strength patterns
- Comparing Human vs Bot calling tendencies
- Understanding dealer position impact on calls
