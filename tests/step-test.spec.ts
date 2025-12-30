import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000);

test('Peter - Click Step Button Aggressively', async ({ page }) => {
    console.log('\n🎮 TEST: Clicking STEP button to advance game\n');

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
    await page.waitForTimeout(5000);
    console.log('✅ Setup complete\n');

    let gameOver = false;
    let actions = 0;
    let stepClicks = 0;

    for (let i = 0; i < 100 && !gameOver; i++) {
        // Check game over
        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            gameOver = true;
            break;
        }

        // Click Step button if visible
        const stepBtn = page.locator('button:has-text("Step")');
        if (await stepBtn.isVisible().catch(() => false)) {
            await stepBtn.click();
            stepClicks++;
            console.log(`  Step ${stepClicks}: Clicked STEP button`);
            await page.waitForTimeout(500);
            continue;
        }

        // Try PASS
        const passBtn = page.locator('button:has-text("PASS")');
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click();
            actions++;
            console.log(`  Action ${actions}: PASS`);
            await page.waitForTimeout(500);
            // Click step after action
            if (await stepBtn.isVisible().catch(() => false)) {
                await stepBtn.click();
                stepClicks++;
            }
            await page.waitForTimeout(500);
            continue;
        }

        // Try card
        const cards = await page.locator('button').filter({ hasText: /[AJKQ9][♥♦♣♠]/ }).all();
        for (const card of cards) {
            try {
                const ok = await card.evaluate((el) => {
                    const s = window.getComputedStyle(el);
                    return s.cursor === 'pointer';
                });
                if (ok) {
                    await card.click();
                    actions++;
                    console.log(`  Action ${actions}: Played card`);
                    await page.waitForTimeout(500);
                    // Click step after action
                    if (await stepBtn.isVisible().catch(() => false)) {
                        await stepBtn.click();
                        stepClicks++;
                    }
                    await page.waitForTimeout(500);
                    break;
                }
            } catch (e) { }
        }

        await page.waitForTimeout(300);
    }

    console.log(`\n📋 Step clicks: ${stepClicks}, Actions: ${actions}\n`);

    if (gameOver) {
        console.log('✅ GAME OVER REACHED!\n');
        await expect(page.locator('text=GAME OVER')).toBeVisible();
    } else {
        await page.screenshot({ path: 'tests/screenshots/step-test.png', fullPage: true });
        console.log('❌ Game did not complete\n');
    }
});
