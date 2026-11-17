import { test, expect } from './fixtures';
import { discoverCategory, waitForHydration } from './helpers';

/**
 * A token shaped like the Merchant Center's preview token. Geins answers a
 * token it cannot verify with published content, as it answers an expired one.
 */
function placeholderPreviewToken(): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const name = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({
    [name]: 'AdminPreview',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.placeholder`;
}

test.describe('CMS preview', () => {
  test('a preview signs nobody in', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    const start = new URL(page.url());

    await page.goto(
      `/api/auth/preview-enter?loginToken=${placeholderPreviewToken()}&redirect=${encodeURIComponent(start.pathname)}`,
    );
    await page.waitForURL((url) => url.pathname === start.pathname);
    await waitForHydration(page);

    await expect(page.getByTestId('preview-banner')).toBeVisible();
    await expect(page.getByTestId('topbar-login')).toBeVisible();
    await expect(page.getByTestId('topbar-portal')).toHaveCount(0);
  });

  // Merchant Center's link for a page draft carries no `redirect=true`. The
  // status page hands preview-enter its start page as `home`, so a page draft
  // can land on its page; a real draft needs a real token and is proved by hand.
  // A token with no page draft keeps the status page.
  for (const how of ['a full load', 'a client-side navigation'] as const) {
    test(`a link without redirect enters with the start page as home, on ${how}`, async ({
      page,
    }) => {
      await page.goto('/');
      await waitForHydration(page);
      const start = new URL(page.url()).pathname;

      const entries: URL[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/api/auth/preview-enter') entries.push(url);
      });
      const link = `/preview-widgets?loginToken=${placeholderPreviewToken()}`;
      if (how === 'a full load') {
        await page.goto(link);
      } else {
        await page.evaluate((to) => {
          const app = (
            document.querySelector('#__nuxt') as unknown as {
              __vue_app__: {
                config: {
                  globalProperties: { $router: { push(to: string): unknown } };
                };
              };
            }
          ).__vue_app__;
          return app.config.globalProperties.$router.push(to);
        }, link);
      }

      // The locale middleware puts the status page under the start page's prefix.
      await page.waitForURL(
        (url) =>
          url.pathname.endsWith('/preview-widgets') &&
          !url.searchParams.has('loginToken'),
      );
      await expect(
        page.getByRole('heading', { name: 'Preview Mode Active' }),
      ).toBeVisible();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.searchParams.get('redirect')).toBe('/preview-widgets');
      expect(entries[0]!.searchParams.get('home')).toBe(start);
    });
  }

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
