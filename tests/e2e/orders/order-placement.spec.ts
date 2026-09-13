import { test, expect, type Page } from '@playwright/test';
import {
  addToCart,
  discoverPurchasableProduct,
  fetchCart,
  fetchOrder,
  outOfScope,
  readPrice,
  waitForHydration,
  STORAGE_STATE,
  type ApiCart,
} from '../helpers';
import { ALLOW_ORDERS_FOR, BASE_URL } from '../target';

/**
 * Order placement — the one spec in this suite that mutates the real backend.
 *
 * Every run places a real order on the tenant under test. Nothing deletes it,
 * and five other specs read the same order list, so this is not a test that can
 * be run casually. Two locks make an accidental order impossible:
 *
 * 1. This folder has its own Playwright project (`orders`), which the chromium,
 *    Mobile Chrome and webkit projects ignore. That protects every invocation
 *    that selects a project by name — which is what ci.yml and e2e-full.yml
 *    both do. It does NOT protect a bare `pnpm test:e2e`, which runs every
 *    project and collects this file: that is why the flag below belongs on the
 *    command line and never in `.env`.
 * 2. `E2E_ALLOW_ORDERS_FOR` carries a tenant *name*, not a boolean, and the
 *    order is placed only when it is exactly equal to the tenant `/api/config`
 *    resolves for the origin under test. `=1` and `=true` match nothing; a
 *    copied `.env` pointed at another tenant names the wrong one.
 *
 * Unset flag: declared out of scope, no order, green. Set but naming a tenant
 * the origin does not resolve to: red, no order — the flag was set deliberately
 * and names the wrong thing, and silence would be a worse answer than showing
 * both names.
 *
 * One order per run, on chromium, with retries pinned to zero on the project: a
 * retry here is a second real order, and `/api/checkout/create-order` rate-limits
 * order creation to 5 per 60 seconds per IP.
 *
 * What this proves is the cart reaching the order intact. It deliberately does
 * not compare the checkout's rendered numbers with the order detail's: each
 * screen is held to its own API, and the two API views are then held to each
 * other. Reading a number off one page and comparing it with another page is
 * how two consistent-looking renderings of one wrong number pass.
 */

outOfScope(
  ALLOW_ORDERS_FOR === '',
  'mutation-gate',
  'E2E_ALLOW_ORDERS_FOR is unset, so this run places no order (set it to the tenant name the target resolves to)',
);

test.use({ storageState: STORAGE_STATE });

/** More than one, or "quantity x unit price" is not a multiplication. */
const QUANTITY = 3;

const PAGE_TIMEOUT = 20000;

/**
 * How long the platform may take to make a placed order readable.
 *
 * Measured 2026-09-13, five orders: 5.2, 7.6, 7.7, 25.6 and 46.7 seconds. The
 * first four were polled every 0.5s from a deployed host and a local dev server
 * at once and agreed within a tenth of a second; the fifth is this spec's own
 * first real run, and it is far outside what the first four suggested.
 *
 * 120s is roughly two and a half times that worst case, and it is the same
 * number the orders page gives the platform before it stops waiting. Two
 * different bounds would disagree about a platform that landed between them —
 * one calling it healthy while the other called it late. Raising it needs new
 * numbers, not a shrug; exceeding it fails the test with the measured wait,
 * which makes a run a measurement of the platform rather than an assumption.
 */
const ORDER_VISIBLE_BUDGET_MS = 120000;

/** Annotation type for the numbers a successful run measured. */
const MEASUREMENT = 'measurement';

function annotate(description: string): void {
  test.info().annotations.push({ type: MEASUREMENT, description });
}

/**
 * The tenant the origin actually resolved, read here rather than taken from
 * `E2E_EXPECTED_TENANT_ID` — that is the tenant the run is configured to
 * expect, which is not the same claim. Preflight L2 ties the two together, but
 * the gate should not rest on the order its dependencies happen to run in.
 */
async function resolvedTenantId(page: Page): Promise<string> {
  const response = await page.request.get('/api/config');
  expect(
    response.ok(),
    `/api/config answered ${response.status()}, so the tenant behind ${BASE_URL} is unknown`,
  ).toBe(true);
  return (await response.json())?.tenantId;
}

