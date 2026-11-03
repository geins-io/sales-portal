import { test, expect, type Page, type Route } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  signedInState,
} from './helpers';

/**
 * The "Skicka offertförfrågan" page. Sending a request cannot be undone, so
 * every quotation call is answered by the test and never reaches Geins. The
 * quotation is read in the browser after an in-app navigation, which is what
 * lets the test answer the read too.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'quotations need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

const PAGE_TIMEOUT = 20000;
const QUOTE_ID = 'e2e-request-draft';
const LIST_PATH = '/se/sv/portal/quotations';
const VIEW_PATH = `${LIST_PATH}/${QUOTE_ID}`;

function makeQuote(status: string) {
  return {
    id: QUOTE_ID,
    quoteNumber: '2611-2-0099-00',
    createdBy: 'buyer@example.com',
    contactName: 'E2E Buyer',
    contactEmail: 'buyer@example.com',
    status,
    name: 'Spring restock',
    lineItems: [
      {
        productId: 1025,
        sku: '1025-1',
        name: 'E2E Widget',
        articleNumber: 'E2E-1025',
        quantity: 10,
        unitPrice: 43.75,
        unitPriceFormatted: '43,75 kr',
        totalPrice: 437.5,
        totalPriceFormatted: '437,50 kr',
        unitPriceExVat: 35,
        unitPriceExVatFormatted: '35,00 kr',
        totalPriceExVat: 350,
        totalPriceExVatFormatted: '350,00 kr',
      },
    ],
    subtotal: 437.5,
    subtotalFormatted: '437,50 kr',
    tax: 87.5,
    taxFormatted: '87,50 kr',
    shipping: 0,
    shippingFormatted: '',
    total: 437.5,
    totalFormatted: '437,50 kr',
    subtotalExVat: 350,
    subtotalExVatFormatted: '350,00 kr',
    shippingExVat: 0,
    shippingExVatFormatted: '',
    totalExVat: 350,
    totalExVatFormatted: '350,00 kr',
    currency: 'SEK',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
  };
}

interface Calls {
  patch: unknown[];
  release: number;
}

/** Answers the quotation's read, details write and release. */
async function answerQuotation(page: Page, initialStatus: string) {
  const calls: Calls = { patch: [], release: 0 };
  let status = initialStatus;
  await page.route(`**/api/quotes/${QUOTE_ID}**`, async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/request') && request.method() === 'PATCH') {
      calls.patch.push(request.postDataJSON());
      return route.fulfill({ json: { quote: makeQuote(status) } });
    }
    if (path.endsWith('/release') && request.method() === 'POST') {
      calls.release += 1;
      status = 'requested';
      return route.fulfill({ json: { quote: makeQuote(status) } });
    }
    if (request.method() === 'GET') {
      return route.fulfill({ json: { quote: makeQuote(status) } });
    }
    return route.fallback();
  });
  return calls;
}

/** Nothing links to the page yet, so the app's own router takes the buyer there. */
async function openInApp(page: Page, to: string) {
  await page.goto(LIST_PATH);
  await page.waitForLoadState('load');
  await waitForHydration(page);
  await page.evaluate((path) => {
    const app = (
      document.querySelector('#__nuxt') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: { $router: { push: (to: string) => unknown } };
          };
        };
      }
    ).__vue_app__;
    return app.config.globalProperties.$router.push(path);
  }, to);
}

test.describe('Send a quote request', () => {
  test('sends the entered details, then the request, and lands on the quotation', async ({
    page,
  }) => {
    const calls = await answerQuotation(page, 'request_draft');

    await openInApp(page, `${VIEW_PATH}/request`);
    await expect(
      page.locator('[data-testid="quote-request-page"]'),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    await expect(
      page.locator('[data-testid="quote-request-title"]'),
    ).toContainText('Spring restock');
    // A table from md up, cards below it.
    await expect(
      page.locator(
        '[data-testid="line-item-row"]:visible, [data-testid="line-item-card"]:visible',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-testid="quote-articles"] input'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="checkout-goods-label"]'),
    ).toHaveCount(0);
    await expect(page.locator('#checkout-terms-checkbox')).toHaveCount(0);

    const date = new Date();
    date.setDate(date.getDate() + 30);
    const desired = date.toLocaleDateString('en-CA');
    await page
      .locator('[data-testid="checkout-desired-delivery-date"]')
      .fill(desired);
    await page
      .locator('[data-testid="checkout-customer-order-number"]')
      .fill('PO-E2E-77');
    await page
      .locator('[data-testid="quote-request-message"]')
      .fill('Leverans till lager 2');

    await page.locator('[data-testid="place-order-button"]').click();
    await page.waitForURL(new RegExp(`${VIEW_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });

    expect(calls.patch).toEqual([
      {
        desiredDeliveryDate: desired,
        customerReference: 'PO-E2E-77',
        comment: 'Leverans till lager 2',
      },
    ]);
    expect(calls.release).toBe(1);
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });

  test('keeps the request on the page when sending fails', async ({ page }) => {
    await answerQuotation(page, 'request_draft');
    await page.route(`**/api/quotes/${QUOTE_ID}/release`, (route) =>
      route.fulfill({ status: 502, json: { message: 'Bad gateway' } }),
    );

    await openInApp(page, `${VIEW_PATH}/request`);
    await expect(
      page.locator('[data-testid="quote-request-page"]'),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    await page.locator('[data-testid="place-order-button"]').click();
    await expect(
      page.locator('[data-testid="quote-request-error"]'),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${VIEW_PATH}/request$`));
  });

  test('sends a quotation that is not a draft to the quotation view', async ({
    page,
  }) => {
    await answerQuotation(page, 'pending');

    await openInApp(page, `${VIEW_PATH}/request`);
    await page.waitForURL(new RegExp(`${VIEW_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });
});
