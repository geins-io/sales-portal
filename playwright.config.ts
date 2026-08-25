import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

// Loads E2E_USERNAME / E2E_PASSWORD from the gitignored .env.
// `quiet`: dotenv's banner goes to stdout and corrupts --reporter=json.
dotenv.config({ path: resolve(import.meta.dirname, '.env'), quiet: true });

/**
 * Playwright E2E Test Configuration
 *
 * Run E2E tests with:
 * - pnpm test:e2e         - Run all E2E tests
 * - pnpm test:e2e:ui      - Open Playwright UI
 * - pnpm test:e2e:debug   - Debug tests
 *
 * Prerequisites (local development):
 *   Add to /etc/hosts:
 *     127.0.0.1 tenant-a.litium.portal
 *
 *   Tests use a tenant hostname instead of localhost so the multi-tenant
 *   server plugin can resolve the correct tenant configuration.
 *
 *   Cart and portal specs need a test account (E2E_USERNAME / E2E_PASSWORD
 *   in .env) and skip without one. See docs/testing.md.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const TEST_TENANT_HOST = 'tenant-a.litium.portal';
const TEST_PORT = 3000;

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || `http://${TEST_TENANT_HOST}:${TEST_PORT}`;

// Pre-accepted consent so CookieBanner never renders: it is fixed to the
// bottom (intercepting taps) and carries `role="dialog"` (colliding with every
// sheet a test selects). Key format from `useAnalyticsConsent`.
const CONSENT_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: BASE_URL,
      localStorage: [
        { name: 'analytics-consent-tenant-a', value: '"accepted"' },
      ],
    },
  ],
};

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Fail build on CI if tests are incomplete
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel — CI runners have 2 vCPUs
  workers: process.env.CI ? 2 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['github']]
    : [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Global timeout — extended for real API calls
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Shared settings for all tests
  use: {
    // Base URL for navigation — use tenant hostname for multi-tenant resolution
    baseURL: BASE_URL,

    // Auth specs override this with auth.setup.ts's state, which inherits it.
    storageState: CONSENT_STORAGE_STATE,

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
    // Authenticates once — the login rate limit is 5/minute per IP.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    // WebKit is Safari's engine. Some CSP/nonce defects (e.g. a duplicate
    // nonce attribute on an inline <style>) are tolerated by Chromium but
    // rejected by WebKit, so they are invisible to the Chromium projects.
    // Theme-color regressions must be caught here, against a production build
    // where the CSP is active (CI runs `pnpm preview`; locally use E2E_PROD=1).
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
  ],

  // Local development server.
  // The strict production CSP (and thus the Safari theme-color bug) only exists
  // in a production build, so the webkit regression guard needs `pnpm preview`.
  // CI always builds; locally set E2E_PROD=1 to opt into the production path.
  webServer: {
    command: process.env.CI
      ? 'pnpm preview'
      : process.env.E2E_PROD
        ? 'pnpm build && pnpm preview'
        : 'pnpm dev',
    url: `http://${TEST_TENANT_HOST}:${TEST_PORT}/api/config`,
    // Disables the dev overlays (see nuxt.config.ts). Only applies when
    // Playwright starts the server — otherwise use `E2E=1 pnpm dev`.
    env: { E2E: '1' },
    reuseExistingServer: !process.env.CI,
    // A local production build (E2E_PROD) needs much longer than a dev boot.
    timeout: process.env.E2E_PROD ? 360000 : 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output folder for test artifacts
  outputDir: 'test-results',
});