/**
 * The status `/api/orders/<publicId>` answers, without asserting it.
 *
 * `expect.poll` does catch a throwing callback and keeps polling, so wrapping
 * `fetchOrder` would work — it would just spend a full `fetchOrder` on every
 * 404 and report the last assertion failure rather than the status. A plain
 * status read says what the wait is actually waiting for; `fetchOrder` runs
 * once, after it is 200.
 */
async function orderStatus(page: Page, publicId: string): Promise<number> {
  return (await page.request.get(`/api/orders/${publicId}`)).status();
}

/** One rendered order line: what the detail page shows for it. */
interface ScreenOrderLine {
  articleNumber: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * The lines the order detail page renders. Desktop only: this project runs
 * chromium at a desktop viewport, where the table is the visible shape and the
 * mobile sheet behind `view-rows-trigger` is not.
 */
async function readOrderLines(page: Page): Promise<ScreenOrderLine[]> {
  const rows = page.locator('[data-testid="order-item-row"]');
  await expect(rows.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

  const lines: ScreenOrderLine[] = [];
  for (let index = 0; index < (await rows.count()); index++) {
    const row = rows.nth(index);
    const quantity = (
      await row.locator('[data-testid="order-item-quantity"]').innerText()
    ).trim();
    lines.push({
      articleNumber: (
        await row
          .locator('[data-testid="order-item-article-number"]')
          .innerText()
      ).trim(),
      quantity: Number(quantity),
      unitPrice: await readPrice(
        row.locator('[data-testid="order-item-unit-price"]'),
      ),
      totalPrice: await readPrice(
        row.locator('[data-testid="order-item-total-price"]'),
      ),
    });
    expect(
      Number.isFinite(lines[index]!.quantity),
      `line ${index} shows no quantity: ${JSON.stringify(quantity)}`,
    ).toBe(true);
  }
  return lines;
}

/** The checkout summary and line, against the cart the API computed. */
async function expectCheckoutMatchesCart(page: Page, cart: ApiCart) {
  // Checkout is pinned to inc-VAT: it reads `sellingPriceIncVatFormatted` and
  // passes `show-vat="true"` to every price, with no `useVatDisplay` in it. So
  // the inc-VAT side of the cart is what must reach this screen.
  expect(
    await readPrice(page.locator('[data-testid="checkout-summary-subtotal"]')),
  ).toBeCloseTo(cart.subTotalIncVat, 2);
  expect(
    await readPrice(page.locator('[data-testid="checkout-summary-total"]')),
  ).toBeCloseTo(cart.totalIncVat, 2);
  expect(
    await readPrice(page.locator('[data-testid="checkout-summary-tax"]')),
  ).toBeCloseTo(cart.vat, 2);

  const line = cart.items[0]!;
  const item = page.locator('[data-testid="checkout-cart-item"]').first();
  const unitPrice = await readPrice(
    item.locator('[data-testid="checkout-unit-price"]'),
  );
  const lineTotal = await readPrice(
    item.locator('[data-testid="checkout-line-total"]'),
  );
  expect(unitPrice).toBeCloseTo(line.unitPriceIncVat, 2);
  expect(lineTotal).toBeCloseTo(line.totalPriceIncVat, 2);
  expect(lineTotal).toBeCloseTo(unitPrice * QUANTITY, 2);
}

test('a placed order carries the cart it was built from all the way to the portal', async ({
  page,
}) => {
  // ---------- The gate ----------

  const tenantId = await resolvedTenantId(page);
  expect(
    tenantId,
    `E2E_ALLOW_ORDERS_FOR names "${ALLOW_ORDERS_FOR}" but ${BASE_URL} resolved to "${tenantId}". ` +
      'Refusing to place a real order on a tenant nobody opted in to.',
  ).toBe(ALLOW_ORDERS_FOR);

  // ---------- 1. A cart with known products and quantities ----------

  const product = await discoverPurchasableProduct(page);
  await addToCart(page, product.alias, QUANTITY);

  // Snapshot before the click: placing the order consumes the cart, so
  // afterwards there is nothing left to compare the order against.
  const cart = await fetchCart(page);
  expect(
    cart.items[0]!.quantity,
    'the cart holds a different quantity than the one this test asked for',
  ).toBe(QUANTITY);
  const cartId = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
  expect(
    cartId,
    'no cart_id cookie, so there is no cart to place',
  ).toBeTruthy();

  // ---------- 2. The screen the buyer commits from ----------

  await page.goto('/checkout');
  await page.waitForLoadState('load');
  await waitForHydration(page);
  await expect(
    page.locator('[data-testid="checkout-order-summary"]'),
    'the custom checkout summary did not render — hosted mode, or /api/checkout failed',
  ).toBeVisible({ timeout: PAGE_TIMEOUT });

  await expectCheckoutMatchesCart(page, cart);

  // ---------- 3. The click ----------

  // The id sits on the checkbox itself; `data-testid="checkout-terms"` is the
  // wrapping div, which is not what needs ticking.
  await page.locator('#checkout-terms-checkbox').click();
  const placeOrder = page.locator('[data-testid="place-order-button"]');
  await expect(placeOrder).toBeEnabled({ timeout: PAGE_TIMEOUT });

  // The response rather than the URL. `checkoutStore.placeOrder` swallows a
  // failure into `error.value` and never throws, so a failed order otherwise
  // looks exactly like a page that did not navigate.
  // Registered before the navigation: the confirmation page fetches the summary
  // as it mounts, and that is the request this run needs to see.
  const summaryResponse = page.waitForResponse(
    (r) => r.url().includes('/api/checkout/summary'),
    { timeout: PAGE_TIMEOUT },
  );

  const [created] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/api/checkout/create-order') &&
        r.request().method() === 'POST',
      { timeout: PAGE_TIMEOUT },
    ),
    placeOrder.click(),
  ]);
  expect(
    created.ok(),
    `POST /api/checkout/create-order answered ${created.status()}`,
  ).toBe(true);

