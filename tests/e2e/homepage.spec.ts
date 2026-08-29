import { test, expect } from '@playwright/test';
import { expectNoConsoleErrors, waitForHydration } from './helpers';

/**
 * Homepage E2E Tests
 *
 * Tests page structure and navigation. CMS content tests are covered
 * by unit tests — E2E skips them since the Geins API may be
 * unreachable from CI runners.
 */

test.describe('Homepage', () => {
  // Every other gated spec passes against server-rendered HTML alone, so a
  // build whose JavaScript never loads is invisible to them. This is the one
  // check that fails when the client bundle does not run. It moves into the
  // preflight project (delivery layer) once that exists; until then it lives
  // here so the gated run has it.
  test('should hydrate — client JavaScript runs', async ({ page }) => {
    const scriptFailures: string[] = [];
    page.on('requestfailed', (request) => {
      if (request.url().includes('/_nuxt/')) {
        scriptFailures.push(
          `${request.url()} ${request.failure()?.errorText ?? ''}`,
        );
      }
    });

    await page.goto('/');
    await page.waitForLoadState('load');

    expect(
      scriptFailures,
      'client bundle requests must load (a CSP upgrade over plain http breaks them all)',
    ).toEqual([]);

    // Resolves only once `__vue_app__` is on #__nuxt; throws on timeout, which
    // is the assertion — Vue never mounted.
    await waitForHydration(page);
  });

  test('should load without console errors', async ({ page }) => {
    await expectNoConsoleErrors(page, async () => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    });
  });

  test('should render navigation header with menu links', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    const headerLinks = header.locator('a[href]');
    const count = await headerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should render footer with sections', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const footerLinks = footer.locator('a[href]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
