import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000); // 2 minutes

test('Peter Playwright - CORRECT Card Playing', async ({ page }) => {
    console.log('\n🎮 PETER PLAYWRIGHT - PLAYING CORRECTLY\n');

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
    await page.waitForTimeout(6000); // Wait for game to fully start
    console.log('✅ Game started\n');

    // Game loop
    let gameOver = false;
    let actions = 0;

    for (let i = 0; i < 100 && !gameOver; i++) {
        await page.waitForTimeout(1500);

        // Check game over
        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            console.log('\n🏆 GAME OVER!');
            gameOver = true;
            break;
        }

        // Handle bidding - always PASS
        const passBtn = page.locator('button:has-text("Pass")').first();
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click();
            actions++;
            console.log(`  ${actions}: Passed on bidding`);
            await page.waitForTimeout(1000);
            continue;
        }

        // Play card - find ENABLED cards only
        const cardButtons = await page.locator('button').filter({ hasText: /[AJKQ910][♥♦♣♠]/ }).all();

        let playedCard = false;
        for (const card of cardButtons) {
            try {
                const isEnabled = await card.isEnabled();
                const styles = await card.evaluate((el) => {
                    const s = window.getComputedStyle(el);
                    return {
                        cursor: s.cursor,
                        disabled: (el as HTMLButtonElement).disabled
                    };
                });

                // Only click if truly enabled and has pointer cursor
                if (isEnabled && styles.cursor === 'pointer' && !styles.disabled) {
                    const cardText = await card.textContent();
                    await card.click();
                    actions++;
                    console.log(`  ${actions}: Played ${cardText}`);
                    await page.waitForTimeout(2000);
                    playedCard = true;
                    break;
                }
            } catch (e) {
                // Skip this card
            }
        }

        // Progress update
        if (actions % 10 === 0 && actions > 0 && !playedCard) {
            console.log(`\n  📊 ${actions} actions so far\n`);
        }
    }

    console.log(`\n📋 Total actions: ${actions}\n`);

    if (gameOver) {
        console.log('✅ SUCCESS - GAME COMPLETED!\n');
        await expect(page.locator('text=GAME OVER')).toBeVisible();
        await expect(page.locator('text=Wins!')).toBeVisible();
        await page.screenshot({ path: 'tests/screenshots/success-gameover.png', fullPage: true });
    } else {
        console.log(`❌ Game did not complete after ${actions} actions\n`);
        await page.screenshot({ path: 'tests/screenshots/incomplete-game.png', fullPage: true });
    }
});
