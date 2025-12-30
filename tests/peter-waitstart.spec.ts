import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test('Peter - wait for actual game start', async ({ page }) => {
    console.log('\n🎮 PETER - WAITING FOR GAME START\n');

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

    console.log('✅ Setup complete, clicking START...');
    await page.locator('button:has-text("START")').first().click();

    // Wait for game to actually start (look for cards or bidding)
    console.log('⏳ Waiting for game to start (looking for cards or bidding buttons)...');

    let gameStarted = false;
    for (let wait = 0; wait < 30 && !gameStarted; wait++) {
        await page.waitForTimeout(1000);

        const cardCount = await page.locator('[class*="CardComponent"]').count();
        const hasOrderBtn = await page.locator('button:has-text("Order")').isVisible().catch(() => false);
        const hasPassBtn = await page.locator('button:has-text("PASS")').isVisible().catch(() => false);
        const hasSuitBtns = await page.locator('button').filter({ hasText: /[\u2665\u2666\u2663\u2660]/ }).count() > 0;

        console.log(`  ${wait + 1}s: cards=${cardCount}, Order=${hasOrderBtn}, PASS=${hasPassBtn}, Suits=${hasSuitBtns}`);

        if (cardCount > 0 || hasOrderBtn || hasPassBtn || hasSuitBtns) {
            gameStarted = true;
            console.log('\n✅ GAME STARTED!');
            break;
        }
    }

    if (!gameStarted) {
        console.log('\n❌ Game never started after 30 seconds');
        await page.screenshot({ path: 'tests/screenshots/never-started.png', fullPage: true });
        throw new Error('Game did not start');
    }

    // Now play the game
    console.log('\n🎲 PLAYING GAME...\n');

    let gameOver = false;
    let cards = 0, bids = 0, iter = 0;

    while (!gameOver && iter < 150) {
        iter++;
        await page.waitForTimeout(1000);

        if (await page.locator('text=GAME OVER').isVisible().catch(() => false)) {
            gameOver = true;
            break;
        }

        // Bidding first round
        if (await page.locator('button:has-text("Order")').isVisible().catch(() => false) ||
            await page.locator('button:has-text("Pick")').isVisible().catch(() => false)) {
            await page.locator('button:has-text("PASS")').first().click().catch(() => { });
            await page.waitForTimeout(1000);
            bids++;
            continue;
        }

        // Bidding second round - click any suit
        const suits = await page.locator('button').filter({ hasText: /[\u2665\u2666\u2663\u2660]/ }).all();
        if (suits.length > 0) {
            for (const suit of suits) {
                try {
                    await suit.click({ force: true, timeout: 2000 });
                    await page.waitForTimeout(1500);
                    bids++;
                    break;
                } catch (e) { }
            }
            continue;
        }

        // Discard
        if (await page.locator('button:has-text("Discard")').isVisible().catch(() => false)) {
            const allCards = await page.locator('[class*="CardComponent"]').all();
            if (allCards.length > 5) {
                await allCards[allCards.length - 1].click();
                await page.waitForTimeout(300);
                await page.locator('button:has-text("Discard")').click();
                await page.waitForTimeout(1000);
            }
            continue;
        }

        // Play card
        const cardList = await page.locator('[class*="CardComponent"]').all();
        for (const card of cardList) {
            try {
                const ok = await card.evaluate((el) => {
                    const s = window.getComputedStyle(el);
                    return parseFloat(s.opacity) > 0.6 && s.cursor === 'pointer';
                });
                if (ok) {
                    await card.click();
                    await page.waitForTimeout(2000);
                    cards++;
                    break;
                }
            } catch (e) { }
        }

        if (iter % 10 === 0) {
            console.log(`  🔄 ${iter} | Cards: ${cards} | Bids: ${bids}`);
        }
    }

    console.log(`\n⚙️ RESULT: ${gameOver ? '✅ SUCCESS' : '❌ INCOMPLETE'}`);
    console.log(`   Iterations: ${iter}, Cards: ${cards}, Bids: ${bids}\n`);

    if (gameOver) {
        await expect(page.locator('text=GAME OVER')).toBeVisible();
        const w = await page.locator('text=Wins!').textContent().catch(() => '?');
        console.log(`🏆 ${w}\n`);
    } else {
        throw new Error('Game did not complete ');
    }
});
