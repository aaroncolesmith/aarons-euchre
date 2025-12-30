import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Peter Playwright - Full Game Test', () => {
    test.setTimeout(300000); // 5 minutes

    test('Play complete game to 10 points', async ({ page }) => {
        console.log('\n\ud83c\udfae PETER PLAYWRIGHT - FULL GAME TO 10 POINTS\n');
        console.log('\u2550'.repeat(80));

        // Login
        console.log('\n\ud83d\udcdd STEP 1: Login');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        await page.getByPlaceholder('Enter Username').fill('peter-playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForTimeout(1500);
        console.log('\u2705 Logged in');

        // Create game
        console.log('\n\ud83c\udfb2 STEP 2: Create Game');
        await page.getByRole('button', { name: /create game/i }).click();
        await page.waitForTimeout(2000);
        console.log('\u2705 Game created');

        // Sit
        console.log('\n\ud83d\udcba STEP 3: Sit in seat');
        await page.getByRole('button', { name: /sit here/i }).first().click();
        await page.waitForTimeout(500);
        console.log('\u2705 Seated');

        // Add bots
        console.log('\n\ud83e\udd16 STEP 4: Add bots');
        for (let i = 0; i < 3; i++) {
            const bots = await page.getByRole('button', { name: /add bot/i }).all();
            if (bots.length > 0) {
                await bots[0].click();
                await page.waitForTimeout(300);
            }
        }
        console.log('\u2705 Bots added');

        // Start
        console.log('\n\u25b6\ufe0f STEP 5: Start match');
        await page.locator('button:has-text("START")').first().click();
        await page.waitForTimeout(3000);
        console.log('\u2705 Match started');

        // Play loop
        console.log('\n\ud83c\udfb4 STEP 6: Playing game...\n');

        let gameOver = false;
        let iterations = 0;
        const maxIterations = 400;

        while (!gameOver && iterations < maxIterations) {
            iterations++;
            await page.waitForTimeout(1500);

            // Check game over
            if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
                console.log('\n\ud83c\udfc6 GAME OVER!');
                gameOver = true;
                break;
            }

            // First round bidding - always pass
            const orderUp = page.locator('button:has-text("Order")').first();
            const pickItUp = page.locator('button:has-text("Pick")').first();
            const passBtn = page.locator('button:has-text("PASS")').first();

            if (await orderUp.isVisible().catch(() => false) ||
                await pickItUp.isVisible().catch(() => false)) {
                console.log('  \ud83c\udfaf Passing first round');
                await passBtn.click().catch(() => { });
                await page.waitForTimeout(1500);
                continue;
            }

            // Second round bidding - call trump using keyboard
            const suitBtns = await page.locator('button').filter({ hasText: /[\u2665\u2666\u2663\u2660]/ }).all();
            if (suitBtns.length > 0) {
                console.log('  \ud83c\udfaf Calling trump (2nd round)');
                // Use keyboard to select first suit instead of clicking
                await page.keyboard.press('Tab');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(2000);
                continue;
            }

            // Discard
            const discardBtn = page.locator('button:has-text("Discard")').first();
            if (await discardBtn.isVisible().catch(() => false)) {
                console.log('  \ud83d\uddd1\ufe0f Discarding');
                const cards = await page.locator('[class*="CardComponent"]').all();
                if (cards.length > 5) {
                    await cards[cards.length - 1].click();
                    await page.waitForTimeout(500);
                    await discardBtn.click();
                    await page.waitForTimeout(1500);
                }
                continue;
            }

            // Play card
            const cards = await page.locator('[class*="CardComponent"]').all();
            for (const card of cards) {
                try {
                    const clickable = await card.evaluate((el) => {
                        const style = window.getComputedStyle(el);
                        return parseFloat(style.opacity) > 0.5 &&
                            style.pointerEvents !== 'none' &&
                            style.cursor === 'pointer';
                    });

                    if (clickable) {
                        console.log('  \ud83c\udccf Playing card');
                        await card.click();
                        await page.waitForTimeout(2500);
                        break;
                    }
                } catch (e) {
                    // Card not playable
                }
            }

            // Progress log
            if (iterations % 20 === 0) {
                console.log(`  \u23f3 Iteration ${iterations}...`);
            }
        }

        // Verify completion
        console.log('\n\ud83c\udf89 STEP 7: Verify game completion\n');

        if (gameOver) {
            await expect(page.locator('text=GAME OVER')).toBeVisible();

            // Get winner
            const winsText = await page.locator('text=Wins!').textContent().catch(() => 'Unknown');
            console.log(`\ud83d\udc51 Winner: ${winsText}`);

            // Verify buttons
            await expect(page.locator('button:has-text("PLAY AGAIN")')).toBeVisible();
            await expect(page.locator('button:has-text("RETURN TO LANDING")')).toBeVisible();

            console.log(`\n\u2705 SUCCESS! Game completed in ${iterations} iterations`);
            console.log('\u2550'.repeat(80));

            // Final screenshot
            await page.screenshot({
                path: 'tests/screenshots/peter-playwright-success.png',
                fullPage: true
            });
        } else {
            console.log(`\n\u274c FAILED: Game did not complete after ${iterations} iterations`);
            await page.screenshot({
                path: 'tests/screenshots/peter-playwright-failed.png',
                fullPage: true
            });
            throw new Error('Game did not complete');
        }
    });
});
