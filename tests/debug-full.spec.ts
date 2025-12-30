import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('DEBUG: Show all elements after START', async ({ page }) => {
    console.log('\n🔍 DEBUG TEST - Showing all elements\n');

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

    console.log('Clicking START button...');
    await page.locator('button:has-text("START")').first().click();

    // Wait various amounts and check what's visible
    for (let seconds = 0; seconds <= 10; seconds++) {
        await page.waitForTimeout(1000);

        const state = {
            sec: seconds,
            gameOver: await page.locator('text=GAME OVER').isVisible().catch(() => false),
            orderBtn: await page.locator('button:has-text("Order")').isVisible().catch(() => false),
            pickBtn: await page.locator('button:has-text("Pick")').isVisible().catch(() => false),
            passBtn: await page.locator('button:has-text("PASS")').isVisible().catch(() => false),
            heartSuit: await page.locator('button').filter({ hasText: '♥' }).isVisible().catch(() => false),
            cards: await page.locator('[class*="CardComponent"]').count(),
            allButtons: await page.locator('button').count(),
            overlays: await page.locator('[class*="overlay"]').count()
        };

        console.log(`${seconds}s:`, JSON.stringify(state, null, 2));

        // Take screenshot at 5 seconds
        if (seconds === 5) {
            await page.screenshot({ path: 'tests/screenshots/debug-5sec.png', fullPage: true });
            console.log('\n📸 Screenshot saved at 5 seconds\n');
        }
    }

    // List all visible buttons
    console.log('\n📋 All buttons on page:');
    const buttons = await page.locator('button').all();
    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
        const text = await buttons[i].textContent().catch(() => '');
        const visible = await buttons[i].isVisible().catch(() => false);
        if (visible && text) {
            console.log(`  Button ${i}: "${text.trim()}"`);
        }
    }

    console.log('\n✅ Debug complete\n');
});
