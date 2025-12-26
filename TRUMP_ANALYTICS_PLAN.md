# Trump Call Analytics Feature Plan

## Overview
Add comprehensive trump calling analytics to help audit and analyze trump calling decisions (especially by CPU players).

## Requirements

### Data Structure
Track each trump call with:
- WHO_CALLED_TRUMP: Player name
- USER_TYPE: "Human" or "Bot"  
- DEALER: Dealer name + relationship to current viewer
- CARD_PICKED_UP: Card from kitty (or "n/a" if second round)
- SUIT_CALLED: Hearts, Diamonds, Clubs, or Spades
- BOWER_COUNT: Number of bowers (right + left)
- TRUMP_COUNT: Total trump cards after call
- SUIT_COUNT: Number of cards in called suit (before trump established)
- HAND_AFTER_DISCARD: Comma-separated card codes (e.g., "JD, KD, AC")

### UI Components Needed

1. **New Stats Tab**: "Trump Calls"
   - Table view showing all logged trump calls
   - Sortable columns
   - Filter by player, user type, etc.
   - CSV export button

2. **End of Hand Button**: "View Trump Caller's Hand"
   - Appears after bidding phase completes
   - Shows popup with trump caller's hand at time of call
   - Shows all analytics (bower count, trump count, etc.)

3. **CSV Export**:
   - Tab-delimited format
   - Downloadable file: `euchre_trump_calls_[timestamp].csv`

## Implementation Steps

### Phase 1: Data Collection (DONE)
- ✅ Created `trumpCallLogger.ts` utility
- ✅ Helper functions for counting bowers, trump, suits
- ✅ Card formatting utilities
- ✅ CSV conversion function

### Phase 2: Integration (TODO)
- [ ] Add `trumpCallLogs` to GameState type
- [ ] Log trump calls in BID_TRUMP action (2 places in reducer)
- [ ] Store dealer relationship to current viewer
- [ ] Handle both picked-up card and second-round scenarios
- [ ] Capture hand after discard for picked-up scenarios

### Phase 3: UI - Stats Tab (TODO)  
- [ ] Add "Trump Calls" tab to StatsModal
- [ ] Create TrumpCallsTable component
- [ ] Add sorting functionality
- [ ] Add filtering options
- [ ] Add "Export CSV" button

### Phase 4: UI - Hand Viewer (TODO)
- [ ] Add "View Trump Hand" button that appears after bidding
- [ ] Create TrumpHandModal component
- [ ] Show cards with visual representation
- [ ] Show all analytics in a nice format
- [ ] Auto-dismiss or allow manual close

### Phase 5: Persistence (TODO)
- [ ] Save trump call logs to localStorage
- [ ] Consider adding to Supabase for cross-device access
- [ ] Add "Clear Logs" functionality

## Technical Notes

### Where to Hook In
- `BID_TRUMP` action in gameReducer (lines ~520-600)
- Two scenarios:
  1. Picking up kitty card (lines ~520-555)
  2. Calling new suit (lines ~557-600)

### Data to Capture
- Need caller's hand BEFORE any discards
- Need to calculate bower/trump counts based on called suit
- Need dealer name + relationship calculation
- For picked-up: which card was picked
- For second round: "n/a" for picked up card

### State Storage
Option A: Add to eventLog (already exists)
Option B: Separate `trumpCallLogs` array in state
Option C: localStorage only

**Recommendation**: Use separate `trumpCallLogs` in state + localStorage for easy access and persistence.

## Future Enhancements
- Statistical analysis dashboard
- Compare human vs bot trump calling patterns
- Success rate tracking (did caller's team win the hand?)
- AI training data export
- Historical trends over time

## Files to Modify
1. `src/types/game.ts` - Add TrumpCallLog to GameState
2. `src/store/GameStore.tsx` - Log calls in BID_TRUMP
3. `src/App.tsx` - Add Trump Calls tab and viewer modal
4. `src/utils/trumpCallLogger.ts` - Already created ✅

## Estimated Complexity
- Medium-High (touching core game logic)
- Need careful testing to avoid breaking existing functionality
- UI work is straightforward once data is captured
