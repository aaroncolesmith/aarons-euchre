import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureStep(page: Page, stepName: string, testName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${testName}_${stepName}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    console.log(`📸 [${stepName}] Taking screenshot: ${filename}`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`✅ [${stepName}] Screenshot saved`);
}

test.describe('Landing Page Redesign Validation (iPhone XS)', () => {
    // Configure all tests in this suite to use iPhone XS viewport
    test.use({
        viewport: { width: 375, height: 812 }, // iPhone XS dimensions
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    });

    test('should display all redesigned landing page elements', async ({ page }) => {
        const testName = 'landing_redesign_iphonexs';

        console.log('\n🚀 Starting Landing Page Redesign Validation Test');
        console.log(`📍 Navigating to: ${BASE_URL}`);
        console.log(`📱 Viewport: 375x812 (iPhone XS)`);

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Step 1: Login
        console.log('\n🔐 Step 1: Login as Peter-Playwright');
        await captureStep(page, '01_login', testName);

        const usernameInput = page.getByPlaceholder('Enter Username');
        await usernameInput.fill('Peter-Playwright');
        console.log('✍️  Filled username: Peter-Playwright');

        const loginButton = page.getByRole('button', { name: /login/i });
        await loginButton.click();
        console.log('🖱️  Clicked login button');

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Step 2: Validate Landing Page Elements
        console.log('\n🔍 Step 2: Validating Landing Page Redesign');
        await captureStep(page, '02_landing_page', testName);

        // Check for EUCHRE branding
        console.log('Checking for EUCHRE branding...');
        const euchreBranding = page.locator('h1:has-text("EUCHRE")');
        await expect(euchreBranding).toBeVisible();
        console.log('✅ EUCHRE branding found');

        // Check for authentication text
        console.log('Checking for authentication status...');
        const authText = page.locator('text=/Authenticated:.*Peter-Playwright/i');
        await expect(authText).toBeVisible();
        console.log('✅ Authentication status found');

        // Check for STATS button
        console.log('Checking for STATS button...');
        const statsButton = page.getByRole('button', { name: /^stats$/i });
        await expect(statsButton).toBeVisible();
        console.log('✅ STATS button found');

        // Check for LOGOUT button
        console.log('Checking for LOGOUT button...');
        const logoutButton = page.getByRole('button', { name: /^logout$/i });
        await expect(logoutButton).toBeVisible();
        console.log('✅ LOGOUT button found');

        // Check for CREATE GAME button
        console.log('Checking for CREATE GAME button...');
        const createButton = page.getByRole('button', { name: /create game/i });
        await expect(createButton).toBeVisible();
        console.log('✅ CREATE GAME button found');

        // Check for JOIN TABLE button
        console.log('Checking for JOIN TABLE button...');
        const joinButton = page.getByRole('button', { name: /join table/i });
        await expect(joinButton).toBeVisible();
        console.log('✅ JOIN TABLE button found');

        // Check for footer version
        console.log('Checking for footer version...');
        const footer = page.locator('text=/Euchre Engine.*V2.5/i');
        await expect(footer).toBeVisible();
        console.log('✅ Footer version found');

        await captureStep(page, '03_validation_complete', testName);

        console.log('\n✅ All Landing Page Redesign Elements Validated Successfully!');
    });

    test('should test CREATE GAME flow on mobile', async ({ page }) => {
        const testName = 'create_game_flow_iphonexs';

        console.log('\n🚀 Starting Create Game Flow Test (iPhone XS)');

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Login
        const usernameInput = page.getByPlaceholder('Enter Username');
        await usernameInput.fill('Peter-Playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await captureStep(page, '01_before_create', testName);

        // Click CREATE GAME
        console.log('\n🎮 Clicking CREATE GAME button...');
        const createButton = page.getByRole('button', { name: /create game/i });
        await createButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        await captureStep(page, '02_game_created', testName);

        // Verify we're in a game (check for table tabs)
        console.log('\n🔍 Verifying game was created...');
        const tableTab = page.getByRole('button', { name: /^table$/i });
        await expect(tableTab).toBeVisible();
        console.log('✅ Game created successfully - TABLE tab visible');

        await captureStep(page, '03_final_state', testName);

        console.log('\n✅ Create Game Flow Test Completed!');
    });

    test('should test JOIN TABLE flow on mobile', async ({ page }) => {
        const testName = 'join_table_flow_iphonexs';

        console.log('\n🚀 Starting Join Table Flow Test (iPhone XS)');

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Login
        const usernameInput = page.getByPlaceholder('Enter Username');
        await usernameInput.fill('Peter-Playwright');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await captureStep(page, '01_before_join', testName);

        // Click JOIN TABLE
        console.log('\n🚪 Clicking JOIN TABLE button...');
        const joinButton = page.getByRole('button', { name: /join table/i });
        await joinButton.click();
        await page.waitForTimeout(500);

        await captureStep(page, '02_join_form_shown', testName);

        // Verify join form is displayed
        console.log('\n🔍 Verifying join form...');
        const codeInput = page.getByPlaceholder('000-000');
        await expect(codeInput).toBeVisible();
        console.log('✅ Join form displayed');

        // Verify CANCEL and JOIN buttons
        const cancelButton = page.getByRole('button', { name: /^cancel$/i });
        const joinSubmitButton = page.getByRole('button', { name: /join table/i }).nth(1);
        await expect(cancelButton).toBeVisible();
        await expect(joinSubmitButton).toBeVisible();
        console.log('✅ CANCEL and JOIN buttons visible');

        await captureStep(page, '03_final_state', testName);

        console.log('\n✅ Join Table Flow Test Completed!');
    });
});
