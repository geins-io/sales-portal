import { test, expect } from '@playwright/test';
import { login, outOfScope, STORAGE_STATE } from '../helpers';
import { hasE2ECredentials } from '../target';

/**
 * Preflight L4. The configured account signs in. Authenticates once and
 * persists the session: per-test login returns 429 (`loginRateLimiter`
 * allows 5/minute per IP and every test shares 127.0.0.1). Specs opt in via
 * `test.use({ storageState: STORAGE_STATE })`.
 */

test('L4 session: the configured account signs in', async ({ page }) => {
  outOfScope(
    !hasE2ECredentials(),
    'no-credentials',
    'set E2E_USERNAME / E2E_PASSWORD in .env',
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
