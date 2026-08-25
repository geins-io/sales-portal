import { test as setup, expect } from '@playwright/test';
import { login, hasE2ECredentials, STORAGE_STATE } from './helpers';

/**
 * Authenticates once and persists the session. Per-test login returns 429:
 * `loginRateLimiter` allows 5/minute per IP and every test shares 127.0.0.1.
 * Specs opt in via `test.use({ storageState: STORAGE_STATE })`.
 */
setup('authenticate', async ({ page }) => {
  setup.skip(
    !hasE2ECredentials(),
    'No E2E test account configured (set E2E_USERNAME / E2E_PASSWORD in .env)',
  );

  await login(page);

  // A saved but unauthenticated state fails every dependent spec confusingly.
  const me = await page.request.get('/api/auth/me');
  expect(
    me.ok(),
    `expected /api/auth/me to succeed after login, got HTTP ${me.status()}`,
  ).toBe(true);

  await page.context().storageState({ path: STORAGE_STATE });
});
