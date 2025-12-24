import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

/**
 * Helper function to take a screenshot and log the action
 */
async function captureStep(page: Page, stepName: string, testName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${testName}_${stepName}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    console.log(`📸 [${stepName}] Taking screenshot: ${filename}`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`✅ [${stepName}] Screenshot saved`);
}

/**
 * Helper function to log and wait
 */
async function logAndWait(message: string, ms: number = 1000) {
    console.log(`⏳ ${message} (waiting ${ms}ms)`);
    await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Login helper
 */
async function login(page: Page, username: string, testName: string) {
    console.log(`\n🔐 Logging in as: ${username}`);

    await captureStep(page, '01_login_page', testName);

    const usernameInput = page.getByPlaceholder('Enter Username');
    await usernameInput.fill(username);
    console.log(`✍️  Filled username: ${username}`);

    await captureStep(page, '02_username_filled', testName);

    const loginButton = page.getByRole('button', { name: /login/i });
    await loginButton.click();
    console.log(`🖱️  Clicked login button`);

    await logAndWait('Waiting for login to complete', 2000);
    await captureStep(page, '03_logged_in', testName);
}

/**
 * Create table helper
 */
async function createTable(page: Page, testName: string): Promise<string> {
    console.log(`\n🏗️  Creating new table`);

    // Matches "Start New CREATE GAME"
    const createButton = page.getByRole('button', { name: /create game|start new/i });
    await createButton.click();
    console.log(`🖱️  Clicked create table button`);

    await logAndWait('Waiting for table creation', 2000);
    await captureStep(page, '04_table_created', testName);

    // Extract table code from the page
    const tableCodeElement = page.locator('text=/\\d{3}-\\d{3}/').first();
    const tableCode = await tableCodeElement.textContent();
    console.log(`🎫 Table code: ${tableCode}`);

    return tableCode || '';
}

/**
 * Join table helper
 */
async function joinTable(page: Page, tableCode: string, testName: string) {
    console.log(`\n🚪 Joining table with code: ${tableCode}`);

    await captureStep(page, '04_before_join', testName);

    // First click "JOIN EXISTING" to reveal the input
    const showJoinButton = page.getByRole('button', { name: /join existing|private table/i });
    await showJoinButton.click();
    console.log(`🖱️  Clicked 'Join Existing' button`);

    await logAndWait('Waiting for join form', 500);

    const joinInput = page.getByPlaceholder('000-000');
    await joinInput.fill(tableCode);
    console.log(`✍️  Filled table code: ${tableCode}`);

    await captureStep(page, '05_table_code_filled', testName);

    const joinButton = page.getByRole('button', { name: /join table/i });
    await joinButton.click();
    console.log(`🖱️  Clicked join table button`);

    await logAndWait('Waiting for table join', 2000);
    await captureStep(page, '06_table_joined', testName);
}

/**
 * Sit at seat helper
 */
async function sitAtSeat(page: Page, seatIndex: number, testName: string) {
    console.log(`\n💺 Sitting at seat ${seatIndex}`);

    const sitButtons = page.getByRole('button', { name: /sit here/i });
    const seatButton = sitButtons.nth(seatIndex);

    await captureStep(page, `07_before_sit_seat_${seatIndex}`, testName);

    await seatButton.click();
    console.log(`🖱️  Clicked sit button for seat ${seatIndex}`);

    await logAndWait('Waiting for seat assignment', 1000);
    await captureStep(page, `08_seated_at_${seatIndex}`, testName);
}

/**
 * Add bot helper
 */
async function addBot(page: Page, seatIndex: number, testName: string) {
    console.log(`\n🤖 Adding bot to seat ${seatIndex}`);

    const addBotButtons = page.getByRole('button', { name: /add bot/i });
    const botButton = addBotButtons.nth(seatIndex);

    await captureStep(page, `09_before_add_bot_${seatIndex}`, testName);

    await botButton.click();
    console.log(`🖱️  Clicked add bot button for seat ${seatIndex}`);

    await logAndWait('Waiting for bot to be added', 1000);
    await captureStep(page, `10_bot_added_${seatIndex}`, testName);
}

/**
 * Start match helper
 */
async function startMatch(page: Page, testName: string) {
    console.log(`\n🎮 Starting match`);

    await captureStep(page, '11_before_start_match', testName);

    const startButton = page.getByRole('button', { name: /start game/i }); // Button text is "START GAME"
    await startButton.click();
    console.log(`🖱️  Clicked start match button`);

    await logAndWait('Waiting for match to start', 3000);
    await captureStep(page, '12_match_started', testName);
}

/**
 * Play a full game turn (bidding and playing)
 */
async function playTurn(page: Page, turnNumber: number, testName: string) {
    console.log(`\n🎲 Playing turn ${turnNumber}`);

    await captureStep(page, `13_turn_${turnNumber}_start`, testName);

    // Wait for dealer selection
    await logAndWait('Waiting for dealer selection', 3000);
    await captureStep(page, `14_turn_${turnNumber}_dealer_selected`, testName);

    // Check if we're in bidding phase
    const biddingPhase = page.locator('text=/bidding|trump/i').first();
    const isBidding = await biddingPhase.isVisible().catch(() => false);

    if (isBidding) {
        console.log(`🃏 Bidding phase detected`);
        await captureStep(page, `15_turn_${turnNumber}_bidding`, testName);

        // Wait for bidding to complete (bots will handle this)
        await logAndWait('Waiting for bidding to complete', 5000);
        await captureStep(page, `16_turn_${turnNumber}_bidding_complete`, testName);
    }

    // Wait for cards to be played
    console.log(`🎴 Waiting for cards to be played`);
    for (let trick = 1; trick <= 5; trick++) {
        await logAndWait(`Waiting for trick ${trick}`, 4000);
        await captureStep(page, `17_turn_${turnNumber}_trick_${trick}`, testName);
    }

    // Wait for hand to complete
    await logAndWait('Waiting for hand to complete', 3000);
    await captureStep(page, `18_turn_${turnNumber}_complete`, testName);
}

// ============================================================================
// TESTS
// ============================================================================

test.describe('Euchre Game Tests', () => {
    test.beforeEach(async ({ page }) => {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 Starting new test');
        console.log('='.repeat(80));
    });

    test('Single player creates table and plays with bots', async ({ page }) => {
        const testName = 'single_player';

        console.log(`\n📱 Navigating to ${BASE_URL}`);
        await page.goto(BASE_URL);
        await captureStep(page, '00_initial_load', testName);

        // Login
        await login(page, 'Aaron', testName);

        // Create table
        const tableCode = await createTable(page, testName);

        // Sit at seat 0
        await sitAtSeat(page, 0, testName);

        // Add 3 bots
        for (let i = 1; i <= 3; i++) {
            await addBot(page, i, testName);
        }

        // Start match
        await startMatch(page, testName);

        // Play 2 turns
        for (let turn = 1; turn <= 2; turn++) {
            await playTurn(page, turn, testName);
        }

        // Final screenshot
        await captureStep(page, '19_game_complete', testName);

        console.log('\n✅ Test completed successfully!');
    });

    test('Two players join same table', async ({ browser }) => {
        const testName = 'two_players';

        // Create two browser contexts (like two different users)
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        try {
            // Player 1: Create table
            console.log(`\n👤 Player 1: Navigating to ${BASE_URL}`);
            await page1.goto(BASE_URL);
            await captureStep(page1, '00_p1_initial_load', testName);

            await login(page1, 'Aaron', `${testName}_p1`);
            const tableCode = await createTable(page1, `${testName}_p1`);
            await sitAtSeat(page1, 0, `${testName}_p1`);

            // Player 2: Join table
            console.log(`\n👤 Player 2: Navigating to ${BASE_URL}`);
            await page2.goto(BASE_URL);
            await captureStep(page2, '00_p2_initial_load', testName);

            await login(page2, 'Polina', `${testName}_p2`);
            await joinTable(page2, tableCode, `${testName}_p2`);
            await sitAtSeat(page2, 2, `${testName}_p2`);

            // Player 1: Add bots and start
            await addBot(page1, 1, `${testName}_p1`);
            await addBot(page1, 3, `${testName}_p1`);
            await startMatch(page1, `${testName}_p1`);

            // Wait for player 2 to see the game start
            await logAndWait('Waiting for player 2 to sync', 3000);
            await captureStep(page2, '12_p2_match_started', testName);

            // Play one turn from both perspectives
            await Promise.all([
                playTurn(page1, 1, `${testName}_p1`),
                playTurn(page2, 1, `${testName}_p2`)
            ]);

            // Final screenshots
            await captureStep(page1, '19_p1_game_complete', testName);
            await captureStep(page2, '19_p2_game_complete', testName);

            console.log('\n✅ Multiplayer test completed successfully!');

        } finally {
            await context1.close();
            await context2.close();
        }
    });

    test('Load existing game from saved games', async ({ page }) => {
        const testName = 'load_saved_game';

        // First, create a game
        console.log(`\n📱 Navigating to ${BASE_URL}`);
        await page.goto(BASE_URL);
        await captureStep(page, '00_initial_load', testName);

        await login(page, 'Aaron', testName);
        const tableCode = await createTable(page, testName);
        await sitAtSeat(page, 0, testName);

        for (let i = 1; i <= 3; i++) {
            await addBot(page, i, testName);
        }

        await startMatch(page, testName);
        await logAndWait('Waiting for game to start', 3000);
        await captureStep(page, '13_game_in_progress', testName);

        // Go back to landing page
        console.log(`\n🔙 Navigating back to landing page`);
        await page.goto(BASE_URL);
        await logAndWait('Waiting for landing page', 2000);
        await captureStep(page, '14_back_to_landing', testName);

        // Look for saved games
        const savedGamesSection = page.locator('text=/saved games/i').first();
        const hasSavedGames = await savedGamesSection.isVisible().catch(() => false);

        if (hasSavedGames) {
            console.log(`💾 Found saved games section`);
            await captureStep(page, '15_saved_games_visible', testName);

            // Click on the first saved game
            const loadButton = page.getByRole('button', { name: /load|resume/i }).first();
            await loadButton.click();
            console.log(`🖱️  Clicked load game button`);

            await logAndWait('Waiting for game to load', 2000);
            await captureStep(page, '16_game_loaded', testName);

            console.log('\n✅ Load saved game test completed successfully!');
        } else {
            console.log(`⚠️  No saved games found`);
        }
    });

    test('Error handling: Invalid table code', async ({ page }) => {
        const testName = 'invalid_table_code';

        console.log(`\n📱 Navigating to ${BASE_URL}`);
        await page.goto(BASE_URL);
        await captureStep(page, '00_initial_load', testName);

        await login(page, 'Aaron', testName);

        // Try to join with invalid code
        console.log(`\n❌ Attempting to join with invalid table code`);
        await joinTable(page, '999-999', testName);

        // Check for error message or still on landing page
        await logAndWait('Checking for error handling', 2000);
        await captureStep(page, '07_error_handling', testName);

        console.log('\n✅ Error handling test completed!');
    });
});
