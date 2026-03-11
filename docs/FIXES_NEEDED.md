# Critical Fixes Needed

## 1. Game Over State Not Showing (HIGH PRIORITY)
**Issue:** When a team reaches 10+ points, game enters `game_over` phase but no UI displays
**Location:** `src/App.tsx` - need GameOver component
**Fix:** Create GameOver screen with:
- Winner announcement
- Final scores
- "Play Again" button
- "Return to Landing" button

## 2. Stats Not Being Tracked
**Issue:** Per-game tricks taken not showing in player cards
**Location:** Need to check if `tricksWon` state is being updated correctly
**Fix:** Verify trick counting logic in COMPLETE_TRICK action

## 3. Trump Announcement Dialog Missing 
**Issue:** No clear announcement when trump is called
**Location:** After MAKE_BID and DISCARD_CARD actions
**Fix:** Add overlay message showing:
- Who called trump
- What trump is
- Who plays first
**Examples:**
- "Your opponent Mimi has called up the 9 of diamonds to the dealer Aaron. Diamonds is trump, your teammate J-Bock plays first."
- "Your teammate J-Bock has called Clubs as trump. Your opponent Aaron plays first."

## 4. Upcard Shows After Being Turned Down
**Issue:** In bidding round 2, upcard still shows even though it's face-down
**Location:** `src/App.tsx` line ~1002
**Fix:** Only show upcard when `state.biddingRound === 1`
