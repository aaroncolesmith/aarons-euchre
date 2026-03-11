import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Peter Playwright Fast Test', () => {
    test.setTimeout(120000); // 2 minutes - fail fast

    test('Complete euchre game with fast failure', async ({ page }) => {
        console.log('\n🎮 PETER-PLAYWRIGHT FAST TEST\n');

        // Setup
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
        console.log('✅ Setup complete\n');

        // Game loop with fast failure detection
        let gameOver = false;
        let i = 0;
        let cards = 0, bids = 0;
        let lastCards = 0, lastBids = 0;
        let noProgressCount = 0;
        const MAX_NO_PROGRESS = 20; // Fail if stuck for 20 iterations

        while (!gameOver && i < 200) { // Max 200 iterations
            i++;
            await page.waitForTimeout(800); // Faster iteration

            // Check game over
            if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
                gameOver = true;
                break;
            }

            // Check if stuck
            if (cards === lastCards && bids === lastBids) {
                noProgressCount++;
                if (noProgressCount >= MAX_NO_PROGRESS) {
                    console.log(`\n❌ STUCK: No progress for ${MAX_NO_PROGRESS} iterations`);
                    console.log(`   Cards: ${cards}, Bids: ${bids}`);
                    await page.screenshot({
                        path: 'tests/screenshots/stuck-final-state.png',
                        fullPage: true
                    });
                    throw new Error(`Test stuck - no progress after ${i} iterations`);
                }
            } else {
                noProgressCount = 0;
                lastCards = cards;
                lastBids = bids;
            }

            try {
                // First round bidding - always pass
                const orderUp = page.locator('button:has-text("Order")').first();
                const pickUp = page.locator('button:has-text("Pick")').first();
                const pass = page.locator('button:has-text("PASS")').first();

                if (await orderUp.isVisible().catch(() => false) ||
                    await pickUp.isVisible().catch(() => false)) {
                    await pass.click({ timeout: 2000 });
                    await page.waitForTimeout(1000);
                    bids++;
                    continue;
                }

                // Second round bidding - try all suits with force click
                const suits = [
                    page.locator('button').filter({ hasText: '♥' }).first(),
                    page.locator('button').filter({ hasText: '♦' }).first(),
                    page.locator('button').filter({ hasText: '♣' }).first(),
                    page.locator('button').filter({ hasText: '♠' }).first()
                ];

                let suitClicked = false;
                for (const suit of suits) {
                    if (await suit.isVisible().catch(() => false)) {
                        try {
                            await suit.click({ force: true, timeout: 2000 });
                            await page.waitForTimeout(1500);
                            bids++;
                            suitClicked = true;
                            break;
                        } catch (e) {
                            // Try next suit
                        }
                    }
                }
                if (suitClicked) continue;

                // Discard
                const discard = page.locator('button:has-text("Discard")').first();
                if (await discard.isVisible().catch(() => false)) {
                    const allCards = await page.locator('[class*="CardComponent"]').all();
                    if (allCards.length > 5) {
                        await allCards[allCards.length - 1].click();
                        await page.waitForTimeout(300);
                        await discard.click();
                        await page.waitForTimeout(1000);
                    }
                    continue;
                }

                // Play card - try all cards
                const cardList = await page.locator('[class*="CardComponent"]').all();
                for (const card of cardList) {
                    try {
                        const playable = await card.evaluate((el) => {
                            const s = window.getComputedStyle(el);
                            return parseFloat(s.opacity) > 0.6 && s.cursor === 'pointer';
                        });
                        if (playable) {
                            await card.click();
                            await page.waitForTimeout(2000);
                            cards++;
                            break;
                        }
                    } catch (e) { }
                }
            } catch (err) {
                // Continue on errors
            }

            // Progress log every 10 iterations
            if (i % 10 === 0) {
                console.log(`  🔄 ${i} | Cards: ${cards} | Bids: ${bids} | NoProgress: ${noProgressCount}`);
            }
        }

        // Verify completion
        console.log(`\n⚙️ RESULT (${i} iterations)\n`);

        if (!gameOver) {
            console.log(`❌ FAILED: No game over after ${i} iterations`);
            console.log(`   Final: ${cards} cards, ${bids} bids`);
            await page.screenshot({
                path: 'tests/screenshots/test-failed-final.png',
                fullPage: true
            });
            throw new Error(`Game did not complete in ${i} iterations`);
        }

        await expect(page.locator('text=GAME OVER')).toBeVisible();
        const winner = await page.locator('text=Wins!').textContent().catch(() => 'Unknown');
        console.log(`🏆 ${winner}`);

        await expect(page.locator('button:has-text("PLAY AGAIN")')).toBeVisible();

        console.log(`\n✅ SUCCESS!`);
        console.log(`   Iterations: ${i}`);
        console.log(`   Cards played: ${cards}`);
        console.log(`   Bids made: ${bids}\n`);

        await page.screenshot({
            path: 'tests/screenshots/test-success-final.png',
            fullPage: true
        });
    });
});
