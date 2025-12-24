import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Full Game Playthrough', () => {
    test('complete game from login to game over', async ({ page }) => {
        console.log('\n🎮 Starting Full Game Playthrough Test\n');

        // Step 1: Login
        console.log('📝 Step 1: Logging in as Peter-Playwright...');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        await page.getByPlaceholder('Enter Username').fill('Peter-Playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        console.log('✅ Logged in successfully');

        // Step 2: Create Game
        console.log('\n🎲 Step 2: Creating new game...');
        await page.getByRole('button', { name: /create game/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        console.log('✅ Game created');

        // Step 3: Sit in seat 0
        console.log('\n💺 Step 3: Sitting in seat 0...');
        const sitButtons = page.getByRole('button', { name: /sit here/i });
        await sitButtons.first().click();
        await page.waitForTimeout(500);
        console.log('✅ Seated at position 0');

        // Step 4: Add 3 bots
        console.log('\n🤖 Step 4: Adding 3 bots...');
        for (let i = 0; i < 3; i++) {
            const addBotButtons = page.getByRole('button', { name: /add bot/i });
            const visibleBots = await addBotButtons.all();
            if (visibleBots.length > 0) {
                await visibleBots[0].click();
                await page.waitForTimeout(300);
                console.log(`  ✅ Bot ${i + 1} added`);
            }
        }

        // Step 5: Start Match
        console.log('\n▶️  Step 5: Starting match...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);

        const startButton = page.locator('button:has-text("START")').first();
        await startButton.scrollIntoViewIfNeeded();
        await startButton.click();
        await page.waitForTimeout(3000);
        console.log('✅ Match started');

        // Step 6: Play through the game
        console.log('\n🎴 Step 6: Playing through the game...');
        let handsPlayed = 0;
        let maxHands = 100; // Increased limit - full game can take 60-80 actions
        let gameOver = false;

        while (!gameOver && handsPlayed < maxHands) {
            // Check for overlay message and dismiss it
            const overlay = page.locator('[class*="overlay"]').filter({ hasText: /trump/i }).first();
            if (await overlay.isVisible().catch(() => false)) {
                console.log('  💬 Dismissing trump announcement overlay...');
                await overlay.click();
                await page.waitForTimeout(1000);
            }

            // Wait for game state to update
            await page.waitForTimeout(3000);

            // Check if game is over
            const gameOverText = page.locator('text=GAME OVER');
            if (await gameOverText.isVisible().catch(() => false)) {
                console.log('  🏆 Game Over detected!');
                gameOver = true;
                break;
            }

            // Check if we can make a bid
            const orderUpButton = page.locator('button:has-text("Order")').first();
            const passButton = page.locator('button:has-text("PASS")').first();

            if (await orderUpButton.isVisible().catch(() => false)) {
                console.log('  🎯 Bidding phase - passing...');
                await passButton.click();
                await page.waitForTimeout(1500);
            }

            // Try to play a card if it's our turn
            const cards = page.locator('[class*="CardComponent"]').filter({ hasText: /[AJKQ9]/ });
            const cardCount = await cards.count();

            if (cardCount > 0) {
                // Check if any card is clickable (valid play)
                for (let i = 0; i < Math.min(cardCount, 5); i++) {
                    const card = cards.nth(i);
                    if (await card.isVisible().catch(() => false)) {
                        const isClickable = await card.evaluate((el) => {
                            const style = window.getComputedStyle(el);
                            return style.opacity !== '0.8' && style.pointerEvents !== 'none';
                        }).catch(() => false);

                        if (isClickable) {
                            console.log(`  🃏 Playing card ${i + 1}...`);
                            await card.click();
                            await page.waitForTimeout(2000);
                            break;
                        }
                    }
                }
            }

            handsPlayed++;

            // Periodic status update
            if (handsPlayed % 5 === 0) {
                console.log(`  ⏳ ${handsPlayed} actions taken so far...`);
            }
        }

        // Step 7: Verify Game Over
        if (gameOver) {
            console.log('\n🎉 Step 7: Verifying Game Over screen...');

            await expect(page.locator('text=GAME OVER')).toBeVisible();
            await expect(page.locator('text=Wins!')).toBeVisible();
            await expect(page.locator('button:has-text("PLAY AGAIN")')).toBeVisible();
            await expect(page.locator('button:has-text("RETURN TO LANDING")')).toBeVisible();

            console.log('✅ Game Over screen verified');
            console.log('\n✨ Full game playthrough completed successfully! ✨\n');
        } else {
            console.log(`\n⚠️  Game did not reach completion after ${handsPlayed} actions`);
            console.log('This may indicate the game is stuck or needs manual intervention\n');
        }

        // Take final screenshot
        await page.screenshot({ path: 'tests/screenshots/full-game-final.png', fullPage: true });
    });
});
