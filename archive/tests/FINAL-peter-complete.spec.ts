import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000); // 2 minutes

test('Peter Playwright - Full Game Complete', async ({ page }) => {
    console.log('\n🎮 PETER PLAYWRIGHT - COMPLETE GAME TO 10 POINTS\n');

    // ===== SETUP =====
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

    // ===== GAME LOOP =====
    let gameOver = false;
    let actions = 0;

    for (let i = 0; i < 200 && !gameOver; i++) {
        await page.waitForTimeout(1000);

        // Check game over
        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            console.log('\n🏆 GAME OVER!');
            gameOver = true;
            break;
        }

        // ===== BIDDING =====
        // First round - always pass
        const passBtn = page.locator('button:has-text("Pass")').first();
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click();
            actions++;
            console.log(`  ${actions}: Pass`);
            await page.waitForTimeout(800);
            continue;
        }

        // ===== PLAY CARD =====
        // Peter's cards are at the bottom in a motion.button with hover effect
        // Only playable cards will have cursor: pointer when it's his turn
        const playerCards = await page.locator('motion\\.button, button').evaluateAll((elements) => {
            return elements
                .filter(el => {
                    const box = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    // Peter's cards are at the bottom of the screen
                    // and have cursor: pointer when clickable
                    return box.y > window.innerHeight * 0.6 &&  // Bottom half of screen
                        box.width > 60 && box.width < 100 &&    // Card-like dimensions
                        style.cursor === 'pointer';
                })
                .map((el, idx) => ({ idx, y: el.getBoundingClientRect().y }));
        });

        if (playerCards.length > 0) {
            // Click the first playable card
            const allBottomElements = await page.locator('motion\\.button, button').all();
            for (const el of allBottomElements) {
                try {
                    const box = await el.boundingBox();
                    const style = await el.evaluate(e => {
                        const s = window.getComputedStyle(e);
                        return { cursor: s.cursor };
                    });

                    if (box && box.y > page.viewportSize()!.height * 0.6 &&
                        box.width > 60 && box.width < 100 &&
                        style.cursor === 'pointer') {
                        await el.click();
                        actions++;
                        console.log(`  ${actions}: Played card`);
                        await page.waitForTimeout(2000);
                        break;
                    }
                } catch (e) { /* Skip */ }
            }
        }

        if (actions % 10 === 0 && actions > 0) {
            console.log(`\n  📊 ${actions} actions (iter ${i})\n`);
        }
    }

    // ===== VERIFY =====
    console.log(`\n📋 Total: ${actions} actions\n`);

    if (!gameOver) {
        console.log(`❌ Game incomplete after ${actions} actions\n`);
        await page.screenshot({ path: 'tests/screenshots/final-incomplete.png', fullPage: true });
        throw new Error(`Game did not complete - ${actions} actions taken`);
    }

    await expect(page.locator('text=GAME OVER')).toBeVisible();
    await expect(page.locator('text=Wins!')).toBeVisible();
    console.log('✅ SUCCESS - GAME COMPLETED TO 10 POINTS!\n');
    await page.screenshot({ path: 'tests/screenshots/final-success.png', fullPage: true });
});
