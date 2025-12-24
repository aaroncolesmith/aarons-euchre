import { test, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureStep(page: Page, stepName: string, testName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${testName}_${stepName}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    console.log(`📸 [${stepName}] Taking screenshot: ${filename}`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`✅ [${stepName}] Screenshot saved`);
}

test.describe('Game Table View Screenshots (iPhone XS)', () => {
    test.use({
        viewport: { width: 375, height: 812 }, // iPhone XS
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    });

    test('capture game table with bidding', async ({ page }) => {
        const testName = 'game_table_mobile';

        console.log('\n📱 Capturing Game Table View on iPhone XS');

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Login
        await page.getByPlaceholder('Enter Username').fill('Peter-Playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Create game
        await page.getByRole('button', { name: /create game/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        await captureStep(page, '01_lobby', testName);

        // Sit at seat 0
        const sitButtons = page.getByRole('button', { name: /sit here/i });
        await sitButtons.first().click();
        await page.waitForTimeout(500);

        await captureStep(page, '02_seated', testName);

        // Add 3 bots
        const addBotButtons = page.getByRole('button', { name: /add bot/i });
        for (let i = 0; i < 3; i++) {
            const visibleBots = await addBotButtons.all();
            if (visibleBots.length > 0) {
                await visibleBots[0].click();
                await page.waitForTimeout(300);
            }
        }

        await captureStep(page, '03_bots_added', testName);

        // Scroll to bottom to find START MATCH button
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);

        // Start match - try different selectors
        console.log('Looking for START MATCH button...');
        const startButton = page.locator('button:has-text("START")').first();
        await startButton.scrollIntoViewIfNeeded();
        await startButton.click();
        await page.waitForTimeout(3000);

        await captureStep(page, '04_dealer_selection', testName);

        // Wait for bidding phase (game progresses automatically with bots)
        await page.waitForTimeout(8000);

        await captureStep(page, '05_bidding_or_playing', testName);

        // Wait a bit more to potentially see cards being played
        await page.waitForTimeout(5000);

        await captureStep(page, '06_gameplay', testName);

        console.log('\n✅ Screenshots captured successfully!');
    });
});
