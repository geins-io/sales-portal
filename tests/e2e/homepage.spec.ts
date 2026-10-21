import { test, expect, isVideoPlayerUrl } from './fixtures';
import { expectNoConsoleErrors, outOfScope } from './helpers';

/**
 * Homepage E2E Tests
 *
 * Tests page structure and navigation. CMS content tests are covered
 * by unit tests — E2E skips them since the Geins API may be
 * unreachable from CI runners.
 */

test.describe('Homepage', () => {
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

  // The fallback, a CMS widget or the page itself supplies it; never none, never two.
  test('should have exactly one h1', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveCount(1);
  });

  // A frame holds the page's `load` event until its document arrives, and
  // `goto` waits for `load`: a slow or failing player stalls the test.
  test('should abort the video player instead of waiting for it', async ({
    page,
  }) => {
    const finished: string[] = [];
    const blocked: string[] = [];
    page.on('requestfinished', (request) => {
      if (isVideoPlayerUrl(request.url())) finished.push(request.url());
    });
    // A provider that times out also fails the request; only the fixture's
    // own abort reads as blocked, in Chromium's wording or WebKit's.
    page.on('requestfailed', (request) => {
      const error = request.failure()?.errorText ?? '';
      if (
        isVideoPlayerUrl(request.url()) &&
        /BLOCKED_BY_CLIENT|Blocked by Web Inspector/.test(error)
      ) {
        blocked.push(request.url());
      }
    });

    await page.goto('/');

    const embeds = await page
      .locator('iframe[src]')
      .evaluateAll((frames) =>
        frames.map((frame) => (frame as HTMLIFrameElement).src),
      );
    const videoEmbeds = embeds.filter(isVideoPlayerUrl);
    outOfScope(
      videoEmbeds.length === 0,
      'tenant-config',
      'the start page has no video widget',
    );

    // WebKit can report a frame's failure after `goto` has resolved.
    await expect
      .poll(() => blocked)
      .toEqual(expect.arrayContaining(videoEmbeds));
    expect(finished).toEqual([]);
  });
});
