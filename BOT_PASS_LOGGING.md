# Bot Pass Decision Logging

**Added:** 2026-01-02  
**Feature:** Bot Audit enhancement

---

## What Was Added

Added comprehensive logging for bot **pass decisions** during trump bidding. This helps analyze why bots are declining to call trump.

### Logged Information

When a bot passes on calling trump, the following is now logged to `bot_decisions` table:

#### **Round 1 (Upcard Available)**
- **Decision Type:** `pass`
- **Decision:** `Pass on {suit}` (e.g., "Pass on hearts")
- **Hand Strength:** Calculated strength for the upcard suit
- **Reasoning:** Why the hand didn't meet the threshold
- **Hand State:** The bot's current 5 cards
- **Table State:** Upcard and bidding round

#### **Round 2 (No Upcard)**
- **Decision Type:** `pass`
- **Decision:** `Pass (best: {suit})` (e.g., "Pass (best: clubs)")
- **Hand Strength:** Strength of their best available suit
- **Reasoning:** Why no suit met the threshold
- **Hand State:** The bot's current 5 cards
- **Table State:** Bidding round, turned down suit, and what their best suit would have been

---

## How It Works

### Round 1 Pass
```typescript
const { total: strength, reasoning } = calculateBibleHandStrength(
    currentPlayer.hand, 
    state.upcard.suit
);
// If strength < threshold → Pass & Log
```

### Round 2 Pass  
```typescript
const result = getBestBid(
    currentPlayer.hand.filter(c => c.suit !== upcard.suit),
    personality,
    position,
    round2 = true
);
// If no suit meets threshold → Pass & Log
// Logs best suit they had even though they passed
```

---

## Viewing Pass Decisions

**Bot Audit Tab:**
- Filter by "All" to see both calls and passes
- Pass decisions show up with:
  - Decision type: "pass"
  - The suit they passed on (or best available)
  - Hand strength calculation
  - Full reasoning

---

## Analytics Use Cases

### 1. **Threshold Calibration**
Analyze if bots are being too conservative:
```sql
SELECT 
    archetype,
    AVG(hand_strength) as avg_pass_strength,
    COUNT(*) as total_passes
FROM bot_decisions
WHERE decision_type = 'pass'
GROUP BY archetype;
```

### 2. **Missed Opportunities**
Find passes where hand strength was actually decent:
```sql
SELECT *
FROM bot_decisions
WHERE decision_type = 'pass'
  AND hand_strength > 40  -- Good hands that were passed
ORDER BY hand_strength DESC;
```

### 3. **Round 1 vs Round 2**
Compare passing behavior:
```sql
SELECT 
    game_phase,
    AVG(hand_strength) as avg_strength,
    COUNT(*) as passes
FROM bot_decisions
WHERE decision_type = 'pass'
GROUP BY game_phase;
```

### 4. **Personality Differences**
See how different archetypes approach passing:
```sql
SELECT 
    archetype,
    aggressiveness,
    risk_tolerance,
    AVG(hand_strength) as avg_pass_strength
FROM bot_decisions
WHERE decision_type = 'pass'
GROUP BY archetype, aggressiveness, risk_tolerance;
```

---

## Example Log Entries

### Round 1 Pass (Upcard: Jack of Hearts)
```json
{
  "decisionType": "pass",
  "decision": "Pass on hearts",
  "handStrength": 25.4,
  "reasoning": "Hand strength 25.4 below threshold for Conservative. Only 1 trump card, no bowers.",
  "gamePhase": "bidding (round 1)",
  "handState": [...5 cards],
  "tableState": {
    "upcard": { "rank": "J", "suit": "hearts" },
    "biddingRound": 1
  }
}
```

### Round 2 Pass (Best Available: Clubs)
```json
{
  "decisionType": "pass",
  "decision": "Pass (best: clubs)",
  "handStrength": 32.1,
  "reasoning": "Best available suit (clubs) scored 32.1, below 35.0 threshold",
  "gamePhase": "bidding (round 2)",
  "handState": [...5 cards],
  "tableState": {
    "biddingRound": 2,
    "turnedDownSuit": "hearts",
    "bestSuitAvailable": "clubs"
  }
}
```

---

## Benefits

1. ✅ **Complete Picture** - Now logs both calls AND passes
2. ✅ **Better Analysis** - Understand conservative vs aggressive bot behavior
3. ✅ **Threshold Tuning** - Data to optimize when bots should call trump4. ✅ **Pattern Recognition** - Identify if bots are missing clear trump calls
5. ✅ **Debugging** - Trace why a specific hand was passed on

---

## Database Schema

The existing `bot_decisions` table already supports this - no schema changes needed:
```sql
CREATE TABLE bot_decisions (
    id UUID PRIMARY KEY,
    game_code TEXT,
    player_name TEXT,
    archetype TEXT,
    decision_type TEXT,  -- 'bid', 'pass', 'play', 'discard'
    decision TEXT,
    reasoning TEXT,
    hand_strength NUMERIC,
    game_phase TEXT,
    hand_state JSONB,
    table_state JSONB,
    -- ... other fields
);
```

The `decision_type` field now includes `'pass'` in addition to `'bid'`, `'play'`, and `'discard'`.
