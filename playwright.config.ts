import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Euchre game testing
 * 
 * Run tests:
 * - Headless: npm run test
 * - Headed: npm run test:headed
 * - UI Mode: npm run test:ui
 */
export default defineConfig({
    testDir: './tests',

    // Maximum time one test can run
    timeout: 120 * 1000,

    // Run tests in files in parallel
    fullyParallel: false,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Opt out of parallel tests on CI
    workers: process.env.CI ? 1 : 1,

    // Reporter to use
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }]
    ],

    // Shared settings for all the projects below
    use: {
        // Base URL to use in actions like `await page.goto('/')`
        baseURL: process.env.BASE_URL || 'http://localhost:5173',

        // Collect trace when retrying the failed test
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on failure
        video: 'retain-on-failure',

        // Viewport size
        viewport: { width: 1280, height: 720 },

        // Ignore HTTPS errors
        ignoreHTTPSErrors: true,

        // Timeout for each action
        actionTimeout: 15000,

        // Timeout for navigation
        navigationTimeout: 30000,
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Enable console logs
                launchOptions: {
                    args: ['--disable-web-security'],
                },
            },
        },

        // Uncomment to test on Firefox
        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },

        // Uncomment to test on WebKit (Safari)
        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },

        // Uncomment to test on mobile viewports
        // {
        //   name: 'Mobile Chrome',
        //   use: { ...devices['Pixel 5'] },
        // },
        // {
        //   name: 'Mobile Safari',
        //   use: { ...devices['iPhone 12'] },
        // },
    ],

    // Run your local dev server before starting the tests
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
