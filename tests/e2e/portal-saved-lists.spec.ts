import { test, expect, type Page } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  discoverPurchasableProduct,
  fetchProductCatalogue,
  fetchProductsByAliases,
  isConfigurable,
  readPrice,
  signedInState,
  type ProductListRow,
} from './helpers';
import { apiGet } from './api-call';
import { PAGE_TIMEOUT } from './portal-shared';

/**
 * Portal E2E Tests: saved lists, their total, and the bulk adds (reorder and
 * a list's add-all).
 *
 * The other portal areas have their own portal-*.spec.ts files, so the CI legs
 * can share the portal out. All portal pages require authentication, so the
 * file skips without a test account. Tests handle empty states since the
 * account may have no data.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'portal pages need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

// Per-test login would exceed the 5-per-minute login rate limit.
test.use({ storageState: signedInState });

test.describe('Portal Saved Lists', () => {
  test('should render lists page with create button', async ({ page }) => {
    await page.goto('/se/sv/portal/lists');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Create button
    const createButton = page.locator('[data-testid="saved-lists-create"]');
    await expect(createButton).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Saved lists are entirely client-side (SDK ListsSession in
    // localStorage). On a fresh test browser the user has no lists yet,
    // so the empty state is what should show. No server roundtrip and
    // therefore no loading state.
    const listsEmpty = page.locator('[data-testid="saved-lists-empty"]');
    await expect(listsEmpty).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/**
 * Portal Saved List Total
 *
 * The one total in the portal the app computes itself: the list page reduces
 * over the prices `/api/products/by-aliases` returned and formats the sum once
 * at two decimals. Every other amount in this file arrives finished from the
 * API, so this is the only number that can be wrong through our own
 * arithmetic rather than the platform's.
 *
 * The list under test is built here, through the app's own UI. Saved lists
 * have no server API at all — they live in the browser's localStorage via the
 * SDK's ListsSession (`docs/patterns/lists.md`) — so "a list the account owns"
 * means a list this browser context owns, and the signed-in state the suite
 * restores carries none. The context is thrown away with the test, so nothing
 * is left behind and no two tests can see each other's list.
 */
/**
 * A saved list holding these aliases, created the way a buyer creates one:
 * the portal's create sheet, then the add-to-list dialog on each PDP. The
 * sheet navigates straight to the new list, which is where its id comes from.
 */
