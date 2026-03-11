# 🎴 Intelligent Full Game Playwright Test

## Overview
This test (`intelligent-full-game.spec.ts`) is a comprehensive end-to-end Playwright test that plays through a complete game of Euchre from start to finish as the user **peter-playwright**.

## What It Does

### Test Flow
1. **Login** - Authenticates as peter-playwright
2. **Create Game** - Creates a new Euchre game table
3. **Sit in Seat** - Takes seat 0 (player position)
4. **Add Bots** - Fills the remaining 3 seats with AI bots
5. **Start Match** - Initiates the game
6. **Play Through Game** - Logically plays through an entire match until completion
7. **Verify Completion** - Confirms game over screen and reports statistics

### Intelligent Gameplay Features

The test includes logic for:

- **Overlay Handling**: Automatically dismisses trump announcements and other game overlays
- **Bidding Strategy**: Conservative strategy that passes on bidding decisions (allows bots to make calls)
- **Card Discarding**: Intelligently discards the weakest card when dealer
- **Card Playing**: Identifies playable cards based on opacity and cursor state
- **Hand Tracking**: Monitors hands completed, cards played, and tricks taken
- **Progress Reporting**: Logs detailed progress every 15 actions
- **Error Recovery**: Handles stuck states with diagnostic screenshots
- **Safety Checks**: Detects when no progress is being made and attempts recovery

## Configuration

- **Timeout**: 5 minutes (300,000ms) - enough for a full game
- **Max Actions**: 300 actions - sufficient for multiple hands
- **Safety Threshold**: Alerts if 10 consecutive iterations have no actions

## Running the Test

### Headed Mode (with visible browser):
```bash
npx playwright test tests/intelligent-full-game.spec.ts --headed
```

### Headless Mode (background):
```bash
npx playwright test tests/intelligent-full-game.spec.ts
```

### With Debugging:
```bash
npx playwright test tests/intelligent-full-game.spec.ts --debug
```

## Output

### Console Logging
The test provides detailed logging with visual separators:
- `═` for major sections
- `─` for subsections
- Emoji icons for different actions:
  - 🎮 Game start
  - 📝 Login
  - 🎲 Game creation
  - 💺 Seating
  - 🤖 Bot addition
  - ▶️ Match start
  - 🎴 Card play
  - 💬 Overlay dismissal
  - 🎯 Bidding
  - 🃏 Card plays
  - ✨ Hand completion
  - 📊 Progress updates
  - 🏆 Game over
  - ⚠️ Warnings
  - ❌ Errors

### Screenshots
Screenshots are automatically taken:
- Every 10 actions during gameplay
- When stuck state is detected
- On errors
- At final game completion
- Saved to: `tests/screenshots/`

### Final Statistics
Upon completion, the test reports:
- Total actions taken
- Hands completed
- Cards played
- Bids/passes made
- Tricks played

## Test Results

### Success Criteria
- Game reaches "GAME OVER" screen
- Winner is displayed
- "PLAY AGAIN" and "RETURN TO LANDING" buttons are visible
- Full statistics are logged

### Failure Conditions
- Game does not complete after 300 actions
- No game over screen detected
- Test will throw error with diagnostic screenshot

## Example Output

```
🎮 STARTING FULL EUCHRE GAME PLAYTHROUGH

════════════════════════════════════════════════════════════════════════════════

📝 STEP 1: Logging in as peter-playwright...
✅ Successfully logged in

🎲 STEP 2: Creating new game...
✅ Game created successfully

💺 STEP 3: Sitting in seat 0...
✅ Seated at position 0

🤖 STEP 4: Adding 3 bots to fill table...
   ✓ Bot 1 added
   ✓ Bot 2 added
   ✓ Bot 3 added
✅ All bots added successfully

▶️  STEP 5: Starting the match...
✅ Match started - game in progress

🎴 STEP 6: Playing through the euchre game...
────────────────────────────────────────────────────────────────────────────────
   🎯 First round bidding - PASSING
   🃏 Playing card 1/5
   ✨ Hand 1 COMPLETED!
   
   📊 Progress Update:
      • Actions: 15
      • Hands completed: 1
      • Cards played: 5
      • Bids/Passes: 3

   🏆 GAME OVER DETECTED!
────────────────────────────────────────────────────────────────────────────────

🎉 STEP 7: Verifying game completion...

✅ Game Over screen confirmed
👑 Winner: Team 1 Wins!
✅ Game over buttons verified

📊 FINAL GAME STATISTICS:
════════════════════════════════════════════════════════════════════════════════
   Total Actions Taken:    67
   Hands Completed:        8
   Cards Played:           40
   Bids/Passes Made:       16
   Tricks Played:          10
════════════════════════════════════════════════════════════════════════════════

✨ GAME COMPLETED SUCCESSFULLY! ✨
```

## Troubleshooting

### Test Times Out
- Increase timeout in playwright.config.ts
- Check if game UI has changed
- Review screenshots in tests/screenshots/

### Game Gets Stuck
- Check stuck-state screenshots
- Look for blocking overlays or modals
- Verify card selectors are still valid

### Cards Not Playing
- Check opacity and pointer-events CSS
- Verify cursor: pointer style
- Ensure card components have correct class names

## Future Enhancements

Potential improvements for more intelligent gameplay:
1. Parse actual card values from DOM
2. Implement strategic bidding based on hand strength
3. Optimal card play using Euchre rules (follow suit, trump strategy)
4. Partner awareness and coordination
5. Adapt based on score and game state

## Technical Details

### Selectors Used
- Username input: `getByPlaceholder('Enter Username')`
- Login button: `getByRole('button', { name: /login/i })`
- Create game: `getByRole('button', { name: /create game/i })`
- Sit buttons: `getByRole('button', { name: /sit here/i })`
- Add bot: `getByRole('button', { name: /add bot/i })`
- Start button: `locator('button:has-text("START")')`
- Pass button: `locator('button:has-text("PASS")')`
- Cards: `locator('[class*="CardComponent"]')`
- Game over: `locator('text=GAME OVER')`

### Why This Approach Works
- Uses conservative bidding (passing) to avoid complex hand analysis
- Relies on bots to make trump calls
- Plays first valid card (identified by cursor and opacity)
- Handles common game situations (overlays, bidding, discarding)
- Tracks progress to verify game is advancing
- Has safety mechanisms for stuck states
