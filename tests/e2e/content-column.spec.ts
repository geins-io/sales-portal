import { test, expect, type Page } from './fixtures';
import {
  discoverCategory,
  hasE2ECredentials,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';

/**
 * Every block's content lines up with the header's content column: the
 * logo's left edge and the cart's right edge. Backgrounds may go full width.
 * Measured on rendered pages, since the column is CSS the unit tier cannot see.
 */

type Edges = { left: number; right: number };

// The header's main row: logo, search, cart.
const HEADER_ROW = 'header .content-column:has([data-slot="search-button"])';

/** The header's content edges: where the logo starts and the row's content ends. */
async function headerColumn(page: Page): Promise<Edges> {
  return contentEdges(page, HEADER_ROW);
}

/** The content box of an element: its border box less its padding. */
async function contentEdges(page: Page, selector: string): Promise<Edges> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        left: box.left + parseFloat(style.paddingLeft),
        right: box.right - parseFloat(style.paddingRight),
      };
    });
}

async function box(page: Page, selector: string): Promise<Edges> {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} has no box`).not.toBeNull();
  return { left: b!.x, right: b!.x + b!.width };
}

function expectEdges(actual: Edges, column: Edges, what: string) {
  expect(
    Math.abs(actual.left - column.left),
    `${what}: left edge`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(actual.right - column.right),
    `${what}: right edge`,
  ).toBeLessThanOrEqual(1);
}

/** Footer rows that render for this tenant, each held to the column. */
async function expectFooterOnColumn(page: Page, column: Edges) {
  let rowsAbove = 0;
  for (const slot of ['footer-top', 'footer-main']) {
    const row = `[data-slot="${slot}"] > .content-column`;
    if (await page.locator(row).count()) {
      rowsAbove++;
      expectEdges(await contentEdges(page, row), column, slot);
    }
  }
  // The rule above the copyright spans the content, not the gutter, and is
  // drawn only when there is a row above it to separate from.
  const rule = '[data-slot="footer-bottom"] > .border-t';
  expectEdges(await box(page, rule), column, 'footer rule');
  await expect(page.locator(rule)).toHaveCSS(
    'border-top-width',
    rowsAbove ? '1px' : '0px',
  );
}

test.describe('content column, wide window', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('top bar, menu bar, banner and footer line up with the header', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);
    const column = await headerColumn(page);
    // 1440 is wider than the column, so this is the column, not the window.
    expect(column.left).toBeGreaterThan(24);

    expect(
      Math.abs(
        (await box(page, `${HEADER_ROW} > :first-child`)).left - column.left,
      ),
      'logo',
    ).toBeLessThanOrEqual(1);
    expectEdges(
      await contentEdges(page, '[data-slot="topbar"] > .content-column'),
      column,
      'top bar',
    );
    // The top bar's background stays full width.
    expect((await box(page, '[data-slot="topbar"]')).left).toBe(0);

    const firstLabel = await page
      .locator('[data-slot="navigation-menu-list"] > *')
      .first()
      .evaluate((item) => {
        const range = document.createRange();
        range.selectNodeContents(item);
        const centred = getComputedStyle(
          item.parentElement!,
        ).justifyContent.includes('center');
        return { left: range.getBoundingClientRect().left, centred };
      });
    if (!firstLabel.centred) {
      expect(
        Math.abs(firstLabel.left - column.left),
        'first menu label under the logo',
      ).toBeLessThanOrEqual(1);
    }

    // A full-width banner's text overlay; a page without one checks nothing here.
    const overlay = '[data-testid="cms-widget"] > .absolute.content-column';
    if (await page.locator(overlay).count()) {
      expectEdges(
        await contentEdges(page, overlay),
        column,
        'full-width banner text',
      );
    }

    await expectFooterOnColumn(page, column);
  });

  test('a category page lines up with the header', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);
    await waitForHydration(page);
    const column = await headerColumn(page);
    expectEdges(
      await contentEdges(page, 'main .content-column'),
      column,
      'category page',
    );
  });

  test.describe('signed in', () => {
    outOfScope(
      !hasE2ECredentials(),
      'no-credentials',
      'Log out and the cart need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
    );
    test.use({ storageState: signedInState });

    test('Log out and the cart end at the column edge, the portal sits in it', async ({
      page,
    }) => {
      await page.goto('/portal');
      await waitForHydration(page);
      const column = await headerColumn(page);

      const logout = await box(page, '[data-testid="topbar-logout"]');
      expect(Math.abs(logout.right - column.right)).toBeLessThanOrEqual(1);
      const cart = page.locator('[data-slot="cart-button"]');
      if (await cart.count()) {
        const cartBox = await box(page, '[data-slot="cart-button"]');
        expect(
          Math.abs(cartBox.right - column.right),
          'cart under Log out',
        ).toBeLessThanOrEqual(1);
        await expect(cart).toHaveCSS('padding-right', '0px');
      }

      expectEdges(
        await contentEdges(
          page,
          '[data-testid="portal-shell"] > .content-column',
        ),
        column,
        'portal',
      );
    });
  });
});

test.describe('content column, phone', () => {
  test('the footer keeps the header gutter, 16 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForHydration(page);
    const column = await headerColumn(page);
    expect(column.left).toBe(16);
    expect(column.right).toBe(390 - 16);
    await expectFooterOnColumn(page, column);
  });
});
