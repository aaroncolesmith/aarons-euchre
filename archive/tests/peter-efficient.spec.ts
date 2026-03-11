import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000); // 2 minutes is plenty for an efficient test

test('Peter Playwright - Efficient Complete Game', async ({ page }) => {
    console.log('\n🎮 PETER-PLAYWRIGHT EFFICIENT GAME TEST\n');

    // Setup (same as before)
    await page.goto(BASE_URL);
    await page.getByPlaceholder('Enter Username').fill('Peter-Playwright');
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
    await page.waitForTimeout(5000); // Wait for game to initialize
    console.log('✅ Setup complete\n');

    // Game loop - EFFICIENT VERSION
    let gameOver = false;
    let iter = 0;
    let actions = 0;

    while (!gameOver && iter < 200) {
        iter++;

        // Quick check for game over (no wait)
        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            console.log('\n🏆 GAME OVER!');
            gameOver = true;
            break;
        }

        let actionTaken = false;

        // Dismiss overlays (no wait after - click is async)
        const overlay = page.locator('[class*="overlay"]').filter({ hasText: /trump/i }).first();
        if (await overlay.isVisible().catch(() => false)) {
            await overlay.click().catch(() => { });
            actionTaken = true;
        }

        // Bidding - pass immediately
        const passBtn = page.locator('button:has-text("PASS")').first();
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click();
            await page.waitForTimeout(500); // Short wait for bidding to process
            actions++;
            actionTaken = true;
            console.log(`  ${actions}: Passed`);
            continue; // Skip to next iteration immediately
        }

        // Play card - find and click first playable card
        const cards = await page.locator('[class*="CardComponent"]').all();
        for (const card of cards) {
            try {
                const playable = await card.evaluate((el) => {
                    const s = window.getComputedStyle(el);
                    return s.opacity !== '0.8' && s.pointerEvents !== 'none';
                });

                if (playable) {
                    await card.click();
                    await page.waitForTimeout(1000); // Wait for card animation
                    actions++;
                    actionTaken = true;
                    console.log(`  ${actions}: Played card`);
                    break;
                }
            } catch (e) { /* Not playable */ }
        }

        // Only wait if no action was taken (to avoid busy loop)
        if (!actionTaken) {
            await page.waitForTimeout(500); // Short wait before retry
        }

        // Progress update
        if (actions % 10 === 0 && actions > 0) {
            console.log(`\n  📊 ${actions} actions in ${iter} iterations\n`);
        }
    }

    // Verify
    console.log(`\n📋 Total: ${actions} actions in ${iter} iterations\n`);

    if (!gameOver) {
        await page.screenshot({ path: 'tests/screenshots/efficient-incomplete.png', fullPage: true });
        throw new Error(`Game incomplete: ${actions} actions in ${iter} iterations`);
    }

    await expect(page.locator('text=GAME OVER')).toBeVisible();
    await expect(page.locator('text=Wins!')).toBeVisible();
    await expect(page.locator('button:has-text("PLAY AGAIN")')).toBeVisible();

    console.log('✅ SUCCESS!\n');
    await page.screenshot({ path: 'tests/screenshots/efficient-success.png', fullPage: true });
});
