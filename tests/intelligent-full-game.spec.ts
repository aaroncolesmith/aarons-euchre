import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Complete Euchre Game Playthrough - Peter Playwright', () => {
    // Increase test timeout to 5 minutes for full game
    test.setTimeout(300000);

    test('play through complete euchre game from login to game over', async ({ page }) => {
        console.log('\n🎮 STARTING FULL EUCHRE GAME PLAYTHROUGH\n');
        console.log('═'.repeat(80));

        // ============================================================================
        // STEP 1: LOGIN
        // ============================================================================
        console.log('\n📝 STEP 1: Logging in as peter-playwright...');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        await page.getByPlaceholder('Enter Username').fill('peter-playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        console.log('✅ Successfully logged in\n');

        // ============================================================================
        // STEP 2: CREATE NEW GAME
        // ============================================================================
        console.log('🎲 STEP 2: Creating new game...');
        await page.getByRole('button', { name: /create game/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        console.log('✅ Game created successfully\n');

        // ============================================================================
        // STEP 3: SIT IN SEAT
        // ============================================================================
        console.log('💺 STEP 3: Sitting in seat 0...');
        const sitButtons = page.getByRole('button', { name: /sit here/i });
        await sitButtons.first().click();
        await page.waitForTimeout(500);
        console.log('✅ Seated at position 0\n');

        // ============================================================================
        // STEP 4: ADD BOTS
        // ============================================================================
        console.log('🤖 STEP 4: Adding 3 bots to fill table...');
        for (let i = 0; i < 3; i++) {
            const addBotButtons = page.getByRole('button', { name: /add bot/i });
            const visibleBots = await addBotButtons.all();
            if (visibleBots.length > 0) {
                await visibleBots[0].click();
                await page.waitForTimeout(300);
                console.log(`   ✓ Bot ${i + 1} added`);
            }
        }
        console.log('✅ All bots added successfully\n');

        // ============================================================================
        // STEP 5: START THE MATCH
        // ============================================================================
        console.log('▶️  STEP 5: Starting the match...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);

        const startButton = page.locator('button:has-text("START")').first();
        await startButton.scrollIntoViewIfNeeded();
        await startButton.click();
        await page.waitForTimeout(3000);
        console.log('✅ Match started - game in progress\n');

        // ============================================================================
        // STEP 6: PLAY THROUGH THE GAME
        // ============================================================================
        console.log('🎴 STEP 6: Playing through the euchre game...');
        console.log('─'.repeat(80));

        let actionsCount = 0;
        const maxActions = 300; // Enough for a full game
        let gameOver = false;
        let handsCompleted = 0;
        let tricksPlayed = 0;
        let bidsMade = 0;
        let cardsPlayed = 0;
        let consecutiveNoActions = 0;
        const maxConsecutiveNoActions = 10;

        while (!gameOver && actionsCount < maxActions) {
            const iterationStart = Date.now();
            let actionTaken = false;

            try {
                await page.waitForTimeout(1500);

                // ────────────────────────────────────────────────────────────
                // Check for game over
                // ────────────────────────────────────────────────────────────
                const gameOverText = page.locator('text=GAME OVER');
                if (await gameOverText.isVisible().catch(() => false)) {
                    console.log('\n🏆 GAME OVER DETECTED!');
                    gameOver = true;
                    break;
                }

                // ────────────────────────────────────────────────────────────
                // Handle overlays (trump announcements, etc.)
                // Only dismiss actual game overlays, not UI elements
                // ────────────────────────────────────────────────────────────
                const gameOverlay = page.locator('div').filter({
                    hasText: /trump|called.*trump|wins.*trick|team.*wins|going alone/i
                }).first();

                if (await gameOverlay.isVisible().catch(() => false)) {
                    const overlayText = await gameOverlay.textContent().catch(() => '');
                    // Only click if it's an actual game message, not navigation elements
                    if (overlayText &&
                        overlayText.trim().length > 10 &&
                        overlayText.trim().length < 200 &&
                        !overlayText.includes('TABLE') &&
                        !overlayText.includes('COMMENTARY') &&
                        !overlayText.includes('STATS')) {
                        console.log(`   💬 Game overlay: "${overlayText.substring(0, 60)}"`);
                        await gameOverlay.click().catch(() => { });
                        await page.waitForTimeout(1500);
                        actionTaken = true;
                    }
                }

                if (actionTaken) {
                    actionsCount++;
                    consecutiveNoActions = 0;
                    continue;
                }

                // ────────────────────────────────────────────────────────────
                // Handle bidding - First round (order up / pick it up)
                // ────────────────────────────────────────────────────────────
                const orderUpButton = page.locator('button:has-text("Order")').first();
                const passButton = page.locator('button:has-text("PASS")').first();
                const pickItUpButton = page.locator('button:has-text("Pick")').first();

                if (await orderUpButton.isVisible().catch(() => false) ||
                    await pickItUpButton.isVisible().catch(() => false)) {
                    console.log('   🎯 First round bidding - PASSING');
                    if (await passButton.isVisible().catch(() => false)) {
                        await passButton.click();
                        await page.waitForTimeout(1500);
                        bidsMade++;
                        actionTaken = true;
                    }
                }

                if (actionTaken) {
                    actionsCount++;
                    consecutiveNoActions = 0;
                    continue;
                }

                // ────────────────────────────────────────────────────────────
                // Handle bidding - Second round (suit selection)
                // IMPORTANT: Call trump here to prevent infinite redeal
                // ────────────────────────────────────────────────────────────
                const heartButton = page.locator('button').filter({ hasText: '♥' }).first();
                const diamondButton = page.locator('button').filter({ hasText: '♦' }).first();
                const clubButton = page.locator('button').filter({ hasText: '♣' }).first();
                const spadeButton = page.locator('button').filter({ hasText: '♠' }).first();

                // Check if we're in second round bidding
                if (await heartButton.isVisible().catch(() => false)) {
                    // Call trump! Alternate between suits to ensure game progresses
                    const suitChoice = bidsMade % 4;
                    let chosenSuit = 'hearts';

                    if (suitChoice === 0 && await heartButton.isVisible().catch(() => false)) {
                        chosenSuit = 'hearts';
                        console.log('   🎯 Second round bidding - CALLING HEARTS ♥');
                        await heartButton.click();
                    } else if (suitChoice === 1 && await diamondButton.isVisible().catch(() => false)) {
                        chosenSuit = 'diamonds';
                        console.log('   🎯 Second round bidding - CALLING DIAMONDS ♦');
                        await diamondButton.click();
                    } else if (suitChoice === 2 && await clubButton.isVisible().catch(() => false)) {
                        chosenSuit = 'clubs';
                        console.log('   🎯 Second round bidding - CALLING CLUBS ♣');
                        await clubButton.click();
                    } else if (await spadeButton.isVisible().catch(() => false)) {
                        chosenSuit = 'spades';
                        console.log('   🎯 Second round bidding - CALLING SPADES ♠');
                        await spadeButton.click();
                    } else {
                        // Fallback - just click  hearts
                        console.log('   🎯 Second round bidding - CALLING HEARTS ♥ (fallback)');
                        await heartButton.click();
                    }

                    await page.waitForTimeout(2000);
                    bidsMade++;
                    actionTaken = true;
                }

                if (actionTaken) {
                    actionsCount++;
                    consecutiveNoActions = 0;
                    continue;
                }

                // ────────────────────────────────────────────────────────────
                // Handle discarding (if we're dealer and picked up card)
                // ────────────────────────────────────────────────────────────
                const discardButton = page.locator('button:has-text("Discard")').first();
                if (await discardButton.isVisible().catch(() => false)) {
                    console.log('   🗑️  Discarding weakest card...');
                    const cards = page.locator('[class*="CardComponent"]');
                    const cardCount = await cards.count();

                    if (cardCount > 5) {
                        // Discard last card (typically weakest)
                        await cards.last().click();
                        await page.waitForTimeout(500);
                        await discardButton.click();
                        await page.waitForTimeout(1500);
                        actionTaken = true;
                    }
                }

                if (actionTaken) {
                    actionsCount++;
                    consecutiveNoActions = 0;
                    continue;
                }

                // ────────────────────────────────────────────────────────────
                // Play a card (if it's our turn)
                // ────────────────────────────────────────────────────────────
                const currentHandSize = await page.locator('[class*="CardComponent"]').count();
                const cards = page.locator('[class*="CardComponent"]');
                const cardCount = await cards.count();

                if (cardCount > 0) {
                    for (let i = 0; i < cardCount; i++) {
                        const card = cards.nth(i);

                        try {
                            const isClickable = await card.evaluate((el) => {
                                const style = window.getComputedStyle(el);
                                const opacity = parseFloat(style.opacity);
                                const pointerEvents = style.pointerEvents;
                                const cursor = style.cursor;

                                return opacity > 0.5 &&
                                    pointerEvents !== 'none' &&
                                    cursor === 'pointer';
                            });

                            if (isClickable) {
                                console.log(`   🃏 Playing card ${i + 1}/${cardCount}`);
                                await card.click();
                                await page.waitForTimeout(3000); // Wait for card animation

                                // Check if hand size decreased (card was successfully played)
                                const newHandSize = await page.locator('[class*="CardComponent"]').count();
                                if (newHandSize < currentHandSize) {
                                    cardsPlayed++;
                                    tricksPlayed = Math.floor(cardsPlayed / 4);

                                    // Check if hand completed (no cards left)
                                    if (newHandSize === 0) {
                                        handsCompleted++;
                                        console.log(`   ✨ Hand ${handsCompleted} COMPLETED!`);
                                        await page.waitForTimeout(3000); // Wait for scoring
                                    }

                                    actionTaken = true;
                                }
                                break;
                            }
                        } catch (e) {
                            // Card not available, continue
                        }
                    }
                }

                if (actionTaken) {
                    actionsCount++;
                    consecutiveNoActions = 0;
                } else {
                    consecutiveNoActions++;
                }

                // ────────────────────────────────────────────────────────────
                // Progress reporting every 15 actions
                // ────────────────────────────────────────────────────────────
                if (actionsCount > 0 && actionsCount % 15 === 0) {
                    console.log(`\n   📊 Progress Update:`);
                    console.log(`      • Actions: ${actionsCount}`);
                    console.log(`      • Hands completed: ${handsCompleted}`);
                    console.log(`      • Cards played: ${cardsPlayed}`);
                    console.log(`      • Bids/Passes: ${bidsMade}\n`);
                }

                // ────────────────────────────────────────────────────────────
                // Safety check: if no actions for too long, something is wrong
                // ────────────────────────────────────────────────────────────
                if (consecutiveNoActions >= maxConsecutiveNoActions) {
                    console.log(`\n⚠️  WARNING: No actions taken for ${consecutiveNoActions} iterations`);
                    console.log('   Taking diagnostic screenshot...');
                    await page.screenshot({
                        path: `tests/screenshots/stuck-state-${actionsCount}.png`,
                        fullPage: true
                    });
                    console.log('   Attempting to dismiss any blocking elements...');

                    // Try clicking center of screen to dismiss potential overlays
                    await page.mouse.click(600, 400).catch(() => { });
                    await page.waitForTimeout(1000);
                    consecutiveNoActions = 0;
                }

            } catch (error) {
                console.log(`   ⚠️  Error in game loop: ${error}`);
                await page.screenshot({
                    path: `tests/screenshots/error-state-${actionsCount}.png`,
                    fullPage: true
                });
            }

            // Small delay to prevent overwhelming the page
            await page.waitForTimeout(300);

            actionsCount++;
        }

        console.log('─'.repeat(80));

        // ============================================================================
        // STEP 7: VERIFY GAME COMPLETED SUCCESSFULLY
        // ============================================================================
        console.log('\n🎉 STEP 7: Verifying game completion...\n');

        if (gameOver) {
            // Verify game over screen elements
            await expect(page.locator('text=GAME OVER')).toBeVisible();
            console.log('✅ Game Over screen confirmed');

            // Check for winner
            const winsText = page.locator('text=Wins!');
            if (await winsText.isVisible().catch(() => false)) {
                const winnerElement = await winsText.textContent();
                console.log(`👑 Winner: ${winnerElement}`);
            }

            // Verify game over buttons exist
            const playAgainBtn = page.locator('button:has-text("PLAY AGAIN")');
            const returnBtn = page.locator('button:has-text("RETURN TO LANDING")');

            await expect(playAgainBtn).toBeVisible();
            await expect(returnBtn).toBeVisible();
            console.log('✅ Game over buttons verified');

            // Final statistics
            console.log('\n📊 FINAL GAME STATISTICS:');
            console.log('═'.repeat(80));
            console.log(`   Total Actions Taken:    ${actionsCount}`);
            console.log(`   Hands Completed:        ${handsCompleted}`);
            console.log(`   Cards Played:           ${cardsPlayed}`);
            console.log(`   Bids/Passes Made:       ${bidsMade}`);
            console.log(`   Tricks Played:          ${tricksPlayed}`);
            console.log('═'.repeat(80));

            // Take final screenshot
            await page.screenshot({
                path: 'tests/screenshots/peter-playwright-game-final.png',
                fullPage: true
            });

            console.log('\n✨ GAME COMPLETED SUCCESSFULLY! ✨\n');

        } else {
            // Game did not complete - this is a failure
            console.log(`\n❌ FAILURE: Game did not complete`);
            console.log(`   Actions taken: ${actionsCount} / ${maxActions}`);
            console.log(`   Hands completed: ${handsCompleted}`);
            console.log(`   Cards played: ${cardsPlayed}`);

            await page.screenshot({
                path: 'tests/screenshots/peter-playwright-game-incomplete.png',
                fullPage: true
            });

            throw new Error(`Game did not reach completion after ${actionsCount} actions. Check screenshot for details.`);
        }

        console.log('═'.repeat(80));
    });
});