  const { orderId, publicId } = (await created.json()) as {
    orderId?: string;
    publicId?: string;
  };
  expect(publicId, 'create-order returned no publicId').toBeTruthy();
  expect(orderId, 'create-order returned no orderId').toBeTruthy();
  annotate(`placed order ${orderId} (publicId ${publicId})`);

  // ---------- 4. The confirmation page ----------

  await page.waitForURL(/order-confirmation/, { timeout: PAGE_TIMEOUT });
  await waitForHydration(page);

  // The two ids are not carried by the parameters their names suggest:
  // checkout.vue puts the public id in `orderId` and the numeric one in
  // `orderNumber`. A spec that assumes the obvious mapping asserts nothing.
  const query = new URL(page.url()).searchParams;
  expect(query.get('orderId')).toBe(publicId);
  expect(query.get('orderNumber')).toBe(orderId);

  await expect(
    page.locator('[data-testid="order-confirmation-loading"]'),
  ).toBeHidden({
    timeout: PAGE_TIMEOUT,
  });

  // `displayOrderNumber` is `summary?.orderId || props.orderNumber`, and there
  // is no summary (below), so the badge shows the numeric id from the query.
  await expect(page.locator('[data-testid="order-number"]')).toContainText(
    orderId!,
  );

  // This asserts the FALLBACK branch on purpose, rather than declaring the
  // summary out of scope. Both assertions are expected to go red the day
  // `/api/checkout/summary` starts answering — that is the alarm telling whoever
  // fixes it to come back and assert the summary's own numbers here instead.
  //
  // The status, not just the absence: `orderSummary` is null for a 200 with an
  // empty body too, so an absent box alone would keep passing through a partial
  // fix. And the CTA below is the anchor — a missing summary box is trivially
  // true while the page is still a skeleton, so the box is asserted absent only
  // once something on the rendered branch is visible.
  expect(
    (await summaryResponse).status(),
    'the confirmation summary endpoint no longer answers 502, so this spec is asserting the wrong branch',
  ).toBe(502);

