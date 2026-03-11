import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000); // 2 minutes

test('Peter Playwright - WORKING Complete Game', async ({ page }) => {
    console.log('\n🎮 PETER-PLAYWRIGHT - COMPLETE GAME (FIXED SELECTORS)\n');

    // Setup
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

    // Game loop
    let gameOver = false;
    let iter = 0;
    let actions = 0;

    while (!gameOver && iter < 200) {
        iter++;

        // Check game over
        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            console.log('\n🏆 GAME OVER!');
            gameOver = true;
            break;
        }

        let acted = false;

        // Check for Step button (might need to click to advance)
        const stepBtn = page.locator('button:has-text("Step")');
        if (await stepBtn.isVisible().catch(() => false)) {
            await stepBtn.click().catch(() => { });
            await page.waitForTimeout(300);
            acted = true;
        }

        // Bidding - Try PASS button
        const passBtn = page.locator('button:has-text("PASS")');
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click();
            await page.waitForTimeout(500);
            actions++;
            console.log(`  ${actions}: Passed bid`);
            acted = true;
            continue;
        }

        // Try to play card - cards are buttons with card text like "A♥A♥"
        const cardButtons = await page.locator('button').filter({ hasText: /[AJKQ9][♥♦♣♠]/ }).all();
        for (const cardBtn of cardButtons) {
            try {
                const isVisible = await cardBtn.isVisible();
                const isEnabled = await cardBtn.isEnabled();

                if (isVisible && isEnabled) {
                    // Check if clickable (not disabled/faded)
                    const canClick = await cardBtn.evaluate((el) => {
                        const s = window.getComputedStyle(el);
                        return s.opacity !== '0.8' && s.pointerEvents !== 'none' && s.cursor === 'pointer';
                    }).catch(() => false);

                    if (canClick) {
                        await cardBtn.click();
                        await page.waitForTimeout(1000);
                        actions++;
                        console.log(`  ${actions}: Played card`);
                        acted = true;
                        break;
                    }
                }
            } catch (e) { /* Skip this card */ }
        }

        // Small wait if no action taken
        if (!acted) {
            await page.waitForTimeout(300);
        }

        // Progress
        if (actions % 10 === 0 && actions > 0) {
            console.log(`\n  📊 ${actions} actions in ${iter} iterations\n`);
        }
    }

    // Verify
    console.log(`\n📋 Final: ${actions} actions in ${iter} iterations\n`);

    if (!gameOver) {
        await page.screenshot({ path: 'tests/screenshots/working-incomplete.png', fullPage: true });
        throw new Error(`Game incomplete: ${actions} actions in ${iter} iterations`);
    }

    await expect(page.locator('text=GAME OVER')).toBeVisible();
    await expect(page.locator('text=Wins!')).toBeVisible();

    console.log('✅ SUCCESS - GAME COMPLETED!\n');
    await page.screenshot({ path: 'tests/screenshots/working-success.png', fullPage: true });
});
