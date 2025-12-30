import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('Try clicking Sync button', async ({ page }) => {
    console.log('\n🔍 Testing SYNC button\n');

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

    console.log('Before START - checking buttons:');
    const preButtons = await page.locator('button').all();
    for (const btn of preButtons) {
        const text = await btn.textContent().catch(() => '');
        if (text && await btn.isVisible()) {
            console.log(`  - "${text.trim()}"`);
        }
    }

    await page.locator('button:has-text("START")').first().click();
    await page.waitForTimeout(3000);

    console.log('\nAfter START - checking buttons:');
    const postButtons = await page.locator('button').all();
    for (const btn of postButtons) {
        const text = await btn.textContent().catch(() => '');
        if (text && await btn.isVisible()) {
            console.log(`  - "${text.trim()}"`);
        }
    }

    // Try clicking Sync button
    console.log('\nTrying to click SYNC button...');
    const syncBtn = page.locator('button:has-text("Sync")');
    if (await syncBtn.isVisible().catch(() => false)) {
        await syncBtn.click();
        console.log('✅ Clicked SYNC');
        await page.waitForTimeout(2000);

        // Check if Step button disappeared
        const stepBtn = page.locator('button:has-text("Step")');
        const stepVisible = await stepBtn.isVisible().catch(() => false);
        console.log(`Step button still visible: ${stepVisible}`);

        await page.screenshot({ path: 'tests/screenshots/after-sync.png', fullPage: true });
    } else {
        console.log('❌ SYNC button not found');
    }

    console.log('\n✅ Done\n');
});
