import { test, expect } from './fixtures';
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

    // Count errors from the reloaded document only. WebKit reports the leaving
    // document's fetches and imports cut off by the reload (builds/meta, lazy
    // chunks) as page errors, which no visitor sees. `framenavigated` fires on
    // commit, so errors during the new document's hydration still count. The
    // leaving document's own replaceState on pagehide (vue-router) also emits
    // `framenavigated`, so the URL decides which one is the reload.
    let reloaded = false;
    page.on('framenavigated', (frame) => {
      if (
        frame === page.mainFrame() &&
        new URL(frame.url()).pathname === start.pathname
      )
        reloaded = true;
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (reloaded) pageErrors.push(error.message);
    });

    await banner.getByRole('button').click();

    await page.waitForURL((url) => url.pathname === start.pathname);
    await waitForHydration(page);
    await expect(banner).toBeHidden();
    expect(pageErrors).toEqual([]);
  });
});
