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

/** A pending quotation that needs no confirmation and is not Monitor-linked. */
async function findOrderable(page: Page) {
  for (const listed of await listQuotes(page)) {
    if (listed.status !== 'pending') continue;
    const response = await page.request.get(`/api/quotes/${listed.id}`);
    if (!response.ok()) continue;
    const { quote } = (await response.json()) as {
      quote: Record<string, unknown> & { lineItems: unknown[] };
    };
    if (!quote.requiresConfirmation && !quote.externalReference) return quote;
  }
  return undefined;
}

test.describe('Order from a quotation', () => {
  test('shows the quotation read-only and places the order with the terms accepted', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    const quote = await findOrderable(page);
    outOfScope(
      !quote,
      'fixture-missing',
      'the test account has no pending quotation without confirmation to order from',
    );

    const finalizeCalls: string[] = [];
    await page.route('**/api/quotes/*/finalize', async (route) => {
      finalizeCalls.push(route.request().url());
      await route.fulfill({
        json: { quote: { ...quote, status: 'finalized' } },
      });
    });

    const viewPath = `/se/sv/portal/quotations/${quote!.id}`;
    await page.goto(`${viewPath}/order`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    await expect(page.locator('[data-testid="quote-order-page"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
    // A table from md up, cards below it.
    await expect(
      page.locator(
        '[data-testid="line-item-row"]:visible, [data-testid="line-item-card"]:visible',
      ),
    ).toHaveCount(quote!.lineItems.length);
    await expect(
      page.locator(
        '[data-testid="quote-order-page"] input:not([type="checkbox"])',
      ),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="quote-summary-total"]'),
    ).not.toBeEmpty();
    await expect(
      page.locator('[data-testid="quote-order-payment"]'),
    ).toBeVisible();
    const addresses = page.locator(
      '[data-testid="order-delivery-address"], [data-testid="order-invoice-address"]',
    );
    expect(await addresses.count()).toBeGreaterThan(0);

    const place = page.locator('[data-testid="quote-order-place"]');
    await place.click();
    await expect(
      page.locator('[data-testid="quote-order-terms-required"]'),
    ).toBeVisible();
    expect(finalizeCalls).toHaveLength(0);

    await page.locator('#checkout-terms-checkbox').click();
    await place.click();
    await page.waitForURL(new RegExp(`${viewPath}$`), {
      timeout: PAGE_TIMEOUT,
    });
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0]).toContain(`/api/quotes/${quote!.id}/finalize`);
  });

  test('sends a quotation that cannot be ordered back to the quotation view', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
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
