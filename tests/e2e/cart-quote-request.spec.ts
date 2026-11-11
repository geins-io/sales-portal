import { test, expect, type Locator, type Page, type Route } from './fixtures';
import {
  addToCart,
  discoverPurchasableProduct,
  fetchCart,
  hasE2ECredentials,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';

/**
 * The cart's "Skapa offertförfrågan av varukorgen", confirmed in a dialog. The
 * create call and the list of the buyer's quotations are answered by the test,
 * so no run leaves a draft in Geins and the name does not depend on drafts
 * made earlier today; the cart itself is real. The answer clears no cookie, so
 * a new cart after the click can only come from the client letting its cart go.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'quote requests need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

const PAGE_TIMEOUT = 20000;
const QUOTE_ID = 'e2e-cart-request';

function makeQuote(name: string) {
  return {
    id: QUOTE_ID,
    quoteNumber: '2611-2-0098-00',
    createdBy: 'buyer@example.com',
    contactName: 'E2E Buyer',
    contactEmail: 'buyer@example.com',
    status: 'request_draft',
    name,
    lineItems: [
      {
        productId: 1025,
        id: 'e2e-line-1025',
        skuId: 1025,
        name: 'E2E Widget',
        articleNumber: 'E2E-1025',
        quantity: 1,
        unitPrice: 50,
        unitPriceFormatted: '50,00 kr',
        totalPrice: 50,
        totalPriceFormatted: '50,00 kr',
        unitPriceExVat: 40,
        unitPriceExVatFormatted: '40,00 kr',
        totalPriceExVat: 40,
        totalPriceExVatFormatted: '40,00 kr',
      },
    ],
    subtotal: 50,
    subtotalFormatted: '50,00 kr',
    tax: 10,
    taxFormatted: '10,00 kr',
    shipping: 0,
    shippingFormatted: '',
    total: 50,
    totalFormatted: '50,00 kr',
    subtotalExVat: 40,
    subtotalExVatFormatted: '40,00 kr',
    shippingExVat: 0,
    shippingExVatFormatted: '',
    totalExVat: 40,
    totalExVatFormatted: '40,00 kr',
    currency: 'SEK',
    createdAt: '2026-11-04T10:00:00Z',
    updatedAt: '2026-11-04T10:00:00Z',
  };
}

/**
 * Answers the create with `status`, the new draft's read, and the list of the
 * buyer's quotations with `existing` as their names, as they are when the list
 * is read; returns the names sent.
 */
async function answerRequest(
  page: Page,
  status = 200,
  existing: string[] = [],
) {
  const names: string[] = [];
  await page.route('**/api/quotes', (route: Route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: {
            quotes: existing.map((name, i) => ({ id: `e2e-${i}`, name })),
            total: existing.length,
          },
        })
      : route.fallback(),
  );
  await page.route('**/api/quotes/requests', async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const { name } = route.request().postDataJSON() as { name: string };
    names.push(name);
    if (status !== 200) {
      return route.fulfill({
        status,
        json: { statusCode: status, data: { code: 'RATE_LIMITED' } },
      });
    }
    return route.fulfill({ json: { quote: makeQuote(name) } });
  });
  await page.route(`**/api/quotes/${QUOTE_ID}`, (route: Route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { quote: makeQuote(names.at(-1) ?? '') } })
      : route.fallback(),
  );
  return names;
}

async function cartCookie(page: Page): Promise<string | undefined> {
  return (await page.context().cookies(page.url())).find(
    (c) => c.name === 'cart_id',
  )?.value;
}

/** "Varukorg <date>" in the page's language, dated as the app dates it. */
async function expectedName(page: Page): Promise<string> {
  const date = await page.evaluate(() =>
    new Intl.DateTimeFormat(document.documentElement.lang, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date()),
  );
  return (await localeText(page, 'cart.quote_request_name')).replace(
    '{date}',
    date,
  );
}

/**
 * Whether this tenant offers the button to a signed-in buyer, read from
 * `/api/config`: `quotes` and `quoteRequests` both on. A signed-in buyer
 * passes either access rule, so `enabled` decides. The read is asserted, so a
 * wrong-shaped answer fails instead of turning the flow tests into skips.
 */
async function quoteRequestsOn(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/config');
  expect(response.ok(), '/api/config did not answer 200').toBe(true);
  const { features } = await response.json();
  expect(
    features?.quoteRequests,
    '/api/config carries no quoteRequests',
  ).toBeTruthy();
  return (
    features?.quotes?.enabled === true &&
    features.quoteRequests.enabled === true
  );
}

const OFF = 'quotes or quoteRequests is off for this tenant';

/** The dialog the button opens; it is portalled out of the drawer. */
function confirmDialog(page: Page) {
  return page.locator('[data-testid="cart-to-quote-dialog"]');
}

/** Opens the dialog from `button` and checks its copy; answers the dialog. */
async function openDialog(page: Page, button: Locator) {
  await button.click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText(
    await localeText(page, 'cart.quote_confirm_title'),
  );
  await expect(dialog.locator('p')).toHaveText([
    await localeText(page, 'cart.quote_confirm_text'),
    await localeText(page, 'cart.quote_confirm_draft'),
  ]);
  await expect(
    dialog.locator('[data-testid="cart-to-quote-confirm"]'),
  ).toHaveText(await localeText(page, 'cart.quote_confirm_submit'));
  await expect(dialog).toBeInViewport({ ratio: 1 });
  return dialog;
}

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
] as const;