  const viewOrder = page.locator('[data-testid="view-order-cta"]');
  await expect(viewOrder).toBeVisible({ timeout: PAGE_TIMEOUT });
  await expect(page.locator('[data-testid="summary-box"]')).toHaveCount(0);

  // ---------- 5. Into the portal ----------

  await viewOrder.click();

  // The link carries the order it just saw created, which is what lets the list
  // wait for that one order instead of rendering without it.
  await page.waitForURL(new RegExp(`/portal/orders\\?awaiting=${publicId}$`), {
    timeout: PAGE_TIMEOUT,
  });
  await waitForHydration(page);

  // ---------- 6. Wait for the platform, on a budget ----------

  const start = Date.now();
  try {
    await expect
      .poll(() => orderStatus(page, publicId!), {
        timeout: ORDER_VISIBLE_BUDGET_MS,
        intervals: [500],
      })
      .toBe(200);
  } catch {
    const waited = ((Date.now() - start) / 1000).toFixed(1);
    throw new Error(
      `order ${orderId} (publicId ${publicId}) was placed but /api/orders/${publicId} ` +
        `did not answer 200 within ${ORDER_VISIBLE_BUDGET_MS / 1000}s (waited ${waited}s). ` +
        'The budget rests on five samples measured 2026-09-13, 5.2s to 46.7s. ' +
        'A larger number here is a finding about the platform, not a flake to retry.',
    );
  }
  const waited = ((Date.now() - start) / 1000).toFixed(1);
  annotate(
    `order readable after ${waited}s (budget ${ORDER_VISIBLE_BUDGET_MS / 1000}s)`,
  );

  const order = await fetchOrder(page, publicId!);

  // ---------- 7. The row arrives on its own ----------

  // There is no `page.reload()` anywhere in this test, deliberately. A reload
  // would step around the defect the rest of this branch fixes and the spec
  // would pass while a buyer still had to reload by hand.
  //
  // The margin is measured from the API poll above, which is why that poll is
  // worth its cost even though it asserts nothing about the page: `page.request`
  // does not use the browser's HTTP cache, so it records when the *platform*
  // made the order readable. Anything after that point is ours. The page polls
  // every 2.5s, so three ticks plus a render is generous for it and still tight
  // enough that a page reaching the order only via the browser's 30s cache
  // window fails here — and fails pointing at us rather than at the platform.
  const SELF_ARRIVAL_MS = 9000;

  // Both list shapes are in the DOM at once and CSS decides which shows; this
  // project runs a desktop viewport, where the row is a `<tr>` carrying the
  // link in its last cell. The link is what pairs the row with the order:
  // the id column shows the numeric id, the detail endpoint keys on publicId.
  const row = page
    .locator('[data-testid="order-row"]:visible')
    .filter({ has: page.locator(`a[href$="/portal/orders/${publicId}"]`) })
    .first();
  await expect(
    row,
    `/api/orders/${publicId} answered 200 after ${waited}s, but the list did not ` +
      `reach the order by itself within ${SELF_ARRIVAL_MS / 1000}s of that. The ` +
      `platform has published it, so the delay is on our side — the waiting poll, ` +
      `or the browser serving it the cached order-less list.`,
  ).toBeVisible({ timeout: SELF_ARRIVAL_MS });

  // The wait cleans up after itself: once the row is there the parameter is
  // gone, so a reload does not start a fresh wait for an order already in hand.
  await expect
    .poll(() => new URL(page.url()).searchParams.has('awaiting'), {
      timeout: 5000,
    })
    .toBe(false);

  expect(
    await readPrice(row.locator('[data-testid="order-total"]')),
  ).toBeCloseTo(order.totalIncVat, 2);

  // ---------- 8. The detail page, against its own API ----------

