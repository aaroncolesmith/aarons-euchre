import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Peter Playwright - Working Game Test', () => {
    test.setTimeout(600000); // 10 minutes

    test('Complete game using simple strategy', async ({ page }) => {
        console.log('\n\ud83c\udfae PETER-PLAYWRIGHT EUCHRE TEST\n');
        console.log('\u2550'.repeat(70));

        // Setup
        console.log('\n\ud83d\udd27 SETUP');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        await page.getByPlaceholder('Enter Username').fill('peter-playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForTimeout(1000);

        await page.getByRole('button', { name: /create game/i }).click();
        await page.waitForTimeout(1500);

        await page.getByRole('button', { name: /sit here/i }).first().click();
        await page.waitForTimeout(500);

        for (let i = 0; i < 3; i++) {
            const bots = await page.getByRole('button', { name: /add bot/i }).all();
            if (bots.length > 0) await bots[0].click();
            await page.waitForTimeout(200);
        }

        await page.locator('button:has-text("START")').first().click();
        await page.waitForTimeout(2000);
        console.log('\u2705 Ready to play\n');

        // Game loop
        console.log('\ud83c\udfb2 PLAYING...\n');

        let gameOver = false;
        let i = 0;
        const max = 600;
        let cards = 0, bids = 0;

        while (!gameOver && i < max) {
            i++;
            await page.waitForTimeout(1000);

            // Game over?
            if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
                gameOver = true;
                break;
            }

            try {
                // First round bidding
                if (await page.locator('button:has-text("Order")').first().isVisible().catch(() => false) ||
                    await page.locator('button:has-text("Pick")').first().isVisible().catch(() => false)) {
                    await page.locator('button:has-text("PASS")').first().click();
                    await page.waitForTimeout(1000);
                    bids++;
                    continue;
                }

                // Second round - click first suit button with force
                const hearts = page.locator('button').filter({ hasText: '\u2665' }).first();
                if (await hearts.isVisible().catch(() => false)) {
                    await hearts.click({ force: true, timeout: 3000 });
                    await page.waitForTimeout(1500);
                    bids++;
                    continue;
                }

                // Discard
                if (await page.locator('button:has-text("Discard")').first().isVisible().catch(() => false)) {
                    const allCards = await page.locator('[class*="CardComponent"]').all();
                    if (allCards.length > 5) {
                        await allCards[allCards.length - 1].click();
                        await page.waitForTimeout(300);
                        await page.locator('button:has-text("Discard")').first().click();
                        await page.waitForTimeout(1000);
                    }
                    continue;
                }

                // Play card
                const cardList = await page.locator('[class*="CardComponent"]').all();
                for (const card of cardList) {
                    try {
                        const ok = await card.evaluate((el) => {
                            const s = window.getComputedStyle(el);
                            return parseFloat(s.opacity) > 0.6 && s.cursor === 'pointer';
                        });
                        if (ok) {
                            await card.click();
                            await page.waitForTimeout(2000);
                            cards++;
                            break;
                        }
                    } catch (e) { /* not playable */ }
                }
            } catch (err) {
                // Continue on errors
            }

            if (i % 25 === 0) {
                console.log(`  \ud83d\udfe2 ${i} | Cards: ${cards} | Bids: ${bids}`);
            }

            if (i % 100 === 0) {
                console.log(`  \ud83d\udfe1 Checkpoint ${i}...`);
            }
        }

        // Verify
        console.log(`\n\u2699\ufe0f DONE (${i} iterations)\n`);

        if (!gameOver) {
            console.log('\u274c Game incomplete');
            throw new Error(`No game over after ${i} iterations`);
        }

        await expect(page.locator('text=GAME OVER')).toBeVisible();
        const w = await page.locator('text=Wins!').textContent().catch(() => '?');
        console.log(`\ud83c\udfc6 ${w}`);

        await expect(page.locator('button:has-text("PLAY AGAIN")')).toBeVisible();

        console.log(`\n\u2705 SUCCESS - ${cards} cards, ${bids} bids`);
        console.log('\u2550'.repeat(70));
    });
});
