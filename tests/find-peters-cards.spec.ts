import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('DIAGNOSTIC: Find Peters actual cards and turn', async ({ page }) => {
    console.log('\n🔍 FINDING PETERS CARDS AND TURN\n');

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
    await page.waitForTimeout(10000); // Wait long enough for game to start and maybe get to Peter's turn

    console.log('📸 Taking screenshot of game state...\n');
    await page.screenshot({ path: 'tests/screenshots/game-state.png', fullPage: true });

    // Get ALL elements on the page with detailed info
    console.log('🔎 ANALYZING PAGE STRUCTURE:\n');

    // Check for any text mentioning "your turn" or "Peter"
    const bodyText = await page.locator('body').textContent();
    if (bodyText?.toLowerCase().includes('your turn')) {
        console.log('✅ Found "your turn" text on page!');
    }
    if (bodyText?.toLowerCase().includes('peter')) {
        console.log('✅ Found "peter" text on page!');
    }

    // Find all card-like elements (not just buttons)
    console.log('\n🃏 ALL CARD-LIKE ELEMENTS:\n');

    // Try different selectors
    const selectors = [
        '[class*="card" i]',
        '[class*="Card" i]',
        '[data-card]',
        'button:has-text("♥")',
        'button:has-text("♦")',
        'button:has-text("♣")',
        'button:has-text("♠")',
        'div:has-text("♥")',
        'div:has-text("♦")'
    ];

    for (const selector of selectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
            console.log(`  ${selector}: ${count} elements`);
        }
    }

    // Look for elements in specific areas (Peter's hand should be at bottom)
    console.log('\n📍 CHECKING BOTTOM OF SCREEN (Peters hand area):\n');
    const bottomCards = await page.locator('[class*="card" i]').all();
    for (let i = 0; i < Math.min(bottomCards.length, 10); i++) {
        const card = bottomCards[i];
        const box = await card.boundingBox();
        const text = await card.textContent().catch(() => '');
        const classes = await card.getAttribute('class').catch(() => '');

        if (box) {
            console.log(`  Card ${i}: y=${box.y}, text="${text?.trim()}", classes="${classes}"`);
        }
    }

    // Check for interactive elements
    console.log('\n🖱️  CLICKABLE/INTERACTIVE ELEMENTS:\n');
    const clickable = await page.locator('[style*="cursor: pointer"], [class*="clickable"], button[class*="card"]').all();
    for (let i = 0; i < Math.min(clickable.length, 10); i++) {
        const el = clickable[i];
        const text = await el.textContent().catch(() => '');
        const tag = await el.evaluate(e => e.tagName);
        const classes = await el.getAttribute('class').catch(() => '');
        console.log(`  ${i}: <${tag}> "${text?.trim()}" classes="${classes}"`);
    }

    console.log('\n✅ Diagnostic complete - check screenshot at tests/screenshots/game-state.png\n');
});