  await test.step('the order detail page renders what the orders API reports', async () => {
    // Followed rather than typed: the buyer's own route, and it keeps the
    // locale out of the spec — the prefix belongs to the tenant's
    // configuration, and a hardcoded one asserts that configuration by accident.
    await row.locator(`a[href$="/portal/orders/${publicId}"]`).click();
    await page.waitForURL(new RegExp(`/portal/orders/${publicId}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await waitForHydration(page);
    await expect(page.locator('[data-testid="order-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });

    const screenLines = await readOrderLines(page);
    expect(screenLines.length).toBe(order.items.length);
    for (const [index, line] of order.items.entries()) {
      const screen = screenLines[index]!;
      const where = `order line ${index} (article ${line.articleNumber}), rendered on the order detail page`;
      expect(screen.articleNumber, `${where}: wrong article number`).toBe(
        line.articleNumber,
      );
      expect(screen.quantity, `${where}: wrong quantity`).toBe(line.quantity);
      expect(screen.unitPrice, `${where}: wrong unit price`).toBeCloseTo(
        line.unitPriceIncVat,
        2,
      );
      expect(screen.totalPrice, `${where}: wrong line total`).toBeCloseTo(
        line.totalPriceIncVat,
        2,
      );
      // The multiplication itself, on both sides.
      expect(
        screen.totalPrice,
        `${where}: the rendered total is not quantity x unit price`,
      ).toBeCloseTo(screen.unitPrice * screen.quantity, 2);
      expect(
        line.totalPriceIncVat,
        `${where}: the API's own total is not quantity x unit price`,
      ).toBeCloseTo(line.unitPriceIncVat * line.quantity, 2);
    }

    expect(
      await readPrice(page.locator('[data-testid="order-summary-subtotal"]')),
    ).toBeCloseTo(order.subTotalIncVat, 2);
    expect(
      await readPrice(page.locator('[data-testid="order-summary-tax"]')),
    ).toBeCloseTo(order.vat, 2);
    expect(
      await readPrice(page.locator('[data-testid="order-summary-total"]')),
    ).toBeCloseTo(order.totalIncVat, 2);
  });

  // ---------- 9. The two API views against each other ----------

  await test.step('the order carries the same lines and amounts as the cart', async () => {
    // Where product identity is proved. The cart renders ex-VAT by default and
    // the order detail is inc-VAT throughout, so the rendered numbers of the
    // two screens are not comparable — but their APIs are.
    expect(order.items.length).toBe(cart.items.length);

    // Paired on skuId rather than on position: nothing promises the order's
    // lines arrive in the cart's order, and a positional comparison that
    // happened to pass would be asserting the sort, not the amounts.
    const cartBySku = new Map(cart.items.map((line) => [line.skuId, line]));
    for (const line of order.items) {
      const source = cartBySku.get(line.skuId);
      expect(
        source,
        `order line for SKU ${line.skuId} has no matching cart line — the order is not the cart that was placed`,
      ).toBeDefined();
      const where = `SKU ${line.skuId} (article ${line.articleNumber}), order API against cart API`;
      expect(line.articleNumber, `${where}: wrong article number`).toBe(
        source!.articleNumber,
      );
      expect(line.quantity, `${where}: wrong quantity`).toBe(source!.quantity);
      // Line by line, both numbers. Two errors can cancel out in a sum.
      expect(line.unitPriceIncVat, `${where}: wrong unit price`).toBeCloseTo(
        source!.unitPriceIncVat,
        2,
      );
      expect(line.totalPriceIncVat, `${where}: wrong line total`).toBeCloseTo(
        source!.totalPriceIncVat,
        2,
      );
    }
    expect(
      order.totalIncVat,
      "the order's total does not match the cart it was placed from",
    ).toBeCloseTo(cart.totalIncVat, 2);
  });

  // ---------- 10. The buyer's session no longer holds the cart ----------

  // `placeOrder` nulls `cartStore.cartId`, which is a `useCookie` ref, so this
  // is our own code and our own guarantee: the session that placed the order
  // cannot go on shopping in the cart it was built from.
  //
  // What the platform then reports about that cart is deliberately not checked
  // here. Asserting its state would be testing Geins rather than this app, and
  // the answer belongs on its own ticket rather than in a spec about our pages.
  const cartIdAfter = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
  expect(
    cartIdAfter,
    'the cart_id cookie survived the order, so the session still points at the cart that was placed',
  ).toBeUndefined();
});
