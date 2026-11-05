import { test, expect, type Page } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  signedInState,
} from './helpers';

/**
 * The order-from-quotation page. Placing an order cannot be undone, so the
 * finalize call is answered by the test and never reaches Geins.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'quotations need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

const PAGE_TIMEOUT = 20000;

interface ListedQuote {
  id: string;
  status: string;
}

async function listQuotes(page: Page): Promise<ListedQuote[]> {
  const response = await page.request.get('/api/quotes');
  expect(response.ok(), '/api/quotes did not answer 200').toBe(true);
  return ((await response.json()) as { quotes: ListedQuote[] }).quotes;
}

type FullQuote = Record<string, unknown> & {
  id: string;
  quoteNumber?: string;
  lineItems: unknown[];
  orderDetails?: { customerOrderNumber?: string };
};

/** The first quotation in `status` that is not Monitor-linked and matches. */
async function findQuote(
  page: Page,
  status: string,
  requiresConfirmation: boolean,
): Promise<FullQuote | undefined> {
  for (const listed of await listQuotes(page)) {
    if (listed.status !== status) continue;
    const response = await page.request.get(`/api/quotes/${listed.id}`);
    if (!response.ok()) continue;
    const { quote } = (await response.json()) as { quote: FullQuote };
    if (
      !!quote.requiresConfirmation === requiresConfirmation &&
      !quote.externalReference
    ) {
      return quote;
    }
  }
  return undefined;
}

/** A pending quotation that needs no confirmation and is not Monitor-linked. */
const findOrderable = (page: Page) => findQuote(page, 'pending', false);

/**
 * A real order of the buyer's stands in for the one the finalize would place,
 * so the thank-you page reads a real order by its public id, as a quotation
 * finalized now carries it. Finalize is answered by the test.
 */
