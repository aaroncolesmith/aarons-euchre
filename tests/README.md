# 🧪 Playwright Test Suite for Aaron's Euchre

This directory contains end-to-end tests for the Euchre game using Playwright.

## 📋 Features

- **Comprehensive logging** - Every action is logged to the console with emojis for easy tracking
- **Screenshot capture** - Screenshots are taken at every major step for debugging
- **Headless & Headed modes** - Run tests with or without a visible browser
- **Multiple test scenarios**:
  - Single player with bots
  - Two players in multiplayer mode
  - Loading saved games
  - Error handling (invalid table codes)

## 🚀 Quick Start

### Run Tests (Headless)
```bash
npm run test
```

### Run Tests (Headed - See the Browser)
```bash
npm run test:headed
```

### Run Tests in UI Mode (Interactive)
```bash
npm run test:ui
```

### Debug Tests
```bash
npm run test:debug
```

### View Test Report
```bash
npm run test:report
```

## 📁 Test Output

### Screenshots
All screenshots are saved to `tests/screenshots/` with descriptive names:
- Format: `{testName}_{stepName}_{timestamp}.png`
- Example: `single_player_03_logged_in_2025-12-22T19-30-45-123Z.png`

### Test Reports
- HTML report: `playwright-report/index.html`
- JSON results: `test-results/results.json`

### Videos
Videos are automatically recorded on test failures and saved to `test-results/`

## 🎯 Test Scenarios

### 1. Single Player Test
Tests a complete game flow with one human player and three bots:
1. Login as Aaron
2. Create a new table
3. Sit at seat 0
4. Add 3 bots
5. Start the match
6. Play 2 complete turns
7. Verify game state

### 2. Multiplayer Test
Tests synchronization between two players:
1. Player 1 (Aaron) creates a table
2. Player 2 (Polina) joins the table
3. Both players sit at their seats
4. Player 1 adds bots and starts the match
5. Both players play simultaneously
6. Verify both see the same game state

### 3. Load Saved Game Test
Tests the ability to resume a game:
1. Create and start a game
2. Navigate back to the landing page
3. Load the saved game
4. Verify game state is restored

### 4. Error Handling Test
Tests error handling for invalid inputs:
1. Attempt to join with an invalid table code
2. Verify appropriate error handling

## 🔧 Configuration

The test configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173` (configurable via `BASE_URL` env var)
- **Timeout**: 120 seconds per test
- **Workers**: 1 (sequential execution for game state consistency)
- **Browsers**: Chromium (Firefox and WebKit available but commented out)
- **Auto-start dev server**: Yes (runs `npm run dev` automatically)

## 📝 Test Structure

Each test follows this pattern:
1. **Setup** - Navigate to the app
2. **Login** - Authenticate as a user
3. **Game Setup** - Create/join table, sit at seats
4. **Game Play** - Execute game actions
5. **Verification** - Check game state
6. **Cleanup** - Screenshots and logging

## 🐛 Debugging

### View Console Logs
All test actions are logged with descriptive emojis:
- 🔐 Login actions
- 🏗️ Table creation
- 💺 Seat selection
- 🤖 Bot additions
- 🎮 Game start
- 🎲 Turn actions
- 📸 Screenshot captures

### Screenshots
Every major action captures a screenshot. Check `tests/screenshots/` for visual debugging.

### Video Recordings
Failed tests automatically record videos. Check `test-results/` for playback.

### Debug Mode
Run with `--debug` flag to step through tests:
```bash
npm run test:debug
```

## 🌐 Testing Against Production

To test against the live Vercel deployment:
```bash
BASE_URL=https://aarons-euchre.vercel.app npm run test
```

## 📊 CI/CD Integration

The tests are configured to work in CI environments:
- Retries: 2 attempts on CI
- Parallel execution: Disabled for consistency
- Video/screenshots: Captured on failure

## 🔍 Selectors Used

The tests use robust selectors:
- **Role-based**: `getByRole('button', { name: /login/i })`
- **Text-based**: `locator('text=/bidding/i')`
- **Input types**: `locator('input[type="text"]')`

This ensures tests are resilient to UI changes.

## 💡 Tips

1. **Run headed mode first** when developing tests to see what's happening
2. **Check screenshots** if a test fails to understand the state
3. **Adjust timeouts** in `playwright.config.ts` if your machine is slow
4. **Use test.only()** to run a single test during development
5. **Check console logs** for detailed step-by-step execution

## 🚨 Common Issues

### Port Already in Use
If port 5173 is already in use:
```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9
```

### Tests Timing Out
Increase timeouts in `playwright.config.ts`:
```typescript
timeout: 180 * 1000, // 3 minutes
```

### Screenshots Not Saving
Ensure the `tests/screenshots/` directory has write permissions:
```bash
chmod 755 tests/screenshots/
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
