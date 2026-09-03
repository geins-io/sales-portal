import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
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
 *   The production-build path (CI, or E2E_PROD=1 locally) is served over
 *   https with a self-signed cert from `infra/scripts/local-cert.sh`
 *   (`pnpm local:setup` runs it). The production build sets
 *   `upgrade-insecure-requests` in its CSP and marks auth cookies Secure, so
 *   over plain http no JavaScript loads and no session survives. The dev
 *   server has neither behaviour and stays http.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const TEST_TENANT_HOST = 'tenant-a.litium.portal';
const TEST_PORT = 3000;

// CI always runs the production build; locally E2E_PROD=1 opts into it.
const PRODUCTION_BUILD = !!(process.env.CI || process.env.E2E_PROD);
const PROTOCOL = PRODUCTION_BUILD ? 'https' : 'http';

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  `${PROTOCOL}://${TEST_TENANT_HOST}:${TEST_PORT}`;

// Nitro's node-server preset serves TLS when NITRO_SSL_CERT / NITRO_SSL_KEY
// hold PEM *contents* (not paths). Read them here so `pnpm preview` started
// by Playwright gets them, locally and in CI alike.
const CERT_DIR = resolve(import.meta.dirname, '.certs');
function tlsEnv(): Record<string, string> {
  if (!PRODUCTION_BUILD) return {};
  const cert = resolve(CERT_DIR, 'local.crt');
  const key = resolve(CERT_DIR, 'local.key');
  if (!existsSync(cert) || !existsSync(key)) {
    throw new Error(
      `Production-build e2e needs a TLS cert at ${CERT_DIR}. ` +
        'Run `infra/scripts/local-cert.sh` (or `pnpm local:setup`) first.',
    );
  }
  return {
    NITRO_SSL_CERT: readFileSync(cert, 'utf8'),
    NITRO_SSL_KEY: readFileSync(key, 'utf8'),
  };
}

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
  // The scope reporter separates out-of-scope / blocked / unknown skips and
  // fails the run on an undeclared one (tests/e2e/reporters/scope-reporter.ts).
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report' }],
        ['github'],
        ['./tests/e2e/reporters/scope-reporter.ts'],
      ]
    : [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
        ['./tests/e2e/reporters/scope-reporter.ts'],
      ],

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

    // The production build is served with a self-signed cert (see above).
    ignoreHTTPSErrors: PRODUCTION_BUILD,

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
    url: `${PROTOCOL}://${TEST_TENANT_HOST}:${TEST_PORT}/api/config`,
    ignoreHTTPSErrors: PRODUCTION_BUILD,
    // E2E=1 disables the dev overlays (see nuxt.config.ts). Only applies when
    // Playwright starts the server — otherwise use `E2E=1 pnpm dev`.
    // The TLS pair makes `pnpm preview` serve https (see tlsEnv above).
    env: { E2E: '1', ...tlsEnv() },
    reuseExistingServer: !process.env.CI,
    // A local production build (E2E_PROD) needs much longer than a dev boot.
    timeout: process.env.E2E_PROD ? 360000 : 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output folder for test artifacts
  outputDir: 'test-results',
});
