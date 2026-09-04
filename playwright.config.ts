import { defineConfig, devices, type Project } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BASE_URL,
  EXPECTED_TENANT_ID,
  EXTERNAL_SERVER,
  PRODUCTION_BUILD,
} from './tests/e2e/target';

/**
 * Playwright E2E Test Configuration
 *
 * Run E2E tests with:
 * - pnpm test:e2e         - Run all E2E tests
 * - pnpm test:e2e:ui      - Open Playwright UI
 * - pnpm test:e2e:debug   - Debug tests
 *
 * The target comes from the environment (tests/e2e/target.ts). One committed
 * default in every mode: `<tenant>.litium.portal`, which the wildcard resolver
 * sends to 127.0.0.1 and the server looks up under `.litium.store`.
 *   PLAYWRIGHT_BASE_URL     origin under test (default: the team tenant)
 *   E2E_EXPECTED_TENANT_ID  tenant that origin must resolve to
 *   E2E_USERNAME/PASSWORD   test account; auth specs are out of scope without one
 *   E2E_PROD=1              build and test the production build (CI always does)
 *   E2E_EXTERNAL_SERVER=1   the target is already running; start nothing
 *   E2E_REMOTE=1            the target is a deployed environment on purpose
 *
 * Prerequisites (local development): `pnpm local:setup`, for the wildcard
 * resolver. Preflight L0 checks that the target resolves to this machine, so a
 * run cannot quietly test a deployed environment instead.
 *
 * The production build is served over https with a self-signed cert from
 * `infra/scripts/local-cert.sh` (`pnpm local:setup` runs it). It sets
 * `upgrade-insecure-requests` in its CSP and marks auth cookies Secure, so
 * over plain http no JavaScript loads and no session survives. The dev
 * server has neither behaviour and stays http.
 *
 * Preflight: five chained projects run before the browser projects and name
 * the layer that broke — reachability, liveness, identity, delivery,
 * session. Each lists every layer below it as a dependency, so when one
 * fails the scope reporter counts everything above it as blocked by that
 * layer. See docs/testing.md.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// Nitro's node-server preset serves TLS when NITRO_SSL_CERT / NITRO_SSL_KEY
// hold PEM *contents* (not paths). Read them here so `pnpm preview` started
// by Playwright gets them.
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
        {
          name: `analytics-consent-${EXPECTED_TENANT_ID}`,
          value: '"accepted"',
        },
      ],
    },
  ],
};

// Preflight layers, lowest first. Project names double as CI step names.
const PREFLIGHT_LAYERS = [
  { name: 'L0 reachability', file: 'l0-reachability', browser: false },
  { name: 'L1 liveness', file: 'l1-liveness', browser: false },
  { name: 'L2 identity', file: 'l2-identity', browser: false },
  { name: 'L3 delivery', file: 'l3-delivery', browser: true },
  { name: 'L4 session', file: 'l4-session', browser: true },
] as const;

const PREFLIGHT_PROJECT_NAMES = PREFLIGHT_LAYERS.map((l) => l.name);

// The scope reporter reads direct dependencies only, so every layer names
// all the layers below it; the first failed one in the list is the blocker.
const preflightProjects: Project[] = PREFLIGHT_LAYERS.map((layer, index) => ({
  name: layer.name,
  testMatch: new RegExp(`preflight/${layer.file}\\.spec\\.ts$`),
  dependencies: PREFLIGHT_PROJECT_NAMES.slice(0, index),
  ...(layer.browser ? { use: { ...devices['Desktop Chrome'] } } : {}),
}));

const PREFLIGHT_FILES = /preflight\//;

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
    // Base URL for navigation — a tenant hostname, so the server resolves a tenant
    baseURL: BASE_URL,

    // Auth specs override this with the session layer's state, which inherits it.
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

  projects: [
    ...preflightProjects,
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: PREFLIGHT_FILES,
      dependencies: PREFLIGHT_PROJECT_NAMES,
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: PREFLIGHT_FILES,
      dependencies: PREFLIGHT_PROJECT_NAMES,
    },
    // WebKit is Safari's engine. Some CSP/nonce defects (e.g. a duplicate
    // nonce attribute on an inline <style>) are tolerated by Chromium but
    // rejected by WebKit, so they are invisible to the Chromium projects.
    // Theme-color regressions must be caught here, against a production build
    // where the CSP is active (CI runs `pnpm preview`; locally use E2E_PROD=1).
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: PREFLIGHT_FILES,
      dependencies: PREFLIGHT_PROJECT_NAMES,
    },
  ],

  // Local server. CI starts the preview itself (E2E_EXTERNAL_SERVER=1) so the
  // preflight layers can run as separate steps against one server.
  // The strict production CSP (and thus the Safari theme-color bug) only exists
  // in a production build, so the webkit regression guard needs `pnpm preview`.
  webServer: EXTERNAL_SERVER
    ? undefined
    : {
        command: process.env.E2E_PROD
          ? 'pnpm build && pnpm preview'
          : PRODUCTION_BUILD
            ? 'pnpm preview'
            : 'pnpm dev',
        // A static file: it answers 200 whatever the tenant lookup or the
        // dev server's memory check say, and those are preflight's findings.
        url: `${BASE_URL}/favicon.ico`,
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
