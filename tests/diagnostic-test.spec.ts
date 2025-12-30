import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('Diagnostic - what happens after START', async ({ page }) => {
    console.log('\n🔍 DIAGNOSTIC TEST\n');

    await page.goto(BASE_URL);
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

    console.log('✅ About to click START...');
    await page.locator('button:has-text("START")').first().click();
    await page.waitForTimeout(3000);

    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: 'tests/screenshots/after-start.png', fullPage: true });

    // Check what's visible
    console.log('\n🔎 Checking visible elements:');
    console.log('  GAME OVER:', await page.locator('text=GAME OVER').isVisible().catch(() => false));
    console.log('  Order button:', await page.locator('button:has-text("Order")').isVisible().catch(() => false));
    console.log('  PASS button:', await page.locator('button:has-text("PASS")').isVisible().catch(() => false));
    console.log('  Hearts suit:', await page.locator('button').filter({ hasText: '♥' }).isVisible().catch(() => false));
    console.log('  Discard button:', await page.locator('button:has-text("Discard")').isVisible().catch(() => false));

    const cards = await page.locator('[class*="CardComponent"]').count();
    console.log('  Card count:', cards);

    if (cards > 0) {
        for (let i = 0; i < Math.min(cards, 5); i++) {
            const card = page.locator('[class*="CardComponent"]').nth(i);
            const opacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
            const cursor = await card.evaluate((el) => window.getComputedStyle(el).cursor);
            console.log(`  Card ${i}: opacity=${opacity}, cursor=${cursor}`);
        }
    }

    console.log('\n✅ Diagnostic complete\n');
});
