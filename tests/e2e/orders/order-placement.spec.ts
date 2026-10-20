import { test, expect, type Page } from '../fixtures';
import {
  type ApiOrder,
  addToCart,
  discoverPurchasableProduct,
  fetchCart,
  fetchOrder,
  noteOutOfScope,
  outOfScope,
  readPrice,
  setVatDisplay,
  waitForHydration,
  signedInState,
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
 * Where the target can configure, the cart also holds a configured line, so the
 * order proves that a configured line keeps the price it was committed at all
 * the way into the order. A line that loses its configuration on the way also
 * loses that price (2 711,08 kr ex VAT became 777,00 kr ex VAT when the
 * checkout still ran on an endpoint that drops it), so the frozen price is the
 * proof.
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

test.use({ storageState: signedInState });

/** More than one, or "quantity x unit price" is not a multiplication. */
const QUANTITY = 3;

const PAGE_TIMEOUT = 20000;

/**
 * The configured line, per tenant `/api/config` resolves to. Named rather than
 * discovered: the product is left out of the product lists that discovery
 * reads, and it is valid as created, so it commits without a choice. 1652 is
 * its only SKU (both measured 2026-10-02). A tenant without an entry places
 * the plain line alone.
 */
const CONFIGURED_LINES: Record<string, { productId: string; skuId: number }> = {
  monitor: { productId: '1359', skuId: 1652 },
};

/** A configured line in the cart, and the price its commit froze. */
interface ConfiguredLine {
  skuId: number;
  quantity: number;
  unitPriceIncVat: number;
}

/**
 * How long the platform may take to make a placed order readable.
 *
 * Measured 2026-09-13, five orders: 5.2, 7.6, 7.7, 25.6 and 46.7 seconds. The
 * first four were polled every 0.5s from a deployed host and a local dev server
 * at once and agreed within a tenth of a second; the fifth is this spec's own
 * first real run, and it is far outside what the first four suggested.
 *
 * 120s is roughly two and a half times that worst case, and it is the same
 * number the confirmation and order pages give the platform before they stop
 * waiting (`useAwaitedOrder`). Two
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
 * The lines the order table renders, on the order page and the confirmation
 * alike. Desktop only: this project runs chromium at a desktop viewport, where
 * the table is the visible shape and the mobile sheet behind
 * `view-rows-trigger` is not.
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

/**
 * Commits the tenant's configured product and adds it to the cart through the
 * portal's own routes, as the configurator page's action does. `null`, with
 * the reason declared, where the tenant names no configured product.
 */
async function addConfiguredLine(
  page: Page,
  tenantId: string,
  cartId: string,
): Promise<ConfiguredLine | null> {
  const named = CONFIGURED_LINES[tenantId];
  if (!named) {
    noteOutOfScope(
      'tenant-config',
      `no configurable product is named for tenant "${tenantId}", so the order holds the plain line alone`,
    );
    return null;
  }

  const created = await page.request.post('/api/configurations', {
    data: { productId: named.productId, quantity: 1 },
  });
  expect(
    created.ok(),
    `POST /api/configurations answered ${created.status()} for product ${named.productId}, which tenant "${tenantId}" names as configurable`,
  ).toBe(true);
  const session = (await created.json()) as {
    configurationId: string;
    isValid: boolean;
  };
  expect(
    session.isValid,
    `product ${named.productId} is no longer valid as created, so it cannot be committed without choices`,
  ).toBe(true);

  const committed = await page.request.post(
    `/api/configurations/${session.configurationId}/commit`,
  );
  expect(committed.ok(), `the commit answered ${committed.status()}`).toBe(
    true,
  );
  const commit = (await committed.json()) as {
    committedConfigurationId: string;
    quantity: number;
    unitPrice: { sellingPriceIncVat: number };
  };

  const added = await page.request.post(
    `/api/configurations/${commit.committedConfigurationId}/cart`,
    { data: { cartId, skuId: named.skuId, quantity: commit.quantity } },
  );
  expect(added.ok(), `the configured add answered ${added.status()}`).toBe(
    true,
  );

  annotate(
    `configured line: product ${named.productId}, committed ${commit.committedConfigurationId} at ${commit.unitPrice.sellingPriceIncVat} inc VAT`,
  );
  return {
    skuId: named.skuId,
    quantity: commit.quantity,
    unitPriceIncVat: commit.unitPrice.sellingPriceIncVat,
  };
}

/**
 * One order, as both the confirmation and the order detail page render it:
 * the same components, so the same reading and the same checks. Read on the
 * ex side, as step 1 sets it.
 */
async function expectOrderMatchesApi(
  page: Page,
  order: ApiOrder,
  surface: string,
): Promise<void> {
  const screenLines = await readOrderLines(page);
  expect(screenLines.length).toBe(order.items.length);
  for (const [index, line] of order.items.entries()) {
    const screen = screenLines[index]!;
    const where = `order line ${index} (article ${line.articleNumber}), rendered on the ${surface}`;
    expect(screen.articleNumber, `${where}: wrong article number`).toBe(
      line.articleNumber,
    );
    expect(screen.quantity, `${where}: wrong quantity`).toBe(line.quantity);
    expect(screen.unitPrice, `${where}: wrong unit price`).toBeCloseTo(
      line.unitPriceExVat,
      2,
    );
    expect(screen.totalPrice, `${where}: wrong line total`).toBeCloseTo(
      line.totalPriceExVat,
      2,
    );
    // The multiplication itself, on both sides.
    expect(
      screen.totalPrice,
      `${where}: the rendered total is not quantity x unit price`,
    ).toBeCloseTo(screen.unitPrice * screen.quantity, 2);
    expect(
      line.totalPriceExVat,
      `${where}: the API's own total is not quantity x unit price`,
    ).toBeCloseTo(line.unitPriceExVat * line.quantity, 2);
  }

  expect(
    await readPrice(page.locator('[data-testid="order-summary-subtotal"]')),
  ).toBeCloseTo(order.subTotalExVat, 2);
  expect(
    await readPrice(page.locator('[data-testid="order-summary-tax"]')),
  ).toBeCloseTo(order.vat, 2);
  expect(
    await readPrice(page.locator('[data-testid="order-summary-total"]')),
  ).toBeCloseTo(order.totalExVat, 2);
  expect(
    await readPrice(
      page.locator('[data-testid="order-summary-total-inc-vat"]'),
    ),
    `${surface}: the inc-VAT line under the total`,
  ).toBeCloseTo(order.totalIncVat, 2);
}

/**
 * The checkout summary and lines, against the cart the API computed. A
 * configured line shows its line total only, as in the cart.
 */
async function expectCheckoutMatchesCart(
  page: Page,
  cart: ApiCart,
  configured: ConfiguredLine | null,
) {
  // The test runs on the ex-VAT side (set at its start), so that is the side
  // of the cart that must reach this screen.
  expect(
    await readPrice(page.locator('[data-testid="checkout-summary-subtotal"]')),
  ).toBeCloseTo(cart.subTotalExVat, 2);
  expect(
    await readPrice(page.locator('[data-testid="checkout-summary-total"]')),
  ).toBeCloseTo(cart.totalExVat, 2);
  expect(
    await readPrice(page.locator('[data-testid="checkout-summary-tax"]')),
  ).toBeCloseTo(cart.vat, 2);

  // Paired on position: the checkout renders the cart's own lines in the
  // cart's order, and its rows carry nothing that names a SKU.
  const rows = page.locator('[data-testid="checkout-cart-item"]');
  await expect(rows).toHaveCount(cart.items.length);
  for (const [index, line] of cart.items.entries()) {
    const item = rows.nth(index);
    const where = `checkout row ${index} (SKU ${line.skuId})`;
    const lineTotal = await readPrice(
      item.locator('[data-testid="checkout-line-total"]'),
    );
    expect(lineTotal, `${where}: line total`).toBeCloseTo(
      line.totalPriceExVat,
      2,
    );
    if (line.skuId === configured?.skuId) {
      await expect(
        item.locator('[data-testid="checkout-unit-price"]'),
        `${where}: a configured line shows no unit price`,
      ).toHaveCount(0);
      expect(lineTotal, `${where}: not quantity x unit price`).toBeCloseTo(
        line.unitPriceExVat * line.quantity,
        2,
      );
      continue;
    }
    const unitPrice = await readPrice(
      item.locator('[data-testid="checkout-unit-price"]'),
    );
    expect(unitPrice, `${where}: unit price`).toBeCloseTo(
      line.unitPriceExVat,
      2,
    );
    expect(lineTotal, `${where}: not quantity x unit price`).toBeCloseTo(
      unitPrice * line.quantity,
      2,
    );
  }
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

  // Every screen below is read on this side.
  await setVatDisplay(page, 'ex');
  const product = await discoverPurchasableProduct(page, QUANTITY);
  await addToCart(page, product.alias, QUANTITY);
  const cartId = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
  expect(
    cartId,
    'no cart_id cookie, so there is no cart to place',
  ).toBeTruthy();

  // Last, so no later cart write stands between the configured line and the
  // checkout.
  const configured = await addConfiguredLine(page, tenantId, cartId!);

  // Snapshot before the click: placing the order consumes the cart, so
  // afterwards there is nothing left to compare the order against.
  const cart = await fetchCart(page);
  const plainLine = cart.items.find((line) => line.skuId === product.skuId);
  expect(
    plainLine?.quantity,
    'the cart holds a different quantity than the one this test asked for',
  ).toBe(QUANTITY);
  expect(
    cart.items.length,
    'the cart holds other lines than the ones this test added',
  ).toBe(configured ? 2 : 1);
  if (configured) {
    const line = cart.items.find((item) => item.skuId === configured.skuId);
    expect(
      line?.unitPriceIncVat,
      'the cart does not hold the configured line at the price its commit froze',
    ).toBeCloseTo(configured.unitPriceIncVat, 2);
  }

  // ---------- 2. The screen the buyer commits from ----------

  await page.goto('/checkout');
  await page.waitForLoadState('load');
  await waitForHydration(page);
  await expect(
    page.locator('[data-testid="checkout-order-summary"]'),
    'the custom checkout summary did not render — hosted mode, or /api/checkout failed',
  ).toBeVisible({ timeout: PAGE_TIMEOUT });

  await expectCheckoutMatchesCart(page, cart, configured);

  // ---------- 3. The click ----------

  // The id sits on the checkbox itself; `data-testid="checkout-terms"` is the
  // wrapping div, which is not what needs ticking.
  await page.locator('#checkout-terms-checkbox').click();
  const placeOrder = page.locator('[data-testid="place-order-button"]');
  await expect(placeOrder).toBeEnabled({ timeout: PAGE_TIMEOUT });

  // The response rather than the URL. `checkoutStore.placeOrder` swallows a
  // failure into `error.value` and never throws, so a failed order otherwise
  // looks exactly like a page that did not navigate.
  // Registered before the navigation, so a summary request fired as the
  // confirmation page mounts is counted too. The in-app confirmation reads the
  // order instead: Geins's checkout summary never carries an order placed here.
  const summaryRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/checkout/summary')) {
      summaryRequests.push(request.url());
    }
  });

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

  // ---------- 4. The confirmation page, before the order is readable ----------

  await page.waitForURL(/order-confirmation/, { timeout: PAGE_TIMEOUT });
  await waitForHydration(page);

  // The two ids are not carried by the parameters their names suggest:
  // checkout.vue puts the public id in `orderId` and the numeric one in
  // `orderNumber`. A spec that assumes the obvious mapping asserts nothing.
  const query = new URL(page.url()).searchParams;
  expect(query.get('orderId')).toBe(publicId);
  expect(query.get('orderNumber')).toBe(orderId);

  // At once, from the URL alone: nothing here waits for the platform.
  await expect(page.locator('[data-testid="order-number"]')).toContainText(
    orderId!,
    { timeout: PAGE_TIMEOUT },
  );
  const viewOrder = page.locator('[data-testid="view-order-cta"]');
  await expect(viewOrder).toBeVisible({ timeout: PAGE_TIMEOUT });
  const viewOrderHref = await viewOrder.getAttribute('href');
  expect(viewOrderHref).toMatch(
    new RegExp(`/portal/orders/${publicId}\\?awaiting=${publicId}$`),
  );

  // ---------- 5. The order page's wait, on the same order ----------

  // Opened at once, so it most likely arrives before the platform has the
  // order and has to wait for it. "Most likely": the platform's 5 s minimum
  // makes it a race, so whether it actually waited is recorded, not asserted.
  // Read from the page, not the network: the first read happens in the server
  // render, which the browser never sees.
  const early = await page.context().newPage();
  await early.goto(viewOrderHref!);
  await waitForHydration(early);
  const earlyWaited = await early
    .locator('[data-testid="order-loading"]')
    .isVisible();
  annotate(
    earlyWaited
      ? 'order page opened at once was waiting for the order'
      : 'order page opened at once already had the order',
  );

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

  // ---------- 7. Both pages reach the order by themselves ----------

  // There is no `page.reload()` anywhere in this test, deliberately: a reload
  // would step around the wait and the spec would pass while a buyer still had
  // to reload by hand.
  //
  // The margin is measured from the API poll above: `page.request` does not use
  // the browser's HTTP cache, so it records when the *platform* made the order
  // readable, and anything after that point is ours. The pages poll every 2.5s,
  // so three ticks plus a render is generous and still tight enough that a page
  // reaching the order only via the browser's 30s cache window fails here.
  const SELF_ARRIVAL_MS = 9000;
  const ours =
    `/api/orders/${publicId} answered 200 after ${waited}s, so the platform ` +
    'has published it and the delay is on our side — the waiting poll, or the ' +
    'browser serving the cached 404.';

  await expect(
    page.locator('[data-testid="confirmation-order"]'),
    `the confirmation did not show the order within ${SELF_ARRIVAL_MS / 1000}s. ${ours}`,
  ).toBeVisible({ timeout: SELF_ARRIVAL_MS });
  await expect(
    page.locator('[data-testid="confirmation-order-loading"]'),
    'the waiting indicator stayed after the order rendered',
  ).toHaveCount(0);
  expect(
    summaryRequests,
    'the in-app confirmation asked for the checkout summary',
  ).toEqual([]);

  await test.step('the confirmation renders what the orders API reports', async () => {
    await expectOrderMatchesApi(page, order, 'confirmation');
  });

  await expect(
    early.locator('[data-testid="order-detail"]'),
    `the order page opened at once did not show the order within ${SELF_ARRIVAL_MS / 1000}s. ${ours}`,
  ).toBeVisible({ timeout: SELF_ARRIVAL_MS });
  // The wait cleans up after itself, so a reload starts no fresh wait.
  await expect
    .poll(() => new URL(early.url()).searchParams.has('awaiting'), {
      timeout: 5000,
    })
    .toBe(false);
  await early.close();

  // Now readable: the buyer's own click lands on a page that has the order on
  // its first response, and drops the parameter all the same.
  await viewOrder.click();
  await page.waitForURL(new RegExp(`/portal/orders/${publicId}(\\?|$)`), {
    timeout: PAGE_TIMEOUT,
  });
  await waitForHydration(page);
  await expect(page.locator('[data-testid="order-detail"]')).toBeVisible({
    timeout: PAGE_TIMEOUT,
  });
  await expect
    .poll(() => new URL(page.url()).searchParams.has('awaiting'), {
      timeout: 5000,
    })
    .toBe(false);

  // ---------- 8. The detail page, against its own API ----------

  await test.step('the order detail page renders what the orders API reports', async () => {
    await expectOrderMatchesApi(page, order, 'order detail page');
  });

  // ---------- 8b. The list, from the order's own back link ----------

  await test.step('the order list carries the order and its total', async () => {
    await page.locator('[data-testid="back-link"]').click();
    await page.waitForURL(/\/portal\/orders(\?|$)/, { timeout: PAGE_TIMEOUT });
    await waitForHydration(page);

    // Both list shapes are in the DOM at once and CSS decides which shows; this
    // project runs a desktop viewport, where the row is a `<tr>` carrying the
    // link in its last cell. The link is what pairs the row with the order:
    // the id column shows the numeric id, the detail endpoint keys on publicId.
    const row = page
      .locator('[data-testid="order-row"]:visible')
      .filter({ has: page.locator(`a[href$="/portal/orders/${publicId}"]`) })
      .first();
    await expect(row).toBeVisible({ timeout: PAGE_TIMEOUT });
    expect(
      await readPrice(row.locator('[data-testid="order-total"]')),
    ).toBeCloseTo(order.totalExVat, 2);
  });

  // ---------- 9. The two API views against each other ----------

  await test.step('the order carries the same lines and amounts as the cart', async () => {
    // Where product identity is proved, on the APIs rather than the screens:
    // the screens above were each held to their own API already.
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

  // ---------- 10. The configured line kept its configuration ----------

  if (configured) {
    await test.step('the configured line reaches the order at the price its commit froze', async () => {
      // Against the commit, not the cart: step 9 holds the order to the cart,
      // and a cart that had already lost the configuration would agree with
      // an order that lost it too.
      const line = order.items.find((item) => item.skuId === configured.skuId);
      expect(line, 'the order holds no configured line').toBeDefined();
      expect(line!.quantity).toBe(configured.quantity);
      expect(
        line!.unitPriceIncVat,
        'the configured line reached the order at another price than its commit froze, so it lost its configuration on the way',
      ).toBeCloseTo(configured.unitPriceIncVat, 2);
    });
  }

  // ---------- 11. The buyer's session no longer holds the cart ----------

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
