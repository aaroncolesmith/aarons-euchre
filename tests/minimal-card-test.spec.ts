import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('MINIMAL: Just try to play ONE card', async ({ page }) => {
    console.log('\n🎯 MINIMAL TEST - Can we play ONE card?\n');

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
    console.log('✅ Started game, waiting for cards...\n');

    // Wait for game to initialize
    await page.waitForTimeout(8000);

    // Find ALL buttons and log them
    console.log('📋 ALL BUTTONS ON PAGE:');
    const allButtons = await page.locator('button').all();
    for (let i = 0; i < allButtons.length; i++) {
        const text = await allButtons[i].textContent().catch(() => '');
        const visible = await allButtons[i].isVisible().catch(() => false);
        const enabled = await allButtons[i].isEnabled().catch(() => false);
        if (visible && text) {
            console.log(`  ${i}: "${text.trim()}" (enabled: ${enabled})`);
        }
    }

    // Find card buttons specifically
    console.log('\n🃏 CARD BUTTONS (matching pattern):');
    const cardButtons = await page.locator('button').filter({ hasText: /[AJKQ910][♥♦♣♠]/ }).all();
    console.log(`Found ${cardButtons.length} card buttons`);

    for (let i = 0; i < cardButtons.length; i++) {
        const card = cardButtons[i];
        const text = await card.textContent();
        const visible = await card.isVisible();
        const enabled = await card.isEnabled();

        const styles = await card.evaluate((el) => {
            const s = window.getComputedStyle(el);
            return {
                opacity: s.opacity,
                cursor: s.cursor,
                pointerEvents: s.pointerEvents,
                disabled: (el as HTMLButtonElement).disabled
            };
        });

        console.log(`  Card ${i}: "${text}" visible=${visible}, enabled=${enabled}`);
        console.log(`    Styles: ${JSON.stringify(styles)}`);
    }

    // Try clicking the FIRST card button we find, no matter what
    console.log('\n🎯 ATTEMPTING TO CLICK FIRST CARD...');
    if (cardButtons.length > 0) {
        try {
            await cardButtons[0].click({ force: true, timeout: 5000 });
            console.log('✅ Clicked first card!');
            await page.waitForTimeout(2000);

            // Check if it worked
            const newCardCount = await page.locator('button').filter({ hasText: /[AJKQ910][♥♦♣♠]/ }).count();
            console.log(`Cards after click: ${newCardCount} (was ${cardButtons.length})`);

            await page.screenshot({ path: 'tests/screenshots/after-card-click.png', fullPage: true });
        } catch (e) {
            console.log(`❌ Click failed: ${e.message}`);
        }
    } else {
        console.log('❌ No card buttons found!');
    }

    console.log('\n✅ Test complete\n');
});
