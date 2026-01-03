# Event Sourcing - Complete Play-by-Play Logging

**Every action = One event**

---

## 📊 **Event Types:**

### 1. **game_start**
```json
{
  "event_type": "game_start",
  "game_code": "123-456",
  "hand_number": 0,
  "event_data": {
    "players": ["Aaron", "Fizz", "Buff", "Huber"],
    "team1": ["Aaron", "Buff"],
    "team2": ["Fizz", "Huber"]
  }
}
```

### 2. **deal**
```json
{
  "event_type": "deal",
  "game_code": "123-456",
  "hand_number": 1,
  "player_name": "Huber",
  "player_seat": 3,
  "event_data": {
    "dealer_seat": 3,
    "upcard": {"rank": "J", "suit": "hearts"}
  }
}
```

### 3. **bid** (order up / call trump)
```json
{
  "event_type": "bid",
  "game_code": "123-456",
  "hand_number": 1,
  "player_name": "Aaron",
  "player_seat": 0,
  "event_data": {
    "suit": "hearts",
    "isLoner": false,
    "round": 1,
    "reasoning": "Strong hand"
  }
}
```

### 4. **pass**
```json
{
  "event_type": "pass",
  "game_code": "123-456",
  "hand_number": 1,
  "player_name": "Fizz",
  "player_seat": 1,
  "event_data": {
    "round": 1
  }
}
```

### 5. **trump_set**
```json
{
  "event_type": "trump_set",
  "game_code": "123-456",
  "hand_number": 1,
  "event_data": {
    "suit": "spades",
    "caller": "Aaron",
    "caller_seat": 0,
    "isLoner": false
  }
}
```

### 6. **play_card**
```json
{
  "event_type": "play_card",
  "game_code": "123-456",
  "hand_number": 1,
  "trick_number": 1,
  "player_name": "Aaron",
  "player_seat": 0,
  "event_data": {
    "card": {"rank": "A", "suit": "spades"},
    "leadSuit": null,
    "isLead": true
  }
}
```

### 7. **trick_won**
```json
{
  "event_type": "trick_won",
  "game_code": "123-456",
  "hand_number": 1,
  "trick_number": 1,
  "player_name": "Aaron",
  "player_seat": 0,
  "event_data": {
    "cards": [
      {"player": "Aaron", "card": {"rank": "A", "suit": "spades"}},
      {"player": "Fizz", "card": {"rank": "K", "suit": "spades"}},
      {"player": "Huber", "card": {"rank": "10", "suit": "hearts"}}
    ],
    "trump": "spades"
  }
}
```

### 8. **hand_won**
```json
{
  "event_type": "hand_won",
  "game_code": "123-456",
  "hand_number": 1,
  "event_data": {
    "winner_team": 1,
    "team1_tricks": 3,
    "team2_tricks": 2,
    "points_scored": 1,
    "team1_score": 1,
    "team2_score": 0,
    "euchre": false,
    "sweep": false
  }
}
```

### 9. **game_won**
```json
{
  "event_type": "game_won",
  "game_code": "123-456",
  "event_data": {
    "winner_team": 1,
    "final_score": {"team1": 10, "team2": 7},
    "total_hands": 8,
    "winners": ["Aaron", "Buff"]
  }
}
```

---

## 🔄 **Stats Derivation Examples:**

### Games Played
```sql
SELECT COUNT(DISTINCT game_code)
FROM play_events
WHERE player_name = 'Aaron'
  AND event_type = 'game_start';
```

### Games Won
```sql
SELECT COUNT(*)
FROM play_events
WHERE event_type = 'game_won'
  AND event_data->'winners' @> '["Aaron"]';
```

### Tricks Taken
```sql
SELECT COUNT(*)
FROM play_events
WHERE player_name = 'Aaron'
  AND event_type = 'trick_won';
```

### Tricks Played
```sql
SELECT COUNT(*)
FROM play_events
WHERE player_name = 'Aaron'
  AND event_type = 'play_card';
```

### Calls Made
```sql
SELECT COUNT(*)
FROM play_events
WHERE player_name = 'Aaron'
  AND event_type = 'bid';
```

### Calls Won
```sql
SELECT COUNT(*)
FROM play_events p1
JOIN play_events p2 ON p1.game_code = p2.game_code AND p1.hand_number = p2.hand_number
WHERE p1.player_name = 'Aaron'
  AND p1.event_type = 'bid'
  AND p2.event_type = 'hand_won'
  AND (
    (p2.event_data->>'winner_team')::int = 1 AND p1.player_seat IN (0, 2)
    OR
    (p2.event_data->>'winner_team')::int = 2 AND p1.player_seat IN (1, 3)
  );
```

### Euchres Made
```sql
SELECT COUNT(*)
FROM play_events
WHERE event_type = 'hand_won'
  AND event_data->>'euchre' = 'true'
  AND (
    event_data->>'winner_team' = '1' 
    AND player_name IN (SELECT DISTINCT player_name FROM play_events WHERE player_seat IN (0, 2))
  );
```

---

## 🚀 **Implementation in Code:**

### Add logging helper:
```typescript
// utils/eventLogger.ts
export async function logPlayEvent(event: {
    gameCode: string;
    handNumber: number;
    trickNumber?: number;
    eventType: string;
    eventData: any;
    playerName?: string;
    playerSeat?: number;
}) {
    await supabase.from('play_events').insert({
        game_code: event.gameCode,
        hand_number: event.handNumber,
        trick_number: event.trickNumber,
        event_type: event.eventType,
        event_data: event.eventData,
        player_name: event.playerName,
        player_seat: event.playerSeat,
    });
}
```

### Log in GameStore reducer:

```typescript
case 'PLAY_CARD': {
    // ... existing logic ...
    
    // Log the play
    logPlayEvent({
        gameCode: state.tableCode,
        handNumber: state.handsPlayed + 1,
        trickNumber: Math.floor(...),
        eventType: 'play_card',
        eventData: {
            card: action.payload.card,
            leadSuit: state.currentTrick[0]?.card.suit || null,
            isLead: state.currentTrick.length === 0
        },
        playerName: player.name,
        playerSeat: action.payload.playerIndex
    });
}
```

---

## ✅ **Advantages:**

1. **Complete Audit Trail** - Every action logged
2. **Game Replay** - Can reconstruct entire game from events
3. **Flexible Analytics** - Derive ANY stat from raw events
4. **AI Training Data** - Perfect for training bots
5. **No Data Loss** - Events are immutable
6. **Debuggable** - Can see exactly what happened

---

## 🎯 **What You Can Build:**

- **Stats Dashboard** - Real-time stats from events
- **Game Replayer** - Watch any game back
- **Performance Analytics** - Win rates by position, suit, etc.
- **Bot Training** - Feed raw events to ML models
- **Leaderboards** - Any custom ranking you want
- **Audit Trail** - Investigate suspicious games

**This is the way. Want me to implement it?** 🚀
