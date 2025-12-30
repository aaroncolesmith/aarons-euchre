import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('PETER PLAYWRIGHT - COMPLETE GAME', async ({ page }) => {
    console.log('\n🎮 FINAL ATTEMPT - PETER PLAYWRIGHT COMPLETE GAME\n');

    // ===== SETUP =====
    await page.goto(BASE_URL);
    await page.getByPlaceholder('Enter Username').fill('peter-playwright');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: /create game/i }).click();
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /sit here/i }).first().click();
    await page.waitForTimeout(500);

    for (let i = 0; i < 3; i++) {
        const bots = await page.getByRole('button', { name: /add bot/i }).all();
        if (bots.length > 0) await bots[0].click();
        await page.waitForTimeout(300);
    }

    await page.locator('button:has-text("START")').first().click();
    console.log('✅ Setup complete, game starting...\n');

    // Wait for game to fully start - takes up to 5 seconds
    await page.waitForTimeout(5000);

    // ===== GAME LOOP =====
    let gameOver = false;
    let iter = 0;
    let actions = 0;

    while (!gameOver && iter < 150) {
        iter++;
        await page.waitForTimeout(1500);

        // Check game over
        if (await page.locator('text=GAMEAVER').isVisible().catch(() => false)) {
            console.log('\n🏆 GAME OVER FOUND!');
            gameOver = true;
            break;
        }

        //Dismiss any overlays by clicking center of screen
        await page.mouse.click(600, 400).catch(() => { });

        // ALWAYS PASS on all bidding
        const passBtn = page.locator('button:has-text("PASS")').first();
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click().catch(() => { });
            await page.waitForTimeout(1000);
            actions++;
            console.log(`  ${iter}: Passed on bidding`);
            continue;
        }

        // Try to play any clickable card
        const cards = await page.locator('[class*="CardComponent"]').all();
        for (const card of cards) {
            try {
                const canClick = await card.evaluate((el) => {
                    const s = window.getComputedStyle(el);
                    return parseFloat(s.opacity) > 0.5 && s.cursor === 'pointer';
                });
                if (canClick) {
                    await card.click();
                    await page.waitForTimeout(2500);
                    actions++;
                    console.log(`  ${iter}: Played card`);
                    break;
                }
            } catch (e) { }
        }

        // Log every 15 iterations
        if (iter % 15 === 0) {
            console.log(`\n  📊 Checkpoint ${iter} - ${actions} actions taken\n`);
        }
    }

    // ===== VERIFY =====
    console.log(`\n📋 Final: ${iter} iterations, ${actions} actions\n`);

    if (!gameOver) {
        await page.screenshot({ path: 'tests/screenshots/final-incomplete.png', fullPage: true });
        throw new Error(`Game incomplete after ${iter} iterations`);
    }

    await expect(page.locator('text=GAME OVER')).toBeVisible();
    console.log('✅ GAME COMPLETED SUCCESSFULLY!\n');
});
