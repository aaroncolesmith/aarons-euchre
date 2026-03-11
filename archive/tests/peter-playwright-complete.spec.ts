import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000); // 2 minutes

test('Peter Playwright - Fast Complete Game', async ({ page }) => {
    console.log('\n🎮 PETER PLAYWRIGHT - COMPLETE GAME TEST\n');

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
    await page.waitForTimeout(6000);
    console.log('✅ Game started\n');

    // Game loop - FAST
    let gameOver = false;
    let actions = 0;

    for (let i = 0; i < 200 && !gameOver; i++) {
        await page.waitForTimeout(800); // Faster iteration

        // Check game over
        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            console.log('\n🏆 GAME OVER!');
            gameOver = true;
            break;
        }

        // First round bidding - PASS
        const passBtn = page.locator('button').filter({ hasText: /^Pass$/i }).first();
        if (await passBtn.isVisible().catch(() => false)) {
            // Check if there are suit buttons visible (second round)
            const suitBtn = page.locator('button').filter({ hasText: /[♥♦♣♠]/ }).first();
            const hasSuits = await suitBtn.count() > 0;

            if (hasSuits) {
                // Second round - call trump (click hearts)
                const hearts = page.locator('button').filter({ hasText: '♥' }).first();
                if (await hearts.isVisible().catch(() => false)) {
                    await hearts.click({ force: true });
                    actions++;
                    console.log(`  ${actions}: Called HEARTS`);
                    await page.waitForTimeout(1000);
                    continue;
                }
            }

            // First round - pass
            await passBtn.click();
            actions++;
            console.log(`  ${actions}: Pass`);
            await page.waitForTimeout(600);
            continue;
        }

        // Play card - click first ENABLED card with pointer cursor
        const cards = await page.locator('button').filter({ hasText: /[AJKQ910][♥♦♣♠]/ }).all();

        for (const card of cards) {
            try {
                const [enabled, styles] = await Promise.all([
                    card.isEnabled(),
                    card.evaluate((el) => {
                        const s = window.getComputedStyle(el);
                        return {
                            cursor: s.cursor,
                            disabled: (el as HTMLButtonElement).disabled
                        };
                    })
                ]);

                if (enabled && styles.cursor === 'pointer' && !styles.disabled) {
                    const text = await card.textContent();
                    await card.click();
                    actions++;
                    console.log(`  ${actions}: ${text}`);
                    await page.waitForTimeout(1200);
                    break;
                }
            } catch (e) { /* Skip */ }
        }

        if (actions % 10 === 0 && actions > 0) {
            console.log(`\n  📊 ${actions} actions (iteration ${i})\n`);
        }
    }

    console.log(`\n📋 Total: ${actions} actions\n`);

    if (gameOver) {
        await expect(page.locator('text=GAME OVER')).toBeVisible();
        await expect(page.locator('text=Wins!')).toBeVisible();
        console.log('✅ SUCCESS!\n');
    } else {
        console.log(`❌ Incomplete: ${actions} actions\n`);
        await page.screenshot({ path: 'tests/screenshots/incomplete.png', fullPage: true });
        throw new Error(`Game incomplete after ${actions} actions`);
    }
});
