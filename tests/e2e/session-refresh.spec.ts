import { test, expect, type Page } from '@playwright/test';
import {
  hasE2ECredentials,
  login,
  outOfScope,
  waitForHydration,
} from './helpers';

/**
 * A session whose auth cookie has expired while the refresh cookie is still
 * valid — what the browser holds after 15 idle minutes.
 *
 * Refresh tokens are single use: a second refresh with the same one is
 * refused. The test signs in on its own rather than using the stored session,
 * because rotating that session's refresh token would sign out every spec that
 * shares it. One sign-in per project keeps the run under the login rate limit.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'a refresh needs a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

/** What the browser keeps once the auth cookie has run out. */
async function dropAuthCookie(page: Page) {
  await page.context().clearCookies({ name: 'auth_token' });
}

async function cookieValue(page: Page, name: string) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === name)?.value;
}

async function signedInUser(page: Page) {
  const response = await page.request.get('/api/auth/me');
  expect(response.ok()).toBe(true);
  return (await response.json())?.user ?? null;
}

test.describe('Session refresh', () => {
  test.describe.configure({ timeout: 90000 });

  test('an expired auth cookie next to a valid refresh cookie', async ({
    page,
  }) => {
    const config = await (await page.request.get('/api/config')).json();
    const cmsSlot = config?.cms?.slots?.frontpage_content;

    await login(page);

    for (const round of [1, 2]) {
      await test.step(`page load ${round} keeps the buyer signed in`, async () => {
        await dropAuthCookie(page);
        const before = await cookieValue(page, 'refresh_token');

        await page.goto('/se/sv/portal');
        await page.waitForLoadState('load');
        await waitForHydration(page);

        expect(page.url(), 'sent to login').not.toContain('/login');
        // The rotated pair has to reach the browser on the page response;
        // otherwise it keeps a refresh token Geins has already consumed.
        expect(await cookieValue(page, 'auth_token')).toBeTruthy();
        expect(await cookieValue(page, 'refresh_token')).not.toBe(before);
        expect(await signedInUser(page)).not.toBeNull();
      });
    }

    await test.step('user-scoped reads answer for the buyer', async () => {
      await dropAuthCookie(page);

      const orders = await page.request.get('/api/orders');

      expect(orders.status()).toBe(200);
      expect(Array.isArray((await orders.json())?.orders)).toBe(true);
    });

    await test.step('a CMS area read is private to the buyer', async () => {
      expect(cmsSlot, 'the tenant has no frontpage_content slot').toBeTruthy();
      await dropAuthCookie(page);

      const response = await page.request.get('/api/cms/area', {
        params: { family: cmsSlot.family, areaName: cmsSlot.areaName },
      });

      expect(response.headers()['cache-control']).toBe('private, no-store');
    });

    await test.step('a page request with a session is not publicly cacheable', async () => {
      const response = await page.request.get('/se/sv/portal', {
        headers: { accept: 'text/html' },
      });

      expect(response.headers()['cache-control']).toBe('private, no-store');
    });
  });

  test('an invalid refresh cookie answers SESSION_EXPIRED, which the client redirects on', async ({
    playwright,
    baseURL,
  }) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: 'refresh_token=not-a-refresh-token' },
    });

    const response = await request.get('/api/orders');

    expect(response.status()).toBe(401);
    expect((await response.json())?.data?.code).toBe('SESSION_EXPIRED');
    await request.dispose();
  });
});
