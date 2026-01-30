import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Run E2E tests with:
 * - pnpm test:e2e         - Run all E2E tests
 * - pnpm test:e2e:ui      - Open Playwright UI
 * - pnpm test:e2e:debug   - Debug tests
 *
 * IMPORTANT: Requires /etc/hosts entry for tenant hostname resolution:
 *   127.0.0.1 tenant-a.litium.portal
 *
 * This is automatically configured in CI (GitHub Actions).
 * For local development, add the entry manually or run:
 *   echo '127.0.0.1 tenant-a.litium.portal' | sudo tee -a /etc/hosts
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// Default tenant hostname for E2E tests
const TEST_TENANT_HOST = 'tenant-a.litium.portal';
const TEST_PORT = 3000;

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Fail build on CI if tests are incomplete
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['github']]
    : [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Global timeout
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Shared settings for all tests
  use: {
    // Base URL for navigation - use tenant hostname for proper tenant resolution
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      `http://${TEST_TENANT_HOST}:${TEST_PORT}`,

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US',
    },
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment these for more browser coverage in CI
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // Mobile viewport testing
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Local development server
  // Note: The server listens on localhost, but tests access it via the tenant hostname
  // which resolves to 127.0.0.1 via /etc/hosts
  webServer: {
    command: process.env.CI ? 'pnpm preview' : 'pnpm dev',
    url: `http://localhost:${TEST_PORT}`, // Check server readiness on localhost
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes to start the dev server
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output folder for test artifacts
  outputDir: 'test-results',
});