test.describe('Cart to quote request', () => {
  test('the drawer offers the cart as a quote request exactly when quotes and quoteRequests are on', async ({
    page,
  }) => {
    const on = await quoteRequestsOn(page);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);

    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(
      drawer.locator('[data-testid="cart-drawer-checkout-button"]'),
    ).toBeVisible();
    await expect(
      drawer.locator('[data-testid="cart-add-to-quote"]'),
    ).toHaveCount(on ? 1 : 0);
    await expect(
      drawer.locator('[data-testid="cart-add-to-quote-hint"]'),
    ).toHaveCount(0);
  });

  for (const [width, viewport] of VIEWPORTS) {
    test(`the drawer asks first, then turns the cart into a draft, opens its request page and starts a new cart (${width})`, async ({
      page,
    }) => {
      outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
      await page.setViewportSize(viewport);
      const names = await answerRequest(page);
      const product = await discoverPurchasableProduct(page);
      await addToCart(page, product.alias);
      const firstCart = await cartCookie(page);
      expect(firstCart).toBeTruthy();

      const drawer = page.locator('[data-testid="cart-drawer"]');
      await expect(drawer).toBeVisible();
      const button = drawer.locator('[data-testid="cart-add-to-quote"]');
      await expect(button).toHaveText(
        await localeText(page, 'cart.add_to_quote'),
      );
      await expect(
        drawer.locator('[data-testid="cart-add-to-quote-hint"]'),
      ).toHaveCount(0);

      const dialog = await openDialog(page, button);
      expect(names).toEqual([]);
      await dialog.locator('[data-testid="cart-to-quote-confirm"]').click();
      await page.waitForURL(
        new RegExp(`/portal/quotations/${QUOTE_ID}/request$`),
        {
          timeout: PAGE_TIMEOUT,
        },
      );
      await expect(
        page.locator('[data-testid="quote-request-page"]'),
      ).toBeVisible({ timeout: PAGE_TIMEOUT });

      expect(names).toEqual([await expectedName(page)]);
      await expect(drawer).toBeHidden();
      await expect(dialog).toBeHidden();
      expect(await cartCookie(page)).toBeUndefined();

      await addToCart(page, product.alias);
      const next = await fetchCart(page);
      expect(await cartCookie(page)).not.toBe(firstCart);
      expect(next.items).toHaveLength(1);
      expect(next.items[0]?.quantity).toBe(1);
    });
  }

  test('cancel leaves the cart and the page as they were', async ({ page }) => {
    outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
    const names = await answerRequest(page);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);
    const cart = await cartCookie(page);
    const url = page.url();

    const drawer = page.locator('[data-testid="cart-drawer"]');
    const dialog = await openDialog(
      page,
      drawer.locator('[data-testid="cart-add-to-quote"]'),
    );
    await dialog.locator('[data-testid="cart-to-quote-cancel"]').click();

    await expect(dialog).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-testid="cart-item"]')).toHaveCount(1);
    expect(names).toEqual([]);
    expect(await cartCookie(page)).toBe(cart);
    expect(page.url()).toBe(url);
  });

  test('a second cart the same day gets (2) after its name', async ({
    page,
  }) => {
    outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
    const existing: string[] = [];
    const names = await answerRequest(page, 200, existing);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);
    const today = await expectedName(page);
    existing.push(today);

    const drawer = page.locator('[data-testid="cart-drawer"]');
    const dialog = await openDialog(
      page,
      drawer.locator('[data-testid="cart-add-to-quote"]'),
    );
    await dialog.locator('[data-testid="cart-to-quote-confirm"]').click();
    await page.waitForURL(
      new RegExp(`/portal/quotations/${QUOTE_ID}/request$`),
      { timeout: PAGE_TIMEOUT },
    );

    expect(names).toEqual([`${today} (2)`]);
  });

  for (const [width, viewport] of VIEWPORTS) {
    test(`the cart page offers the same, under its checkout button (${width})`, async ({
      page,
    }) => {
      outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
      await page.setViewportSize(viewport);
      const names = await answerRequest(page);
      const product = await discoverPurchasableProduct(page);
      await addToCart(page, product.alias);

      await page.goto('/cart');
      await page.waitForLoadState('load');
      await waitForHydration(page);
      const cartPage = page.locator('[data-testid="cart-page"]');
      await expect(cartPage.locator('[data-testid="cart-item"]')).toHaveCount(
        1,
        {
          timeout: PAGE_TIMEOUT,
        },
      );

      const button = cartPage.locator('[data-testid="cart-add-to-quote"]');
      await button.scrollIntoViewIfNeeded();
      const dialog = await openDialog(page, button);
      await dialog.locator('[data-testid="cart-to-quote-confirm"]').click();
      await page.waitForURL(
        new RegExp(`/portal/quotations/${QUOTE_ID}/request$`),
        {
          timeout: PAGE_TIMEOUT,
        },
      );
      expect(names).toEqual([await expectedName(page)]);
      expect(await cartCookie(page)).toBeUndefined();
    });
  }

  test('a refused request leaves the cart as it was and says why', async ({
    page,
  }) => {
    outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
    await answerRequest(page, 429);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);
    const cart = await cartCookie(page);

    const drawer = page.locator('[data-testid="cart-drawer"]');
    const dialog = await openDialog(
      page,
      drawer.locator('[data-testid="cart-add-to-quote"]'),
    );
    await dialog.locator('[data-testid="cart-to-quote-confirm"]').click();

    await expect(dialog).toBeHidden();
    await expect(
      drawer.locator('[data-testid="cart-add-to-quote-error"]'),
    ).toHaveText(await localeText(page, 'cart.add_to_quote_rate_limited'));
    await expect(drawer.locator('[data-testid="cart-item"]')).toHaveCount(1);
    expect(await cartCookie(page)).toBe(cart);
    expect(page.url()).not.toContain('/portal/quotations/');
  });
});
