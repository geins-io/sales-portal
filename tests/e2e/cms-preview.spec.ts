import { test, expect } from '@playwright/test';
import { discoverCategory, waitForHydration } from './helpers';

test.describe('CMS preview', () => {
  test('exiting preview reloads the localized start page', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForHydration(page);
    const start = new URL(page.url());
    const category = await discoverCategory(page);

    await context.addCookies([
      { name: 'preview_mode', value: 'true', url: start.origin },
    ]);
    await page.goto(`${start.pathname.replace(/\/?$/, '/')}${category.alias}`);
    await waitForHydration(page);
    expect(new URL(page.url()).pathname).not.toBe(start.pathname);

    const banner = page.getByTestId('preview-banner');
    await expect(banner).toBeVisible();

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await banner.getByRole('button').click();

    await page.waitForURL((url) => url.pathname === start.pathname);
    await waitForHydration(page);
    await expect(banner).toBeHidden();
    expect(pageErrors).toEqual([]);
  });
});