async function mockFinalize(page: Page, quote: FullQuote) {
  const ordersResponse = await page.request.get('/api/orders');
  expect(ordersResponse.ok(), '/api/orders did not answer 200').toBe(true);
  const { orders } = (await ordersResponse.json()) as {
    orders: Array<{ id: number | string; publicId?: string | null }>;
  };
  outOfScope(
    !orders.length,
    'fixture-missing',
    'the test account has no order for the thank-you page to read',
  );
  const orderNumber = String(orders[0]!.id);
  const finalized = {
    ...quote,
    status: 'finalized',
    orderId: orderNumber,
    orderPublicId: orders[0]!.publicId ?? undefined,
  };

  const finalizeCalls: Array<{ url: string; body: unknown }> = [];
  await page.route('**/api/quotes/*/finalize', async (route) => {
    finalizeCalls.push({
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({ json: { quote: finalized } });
  });
  return { orderNumber, finalized, finalizeCalls };
}

/** Opens the quotation view and follows its order button to the order page. */
async function openOrderPageFromView(
  page: Page,
  viewPath: string,
  button: string,
) {
  await page.goto(viewPath);
  await page.waitForLoadState('load');
  await waitForHydration(page);
  const link = page.locator(`[data-testid="${button}"]`);
  await expect(link).toBeVisible({ timeout: PAGE_TIMEOUT });
  await link.click();
  await page.waitForURL(new RegExp(`${viewPath}/order$`), {
    timeout: PAGE_TIMEOUT,
  });
  await expect(page.locator('[data-testid="quote-order-page"]')).toBeVisible({
    timeout: PAGE_TIMEOUT,
  });
}

test.describe('Order from a quotation', () => {
  test('"Acceptera och lägg order" opens the quotation read-only and places the order with the terms accepted', async ({
    page,
  }) => {
    const quote = await findOrderable(page);
    outOfScope(
      !quote,
      'fixture-missing',
      'the test account has no pending quotation without confirmation to order from',
    );
    const { orderNumber, finalized, finalizeCalls } = await mockFinalize(
      page,
      quote!,
    );

    const viewPath = `/se/sv/portal/quotations/${quote!.id}`;
    await openOrderPageFromView(page, viewPath, 'accept-btn');

    const orderPage = page.locator('[data-testid="quote-order-page"]');
    // The quotation's lines in the "Artiklar" card: a table from md (768 px)
    // up, cards below it. Only the shape for this viewport is visible.
    const articles = orderPage.locator('[data-testid="quote-articles"]');
    await expect(articles).toBeVisible();
    const wide = (page.viewportSize()?.width ?? 0) >= 768;
    await expect(
      articles.locator(
        wide
          ? '[data-testid="line-item-row"]:visible'
          : '[data-testid="line-item-card"]:visible',
      ),
    ).toHaveCount(quote!.lineItems.length);
    await expect(
      articles.locator(
        wide
          ? '[data-testid="line-item-card"]:visible'
          : '[data-testid="line-item-row"]:visible',
      ),
    ).toHaveCount(0);
    await expect(
      orderPage.locator('[data-testid="checkout-cart-items"]'),
    ).toHaveCount(0);
    await expect(
      orderPage.locator('[data-testid="checkout-company-info"]'),
    ).toBeVisible();
    await expect(
      orderPage.locator('[data-testid="checkout-summary-total"]'),
    ).not.toBeEmpty();
    await expect(
      orderPage.locator('[data-testid="checkout-payment-options"]'),
    ).toBeVisible();
    // Nothing but the message and the terms box can be changed.
    await expect(
      orderPage.locator(
        'input:enabled:not(#checkout-terms-checkbox), textarea:enabled:not(#quote-order-message), select:enabled',
      ),
    ).toHaveCount(0);
    const poNumber = quote!.orderDetails?.customerOrderNumber;
    if (poNumber) {
      await expect(
        orderPage.locator('[data-testid="checkout-customer-order-number"]'),
      ).toHaveValue(poNumber);
    }
    await expect(
      orderPage.locator('[data-testid="checkout-quantity-stepper"]'),
    ).toHaveCount(0);

    const place = page.locator('[data-testid="place-order-button"]');
    await expect(place).toBeDisabled();
    expect(finalizeCalls).toHaveLength(0);

    await page
      .locator('[data-testid="quote-order-message"]')
      .fill('Ring innan leverans');
    await page.locator('#checkout-terms-checkbox').click();
    await expect(place).toBeEnabled();
    // From here on the quotation reads as the order it became.
    await page.route(`**/api/quotes/${quote!.id}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ json: { quote: finalized } });
    });
    await place.click();
    await page.waitForURL(new RegExp(`${viewPath}/ordered$`), {
      timeout: PAGE_TIMEOUT,
    });
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0]!.url).toContain(
      `/api/quotes/${quote!.id}/finalize`,
    );
    expect(finalizeCalls[0]!.body).toEqual({ message: 'Ring innan leverans' });

    const thanks = page.locator('[data-testid="quote-thanks"]');
    await expect(thanks).toHaveAttribute('data-kind', 'order', {
      timeout: PAGE_TIMEOUT,
    });
    await expect(
      page.locator('[data-testid="quote-thanks-number"]'),
    ).toContainText(orderNumber);
    await expect(
      page.locator('[data-testid="quote-thanks-from"]'),
    ).toContainText(String(quote!.quoteNumber));
    await expect(
      page.locator('[data-testid="confirmation-order"]'),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test('"Lägg order" on a confirmed quotation leads through the order page to the order', async ({
    page,
  }) => {
    const quote = await findQuote(page, 'confirmed', true);
    outOfScope(
      !quote,
      'fixture-missing',
      'the test account has no confirmed quotation to order from',
    );
    const { orderNumber, finalized, finalizeCalls } = await mockFinalize(
      page,
      quote!,
    );

    const viewPath = `/se/sv/portal/quotations/${quote!.id}`;
    await openOrderPageFromView(page, viewPath, 'quote-place-order');

    const place = page.locator('[data-testid="place-order-button"]');
    await expect(place).toBeDisabled();
    await page.locator('#checkout-terms-checkbox').click();
    await expect(place).toBeEnabled();
    await page.route(`**/api/quotes/${quote!.id}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ json: { quote: finalized } });
    });
    await place.click();
    await page.waitForURL(new RegExp(`${viewPath}/ordered$`), {
      timeout: PAGE_TIMEOUT,
    });
    expect(finalizeCalls.map((call) => call.url)).toEqual([
      expect.stringContaining(`/api/quotes/${quote!.id}/finalize`),
    ]);
    await expect(
      page.locator('[data-testid="quote-thanks-number"]'),
    ).toContainText(orderNumber, { timeout: PAGE_TIMEOUT });
  });

  test('sends a quotation that is not finalized from the ordered page to the quotation view', async ({
    page,
  }) => {
    const quote = await findOrderable(page);
    outOfScope(
      !quote,
      'fixture-missing',
      'the test account has no pending quotation to open the ordered page on',
    );

    const viewPath = `/se/sv/portal/quotations/${quote!.id}`;
    await page.goto(`${viewPath}/ordered`);
    await page.waitForURL(new RegExp(`${viewPath}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });

  test('sends a quotation that cannot be ordered back to the quotation view', async ({
    page,
  }) => {
    const closed = (await listQuotes(page)).find((quote) =>
      ['finalized', 'rejected', 'canceled', 'expired'].includes(quote.status),
    );
    outOfScope(
      !closed,
      'fixture-missing',
      'the test account has no finalized, rejected, canceled or expired quotation',
    );

    const viewPath = `/se/sv/portal/quotations/${closed!.id}`;
    await page.goto(`${viewPath}/order`);
    await page.waitForURL(new RegExp(`${viewPath}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });
});
