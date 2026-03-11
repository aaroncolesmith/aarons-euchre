import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Peter Playwright Complete Game', () => {
    test.setTimeout(600000); // 10 minutes - full games can take a while

    test('Complete full game to 10 points', async ({ page }) => {
        console.log('\n\ud83c\udfae PETER-PLAYWRIGHT: COMPLETE EUCHRE GAME\n');
        console.log('\u2550'.repeat(80));

        // ========== SETUP ==========
        console.log('\n\u2699\ufe0f SETUP PHASE');

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        await page.getByPlaceholder('Enter Username').fill('peter-playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForTimeout(1000);
        console.log('  \u2705 Logged in');

        await page.getByRole('button', { name: /create game/i }).click();
        await page.waitForTimeout(1500);
        console.log('  \u2705 Created game');

        await page.getByRole('button', { name: /sit here/i }).first().click();
        await page.waitForTimeout(500);
        console.log('  \u2705 Seated');

        for (let i = 0; i < 3; i++) {
            const bots = await page.getByRole('button', { name: /add bot/i }).all();
            if (bots.length > 0) await bots[0].click();
            await page.waitForTimeout(200);
        }
        console.log('  \u2705 Bots added');

        await page.locator('button:has-text("START")').first().click();
        await page.waitForTimeout(2000);
        console.log('  \u2705 Match started\n');

        // ========== GAME LOOP ==========
        console.log('\ud83c\udfb2 GAME IN PROGRESS\n');

        let gameOver = false;
        let iter = 0;
        const maxIter = 600; // Enough for multiple full games
        let cardsPlayed = 0;
        let bids = 0;
        let lastAction = '';

        while (!gameOver && iter < maxIter) {
            iter++;
            await page.waitForTimeout(1000); // Reduced from 1500

            // Check game over
            if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
                console.log('\n\ud83c\udfc6 GAME OVER DETECTED');
                gameOver = true;
                break;
            }

            // Bidding - first round (pass)
            if (await page.locator('button:has-text("Order")').first().isVisible().catch(() => false) ||
                await page.locator('button:has-text("Pick")').first().isVisible().catch(() => false)) {
                await page.locator('button:has-text("PASS")').first().click().catch(() => { });
                await page.waitForTimeout(1000);
                bids++;
                lastAction = 'Pass first round';
                continue;
            }

            // Bidding - second round (call trump with keyboard)
            const suitBtns = await page.locator('button').filter({ hasText: /[\u2665\u2666\u2663\u2660]/ }).count();
            if (suitBtns > 0) {
                // Just press Enter to select first available suit
                await page.keyboard.press('Enter');
                await page.waitForTimeout(1500);
                bids++;
                lastAction = 'Call trump';
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
                    lastAction = 'Discard';
                    continue;
                }
            }

            // Play card - try all cards until one works
            const cards = await page.locator('[class*=\"CardComponent\"]').all();
            let playedCard = false;

            for (let i = 0; i < cards.length && !playedCard; i++) {
                try {
                    const clickable = await cards[i].evaluate((el) => {
                        const s = window.getComputedStyle(el);
                        return parseFloat(s.opacity) > 0.6 && s.cursor === 'pointer';
                    });

                    if (clickable) {
                        await cards[i].click();
                        await page.waitForTimeout(2000);
                        cardsPlayed++;
                        playedCard = true;
                        lastAction = `Play card ${i + 1}`;
                    }
                } catch (e) {
                    // Not clickable, try next
                }
            }

            // Logging
            if (iter % 25 === 0) {
                console.log(`  \ud83d\udd04 Iter ${iter} | Cards: ${cardsPlayed} | Bids: ${bids} | Last: ${lastAction}`);
            }

            // Safeguard - if no change for many iterations, something is wrong
            if (iter % 100 === 0) {
                console.log(`  \u26a0\ufe0f Checkpoint at iteration ${iter} - still running...`);
                await page.screenshot({
                    path: `tests/screenshots/checkpoint-${iter}.png`,
                    fullPage: true
                });
            }
        }

        // ========== VERIFICATION ==========
        console.log(`\n\u2699\ufe0f VERIFICATION (after ${iter} iterations)\n`);

        if (!gameOver) {
            console.log('\u274c FAILED: Game did not complete');
            console.log(`   Final stats: ${cardsPlayed} cards, ${bids} bids`);
            await page.screenshot({
                path: 'tests/screenshots/peter-failed-final.png',
                fullPage: true
            });
            throw new Error(`Game incomplete after ${iter} iterations`);
        }

        // Verify game over screen
        await expect(page.locator('text=GAME OVER')).toBeVisible();
        const winner = await page.locator('text=Wins!').textContent().catch(() => 'Unknown');
        console.log(`\ud83d\udc51 ${winner}`);

        await expect(page.locator('button:has-text("PLAY AGAIN")')).toBeVisible();
        await expect(page.locator('button:has-text("RETURN TO LANDING")')).toBeVisible();

        console.log(`\n\u2705 SUCCESS!`);
        console.log(`   Total iterations: ${iter}`);
        console.log(`   Cards played: ${cardsPlayed}`);
        console.log(`   Bids made: ${bids}`);
        console.log('\u2550'.repeat(80));

        await page.screenshot({
            path: 'tests/screenshots/peter-success-final.png',
            fullPage: true
        });
    });
});