async function createListWith(
  page: Page,
  aliases: string[],
  name: string,
): Promise<string> {
  await page.goto('/se/sv/portal/lists');
  await page.waitForLoadState('load');
  await waitForHydration(page);

  await page.locator('[data-testid="saved-lists-create"]').click();
  await page.locator('[data-testid="create-list-name"]').fill(name);
  await page.locator('[data-testid="create-list-submit"]').click();
  await page.waitForURL(/\/portal\/saved-lists\/[\w-]+/, {
    timeout: PAGE_TIMEOUT,
  });
  const listId = new URL(page.url()).pathname.split('/').filter(Boolean).pop();
  expect(listId, `no list id in ${page.url()}`).toBeTruthy();

  for (const alias of aliases) {
    await page.goto(`/p/${alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="pdp-add-to-lists"]');
    await expect(
      trigger,
      'the PDP offers no add-to-list button — the tenant has the wishlist feature off',
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
    await trigger.click();

    const row = page.locator(
      `[data-testid="add-to-list-row"][data-list-id="${listId}"]`,
    );
    await expect(row).toBeVisible({ timeout: PAGE_TIMEOUT });
    await row.click();
    // The dialog writes to localStorage with no request to wait for, so the
    // checkbox state is what says the product reached the list.
    await expect(row.locator('[data-slot="checkbox"]')).toHaveAttribute(
      'data-state',
      'checked',
    );
    await page.locator('[data-testid="add-to-list-done"]').click();
  }

  return listId!;
}

async function openList(page: Page, listId: string) {
  await page.goto(`/se/sv/portal/saved-lists/${listId}`);
  await page.waitForLoadState('load');
  await waitForHydration(page);
  // The products are fetched client-side after the list loads, so the card
  // carrying the total is the signal, not the page load.
  await expect(page.locator('[data-testid="list-loading"]')).toBeHidden({
    timeout: PAGE_TIMEOUT,
  });
  await expect(page.locator('[data-testid="list-total-card"]')).toBeVisible({
    timeout: PAGE_TIMEOUT,
  });
}

test.describe('Portal Saved List Total', () => {
  /** The screen rounds the sum to two decimals; the prices it sums are not rounded. */
  const ROUNDING = 0.005;

  /** Binary floating point puts a tie a hair outside an exactly written tolerance. */
  const SLACK = 1e-9;

  function isUnrounded(value: number): boolean {
    return Math.abs(value * 100 - Math.round(value * 100)) > SLACK;
  }

  /** The sum of prices each rounded to two decimals first. */
  function sumOfRounded(prices: number[]): number {
    return prices.reduce(
      (sum, price) => sum + Math.round(price * 100) / 100,
      0,
    );
  }

  /**
   * Two catalogue products chosen by price, never by alias: both priced in
   * more than two decimals, and the pair must round differently depending on
   * when the rounding happens — 249.504 + 44.904 is 294.41 rounded once and
   * 294.40 rounded twice. A pair without that property would pass a page that
   * rounds every row before adding, which is the defect worth catching.
   */
  async function pickUnroundedPair(page: Page): Promise<ProductListRow[]> {
    const unrounded = (await fetchProductCatalogue(page))
      .filter((row) => isUnrounded(row.exVat))
      .sort((a, b) => b.exVat - a.exVat);
    // The list total leaves a configurable product out, so neither of the
    // two whose sum is read may be one.
    const pair: ProductListRow[] = [];
    for (const row of unrounded) {
      if (pair.length === 2) break;
      if (!(await isConfigurable(page, row.alias))) pair.push(row);
    }
    expect(
      pair.length,
      'fewer than two non-configurable catalogue products are priced in more ' +
        'than two decimals, so a list of them cannot show the difference ' +
        'between rounding each price and rounding the sum',
    ).toBe(2);

    const exact = pair.reduce((sum, row) => sum + row.exVat, 0);
    expect(
      Math.abs(
        Math.round(exact * 100) / 100 - sumOfRounded(pair.map((p) => p.exVat)),
      ),
      `${pair.map((p) => p.exVat).join(' + ')} rounds the same either way, so ` +
        'the pair cannot tell the two implementations apart',
    ).toBeGreaterThan(0);
    return pair;
  }

  async function readListTotal(page: Page): Promise<number> {
    return readPrice(page.locator('[data-testid="list-total-amount"]'));
  }

  test('the list total is the sum of the prices the API returned, in both VAT modes', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal/lists');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const pair = await pickUnroundedPair(page);
    const aliases = pair.map((product) => product.alias);
    const listId = await createListWith(page, aliases, 'Value check');

    await openList(page, listId);

    const api = await fetchProductsByAliases(page, aliases);
    // `by-aliases` drops an alias it cannot resolve instead of failing, and the
    // page sums what came back. Without these two counts a list that quietly
    // lost a member would still match its own smaller sum.
    expect(
      api.length,
      'the products endpoint returned fewer products than the list has members',
    ).toBe(aliases.length);
    expect(await page.locator('[data-testid="list-item-row"]').count()).toBe(
      aliases.length,
    );

    const exSum = api.reduce((sum, product) => sum + product.exVat, 0);
    const incSum = api.reduce((sum, product) => sum + product.incVat, 0);

    // Ex VAT is what the stored session carries (`vat_display=ex`).
    const exTotal = await readListTotal(page);
    expect(Math.abs(exTotal - exSum)).toBeLessThanOrEqual(ROUNDING + SLACK);

    // The half the pair was chosen for: a page that rounded each row before
    // adding would land here instead, and every assertion above would still
    // pass.
    expect(
      Math.abs(exTotal - sumOfRounded(api.map((product) => product.exVat))),
      'the total matches the sum of the rounded prices, so the page rounds ' +
        'before it adds',
    ).toBeGreaterThan(ROUNDING);

    // The toggle is a cookie read during render, so it is set and the page
    // re-rendered rather than clicked.
    await page.context().addCookies([
      {
        name: 'vat_display',
        value: 'inc',
        url: page.url(),
      },
    ]);
    await page.reload();
    await waitForHydration(page);
    await expect(page.locator('[data-testid="list-total-card"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });

    const incTotal = await readListTotal(page);
    expect(Math.abs(incTotal - incSum)).toBeLessThanOrEqual(ROUNDING + SLACK);
    // The deny direction: the toggle must change which field is summed, not
    // merely re-label the same number.
    expect(
      Math.abs(incTotal - exTotal),
      'the inc-VAT total equals the ex-VAT one, so the toggle changed nothing',
    ).toBeGreaterThan(ROUNDING);
  });

  test('the list total follows a row quantity, and the quantity survives a reload', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal/lists');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const aliases = (await pickUnroundedPair(page)).map(
      (product) => product.alias,
    );
    const listId = await createListWith(page, aliases, 'Quantity check');

    await openList(page, listId);

    const api = await fetchProductsByAliases(page, aliases);
    expect(api.length).toBe(aliases.length);
    const [target, other] = api as [(typeof api)[number], (typeof api)[number]];

    const row = page.locator('[data-testid="list-item-row"]').filter({
      has: page.locator(
        `[data-testid="list-item-product-link"][href*="${target.alias}"]`,
      ),
    });
    await expect(row).toHaveCount(1);
    const value = row.locator('[data-testid="qty-value"]');

    const expectTotal = async (qty: number) => {
      const expected = target.exVat * qty + other.exVat;
      await expect
        .poll(async () => Math.abs((await readListTotal(page)) - expected))
        .toBeLessThanOrEqual(ROUNDING + SLACK);
    };

    await row.locator('[data-testid="qty-increment"]').click();
    await row.locator('[data-testid="qty-increment"]').click();
    await expect(value).toHaveText('3');
    await expectTotal(3);

    await row.locator('[data-testid="qty-decrement"]').click();
    await expect(value).toHaveText('2');
    await expectTotal(2);

    // The quantity lives in localStorage beside the list; a reload is what
    // proves it was saved rather than held in the page.
    await page.reload();
    await waitForHydration(page);
    await expect(page.locator('[data-testid="list-total-card"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
    await expect(value).toHaveText('2');
    await expectTotal(2);
  });
});

/**
 * Bulk adds against the real cart
 *
 * "Beställ igen" and a saved list's "Lägg alla i varukorgen" put every row a
 * plain add can take in the cart, and the buyer stays on the page. A row they
 * leave out is counted, and the drawer says so above its lines
 * (app/components/cart/CartSkippedNote.vue). No order on the test account can
 * hold a configured row, so the note for a configured or configurable row is
 * left to the component tests; a product in several SKUs is what this account
 * can leave out. Both tests leave the account's cart as they found it.
 */
test.describe('Portal bulk adds', () => {
  interface DetailRow {
    skuId?: number;
    quantity?: number;
    configuration?: unknown;
    product?: { configurable?: boolean };
  }

  interface CartLine {
    id: string;
    skuId: number;
    quantity: number;
  }

  const ONE_MULTI_SKU_SKIPPED =
    '1 produkt finns i flera typer och lades inte i varukorgen';

  // By SKU, not by line: an add of a SKU the cart already holds is merged into
  // that line, so a line can be there before and still be the one added to.
  function quantityBySku(lines: CartLine[]): Map<number, number> {
    const bySku = new Map<number, number>();
    for (const line of lines) {
      bySku.set(line.skuId, (bySku.get(line.skuId) ?? 0) + line.quantity);
    }
    return bySku;
  }

  async function readCartLines(page: Page): Promise<{
    cartId: string | null;
    lines: CartLine[];
  }> {
    const cartId =
      (await page.context().cookies()).find((c) => c.name === 'cart_id')
        ?.value ?? null;
    if (!cartId) return { cartId, lines: [] };
    const response = await apiGet(page.request, '/api/cart', {
      params: { cartId },
    });
    expect(response.ok(), '/api/cart did not answer 200').toBe(true);
    return { cartId, lines: (await response.json())?.items ?? [] };
  }

  /**
   * Back to the quantities read before, by SKU: a merge into an existing line
   * gives it a new line id, so line ids cannot say which lines a bulk add
   * touched. A SKU that was not there goes, one that was gets its quantity back.
   */
  async function restoreCart(page: Page, before: Map<number, number>) {
    const after = await readCartLines(page);
    for (const line of after.cartId ? after.lines : []) {
      const old = before.get(line.skuId) ?? 0;
      if (old === line.quantity) continue;
      if (old === 0) {
        await page.request.delete('/api/cart/items', {
          params: { cartId: after.cartId!, itemId: line.id },
        });
      } else {
        await page.request.put('/api/cart/items', {
          data: { cartId: after.cartId!, itemId: line.id, quantity: old },
        });
      }
    }
  }

  /** The cart's quantity of each SKU, as an object a failure prints whole. */
  async function quantitiesOf(
    page: Page,
    skus: number[],
  ): Promise<Record<number, number>> {
    const bySku = quantityBySku((await readCartLines(page)).lines);
    return Object.fromEntries(skus.map((sku) => [sku, bySku.get(sku) ?? 0]));
  }

  /** The first catalogue product, alphabetically, sold in several SKUs. */
  async function productWithSeveralSkus(
    page: Page,
  ): Promise<{ alias: string; skuIds: number[] } | undefined> {
    const PAGE_SIZE = 100;
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const response = await apiGet(
        page.request,
        '/api/product-lists/products',
        {
          params: {
            take: String(PAGE_SIZE),
            skip: String(skip),
            filter: JSON.stringify({ sort: 'ALPHABETICAL' }),
          },
        },
      );
      expect(
        response.ok(),
        `${response.url()} answered ${response.status()}`,
      ).toBe(true);
      const products: { alias?: string; skus?: { skuId: number }[] }[] =
        (await response.json()).products ?? [];
      for (const product of products) {
        if (!product.alias || (product.skus?.length ?? 0) < 2) continue;
        if (await isConfigurable(page, product.alias)) continue;
        return {
          alias: product.alias,
          skuIds: product.skus!.map((sku) => sku.skuId),
        };
      }
      if (products.length < PAGE_SIZE) return undefined;
    }
  }

  const ORDERS_TRIED = 5;

  /**
   * The newest order whose every row reorder adds (app/utils/reorder.ts), so
   * the expected cart change is the whole order. Other specs place orders on
   * the account while this runs, so the newest one alone may not be such.
   */
  async function orderOfOrdinaryRows(
    page: Page,
  ): Promise<{ publicId: string; rows: DetailRow[] } | undefined> {
    const listed = await apiGet(page.request, '/api/orders', {
      params: { take: ORDERS_TRIED },
    });
    expect(listed.ok(), '/api/orders did not answer 200').toBe(true);
    const orders: { publicId?: string }[] = (await listed.json())?.orders ?? [];
    for (const { publicId } of orders) {
      if (!publicId) continue;
      const detail = await apiGet(page.request, `/api/orders/${publicId}`);
      if (!detail.ok()) continue;
      const rows: DetailRow[] = (
        (await detail.json())?.order?.cart?.items ?? []
      ).filter((row: DetailRow | null) => row?.skuId);
      const ordinary = (row: DetailRow) =>
        !row.configuration && row.product?.configurable !== true;
      if (rows.length && rows.every(ordinary)) return { publicId, rows };
    }
    return undefined;
  }

  test('reorder adds the order rows to the cart and stays on the order', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal');
    await waitForHydration(page);

    const found = await orderOfOrdinaryRows(page);
    outOfScope(
      !found,
      'fixture-missing',
      `none of the account's ${ORDERS_TRIED} newest orders holds only rows a plain add can take`,
    );
    const { publicId, rows } = found!;

    const added = new Map<number, number>();
    for (const row of rows) {
      added.set(row.skuId!, (added.get(row.skuId!) ?? 0) + (row.quantity ?? 1));
    }

    const before = quantityBySku((await readCartLines(page)).lines);
    const skus = [...added.keys()];
    const expected = Object.fromEntries(
      skus.map((sku) => [sku, (before.get(sku) ?? 0) + added.get(sku)!]),
    );

    try {
      await page.goto(`/se/sv/portal/orders/${publicId}`);
      await waitForHydration(page);
      const button = page.locator('[data-testid="reorder-button"]');
      await button.click();

      await expect
        .poll(() => quantitiesOf(page, skus), {
          message: `reorder of order ${publicId} did not add SKUs ${skus.join(', ')} by their order quantities`,
          timeout: PAGE_TIMEOUT,
        })
        .toEqual(expected);
      await expect(button).toBeEnabled();
      expect(new URL(page.url()).pathname).toBe(
        `/se/sv/portal/orders/${publicId}`,
      );
    } finally {
      await restoreCart(page, before);
    }
  });

  test('a saved list\'s "add all" adds the ordinary product, leaves the one in several SKUs out, and the drawer says so', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal');
    await waitForHydration(page);

    const ordinary = await discoverPurchasableProduct(page);
    const multi = await productWithSeveralSkus(page);
    outOfScope(
      !multi,
      'fixture-missing',
      'no ordinary product in the catalogue is sold in several SKUs',
    );
    const listId = await createListWith(
      page,
      [ordinary.alias, multi!.alias],
      'Add all check',
    );
    await openList(page, listId);
    await expect(page.locator('[data-testid="list-item-row"]')).toHaveCount(2);

    const before = quantityBySku((await readCartLines(page)).lines);
    const skus = [ordinary.skuId, ...multi!.skuIds];

    try {
      await page.locator('[data-testid="add-all-to-cart-btn"]').click();

      // The store sets the count after the add, so the note means it is done.
      await expect(
        page.locator(
          '[data-testid="cart-drawer"] [data-testid="cart-skipped-multi-sku"]',
        ),
      ).toHaveText(ONE_MULTI_SKU_SKIPPED, { timeout: PAGE_TIMEOUT });
      expect(await quantitiesOf(page, skus)).toEqual(
        Object.fromEntries(
          skus.map((sku) => [
            sku,
            (before.get(sku) ?? 0) + (sku === ordinary.skuId ? 1 : 0),
          ]),
        ),
      );
      expect(new URL(page.url()).pathname).toBe(
        `/se/sv/portal/saved-lists/${listId}`,
      );
    } finally {
      await restoreCart(page, before);
    }
  });
});
