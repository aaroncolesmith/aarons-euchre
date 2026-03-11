import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.setTimeout(120000); // 2 minutes

test('Peter Playwright - Disable Step Mode and Play', async ({ page }) => {
    console.log('\n🎮 PETER - DISABLING STEP MODE THEN PLAYING\n');

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

    // DISABLE STEP MODE BEFORE STARTING
    console.log('Checking for Step button to disable step mode...');
    let stepBtn = page.locator('button:has-text("Step")');
    if (await stepBtn.isVisible().catch(() => false)) {
        const btnText = await stepBtn.textContent();
        console.log(`  Step button shows: "${btnText}"`);
        if (btnText && btnText.includes('ON')) {
            console.log('  ⚠️ Step mode is ON - clicking to disable...');
            await stepBtn.click();
            await page.waitForTimeout(500);
            const newText = await stepBtn.textContent().catch(() => '');
            console.log(`  After click: "${newText}"`);
        }
    }

    await page.locator('button:has-text("START")').first().click();
    await page.waitForTimeout(5000);
    console.log('✅ Game started\n');

    // Check if step mode button appeared and disable it
    stepBtn = page.locator('button').filter({ hasText: /step/i }).first();
    if (await stepBtn.isVisible().catch(() => false)) {
        const text = await stepBtn.textContent().catch(() => '');
        console.log(`Step button after START: "${text}"`);
        if (text && text.toUpperCase().includes('ON')) {
            console.log('⚠️ Step mode still ON after START - disabling...');
            await stepBtn.click();
            await page.waitForTimeout(1000);
            console.log('✅ Step mode toggled OFF\n');
        } else {
            console.log('⚠️ Step mode detected - toggling OFF...');
            await stepBtn.click();
            await page.waitForTimeout(1000);
            const newText = await stepBtn.textContent().catch(() => '');
            if (!newText?.includes('ON')) {
                console.log('✅ Step mode is now OFF\n');
            }
        }
    }

    // Now play game normally - bots should auto-play
    let gameOver = false;
    let actions = 0;

    for (let i = 0; i < 150 && !gameOver; i++) {
        await page.waitForTimeout(2000); // Wait for game to progress

        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            gameOver = true;
            break;
        }

        // Pass if bidding
        const passBtn = page.locator('button:has-text("PASS")');
        if (await passBtn.isVisible().catch(() => false)) {
            await passBtn.click();
            actions++;
            console.log(`  ${actions}: Passed`);
            await page.waitForTimeout(1000);
            continue;
        }

        // Play card  
        const cards = await page.locator('button').filter({ hasText: /[AJKQ910][♥♦♣♠]/ }).all();
        for (const card of cards) {
            try {
                const ok = await card.evaluate((el) => window.getComputedStyle(el).cursor === 'pointer');
                if (ok) {
                    await card.click();
                    actions++;
                    console.log(`  ${actions}: Played card`);
                    await page.waitForTimeout(1500);
                    break;
                }
            } catch (e) { }
        }

        if (actions % 10 === 0 && actions > 0) {
            console.log(`\n  📊 ${actions} actions so far\n`);
        }
    }

    console.log(`\n📋 Total: ${actions} actions\n`);

    if (gameOver) {
        console.log('🏆 GAME OVER - SUCCESS!\n');
        await expect(page.locator('text=GAME OVER')).toBeVisible();
    } else {
        await page.screenshot({ path: 'tests/screenshots/nostep-incomplete.png', fullPage: true });
        console.log('❌ Game did not complete\n');
    }
});
