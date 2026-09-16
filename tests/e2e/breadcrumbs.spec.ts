import { test, expect, type Locator } from '@playwright/test';
import { discoverProduct, waitForHydration } from './helpers';

/**
 * Breadcrumbs E2E Tests
 *
 * The deep trail scrolls sideways with the first crumb pinned, so a focused
 * crumb can be "scrolled into view" and still sit under the pin. The showcase
 * page carries a seven-item trail on every tenant; a discovered product covers
 * whatever depth the real data has.
 */

const WIDTHS = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'desktop', width: 1280, height: 900 },
] as const;

/**
 * Walk `strip` one direction, asserting at every stop that the focused crumb is
 * inside the scrollport and clear of the pin. Backwards is the direction that
 * breaks: forward tabbing aligns crumbs to the right edge, away from the pin, so
 * a forward-only walk passes even with the fix removed.
 */
async function walkCrumbsWithKeyboard(
  strip: Locator,
  direction: 'forward' | 'backward',
  browserName: string,
): Promise<number> {
  const page = strip.page();
  const scroller = strip.locator('[data-testid="breadcrumbs-scroller"]');
  const pin = strip.locator('li').first();

  // Measured on this trail: WebKit stops once with Tab and six times with
  // Alt+Tab, which is what Chromium does with Tab.
  const step = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  const key = direction === 'forward' ? step : `Shift+${step}`;

  const links = strip.locator('a');
  await (direction === 'forward' ? links.first() : links.last()).focus();

  let visited = 0;
  for (let step = 0; step < 40; step++) {
    const stillInside = await strip.evaluate((el) =>
      el.contains(document.activeElement),
    );
    if (!stillInside) break;

    const [focusBox, scrollBox, pinBox] = await Promise.all([
      strip.locator(':focus').boundingBox(),
      scroller.boundingBox(),
      pin.boundingBox(),
    ]);
    expect(focusBox, 'focused crumb has no box').not.toBeNull();
    expect(scrollBox, 'scroll strip has no box').not.toBeNull();
    expect(pinBox, 'pinned crumb has no box').not.toBeNull();

    const crumb = focusBox!;
    const port = scrollBox!;
    const home = pinBox!;
    const isPin = crumb.x < home.x + home.width && crumb.x >= home.x - 1;

    expect(
      crumb.x >= port.x - 1 && crumb.x + crumb.width <= port.x + port.width + 1,
      `${direction}: focused crumb ${Math.round(crumb.x)}..${Math.round(crumb.x + crumb.width)} is outside the scrollport ${Math.round(port.x)}..${Math.round(port.x + port.width)}`,
    ).toBe(true);

    if (!isPin) {
      expect(
        crumb.x >= home.x + home.width - 1,
        `${direction}: focused crumb starts at ${Math.round(crumb.x)}, under the pinned crumb ending at ${Math.round(home.x + home.width)}`,
      ).toBe(true);
    }

    visited++;
    await page.keyboard.press(key);
  }

  return visited;
}

test.describe('Breadcrumbs', () => {
  for (const { label, width, height } of WIDTHS) {
    test(`every crumb of a deep trail is keyboard reachable and clear of the pin (${label})`, async ({
      page,
      browserName,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/elements');
      await waitForHydration(page);

      // The showcase renders three trails; the deep one is the last.
      const deep = page.locator('[data-testid="breadcrumbs"]').last();
      await expect(deep).toBeVisible({ timeout: 15000 });
      await expect(deep.locator('li a, li [aria-current="page"]')).toHaveCount(
        7,
      );

      // Six, not seven: the current page is a crumb but not a link.
      for (const direction of ['forward', 'backward'] as const) {
        const visited = await walkCrumbsWithKeyboard(
          deep,
          direction,
          browserName,
        );
        expect(visited, `crumbs focused walking ${direction}`).toBe(6);
      }
    });
  }

  test('a product trail renders every level with no double separator', async ({
    page,
  }) => {
    const product = await discoverProduct(page);
    await page.goto(`/p/${product.alias}`);
    await waitForHydration(page);

    const strip = page.locator('[data-testid="breadcrumbs"]');
    await expect(strip).toBeVisible({ timeout: 15000 });

    await expect(
      strip.locator('[data-slot="breadcrumb-ellipsis"]'),
    ).toHaveCount(0);

    // One per gap, each inside the crumb it precedes.
    const crumbs = await strip
      .locator('li a, li [aria-current="page"]')
      .count();
    await expect(strip.locator('li svg')).toHaveCount(Math.max(crumbs - 1, 0));
    await expect(
      strip.locator('[data-slot="breadcrumb-separator"]'),
    ).toHaveCount(0);

    // Built by the page, not the strip, and carries the full chain regardless.
    const jsonLdCount = await page.evaluate(() => {
      const scripts = [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ];
      for (const s of scripts) {
        try {
          const parsed: unknown = JSON.parse(s.textContent ?? '');
          const graph: unknown[] = Array.isArray(parsed)
            ? parsed
            : ((parsed as { '@graph'?: unknown[] })['@graph'] ?? [parsed]);
          for (const node of graph) {
            const entry = node as {
              '@type'?: string;
              itemListElement?: unknown[];
            };
            if (entry['@type'] === 'BreadcrumbList') {
              return entry.itemListElement?.length ?? 0;
            }
          }
        } catch {
          // Not every ld+json block on the page is a breadcrumb list.
        }
      }
      return 0;
    });
    expect(jsonLdCount, 'no BreadcrumbList in the structured data').toBe(
      crumbs,
    );
  });
});
