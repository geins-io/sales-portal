import type { TestInfo } from '@playwright/test';
import { test, expect, type Page } from './fixtures';
import {
  E2E_DATA_PREFIX,
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  setDesktopViewport,
  setMobileViewport,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';
import { unitsAvailable, type StockedCandidate } from './product-choice';

/**
 * "Lägg till i offertförfrågan" on the product page, against Geins: the test
 * makes a new draft with the product, adds it again to that draft, and reads
 * the draft back. The line is found by the product's name and the amount the
 * API answers, never by the article table's structure. The buyer's cart is
 * the same before and after. The draft is deleted afterwards, also when the
 * test fails halfway.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'adding to a quote request needs a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

// Geins fails some drafts one buyer makes at the same moment.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const PAGE_TIMEOUT = 20_000;
/** A new draft goes through a cart of its own and can take a while. */
const ADD_TIMEOUT = 90_000;
const OFF = 'quotes and quoteRequests are not both on for this tenant';
/** How long the test keeps asking Geins for the new draft. */
const CREATE_BUDGET = 90_000;
const CREATE_FAILED = 'Create quotation request failed.';

interface ListedDraft {
  id: string;
  name?: string;
  status: string;
  createdAt: string;
}

/** Drafts an earlier run left behind; never one a run still uses. */
const STALE_AFTER = 60 * 60 * 1000;

interface Product {
  alias: string;
  skuId: number;
  name: string;
}

/** The name this test's draft gets, which the clean-up looks for. */
let own: string | null = null;

function draftName(testInfo: TestInfo, width: string): string {
  const run = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}.${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`
    : `local${process.ppid}`;
  const repeat = testInfo.repeatEachIndex ? `-${testInfo.repeatEachIndex}` : '';
  own = `${E2E_DATA_PREFIX}${run}-${testInfo.project.name}-pdp-add-${width}${repeat}`;
  return own;
}

async function listDrafts(page: Page): Promise<ListedDraft[] | null> {
  const response = await page.request.get('/api/quotes');
  if (!response.ok()) return null;
  const { quotes = [] } = (await response.json()) as { quotes?: ListedDraft[] };
  return quotes.filter((quote) => quote.status === 'request_draft');
}

/**
 * Clean-up, also after a failure halfway: every draft carrying this test's
 * name, after a moment for a create that landed late.
 */
test.afterEach(async ({ page }) => {
  if (!own) return;
  const name = own;
  own = null;
  await page.waitForTimeout(3000);
  for (const draft of (await listDrafts(page)) ?? []) {
    if (draft.name !== name) continue;
    const answer = await page.request.delete(`/api/quotes/${draft.id}`);
    expect(answer.ok(), `draft ${draft.id} was left in Geins`).toBe(true);
  }
});

// A create Geins answered late, after the clean-up above had looked, is
// caught on a later run: once per worker, through the first test's signed-in
// page (`signedInState` is a test fixture, so a beforeAll has no session).
let swept = false;
test.beforeEach(async ({ page }) => {
  if (swept) return;
  swept = true;
  const now = Date.now();
  for (const draft of (await listDrafts(page)) ?? []) {
    const stale = now - Date.parse(draft.createdAt) > STALE_AFTER;
    if (
      stale &&
      draft.name?.startsWith(E2E_DATA_PREFIX) &&
      draft.name.includes('-pdp-add-')
    ) {
      await page.request.delete(`/api/quotes/${draft.id}`);
    }
  }
});

async function quoteRequestsOn(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/config');
  expect(response.ok(), '/api/config did not answer 200').toBe(true);
  const { features } = await response.json();
  return (
    features?.quotes?.enabled === true &&
    features?.quoteRequests?.enabled === true
  );
}

/**
 * A plain product with one SKU and stock for the amount: a new draft is made
 * from a cart, and Geins leaves a line short of stock out of a cart.
 */
async function plainProduct(page: Page, amount: number): Promise<Product> {
  const response = await page.request.get('/api/product-lists/products', {
    params: { take: '50', filter: JSON.stringify({ sort: 'ALPHABETICAL' }) },
  });
  expect(response.ok()).toBe(true);
  const { products = [] } = (await response.json()) as {
    products?: {
      alias?: string;
      name?: string;
      totalStock?: StockedCandidate['stock'];
      configurable?: boolean;
      skus?: { skuId: number }[];
    }[];
  };
  for (const p of products) {
    if (p.configurable || p.skus?.length !== 1 || !p.alias || !p.name) continue;
    if (unitsAvailable(p.totalStock) < amount) continue;
    if (await isConfigurable(page, p.alias)) continue;
    return { alias: p.alias, skuId: p.skus[0]!.skuId, name: p.name };
  }
  throw new Error(`no plain product with stock for ${amount}`);
}

/** The buyer's cart as the cookie names it: its id and its lines. */
async function buyersCart(page: Page) {
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === 'cart_id',
  );
  if (!cookie) return { id: null, lines: [] };
  const response = await page.request.get('/api/cart', {
    params: { cartId: cookie.value },
  });
  const cart = response.ok()
    ? ((await response.json()) as {
        items?: { skuId?: number; quantity: number }[];
      } | null)
    : null;
  return {
    id: cookie.value,
    lines: (cart?.items ?? []).map(({ skuId, quantity }) => ({
      skuId,
      quantity,
    })),
  };
}

async function setAmount(page: Page, amount: number) {
  const field = page
    .getByTestId('pdp-actions')
    .getByTestId('quantity-input')
    .locator('input');
  await field.fill(String(amount));
  await field.blur();
}

/**
 * "Skapa utkast" until Geins makes the draft. Geins fails some drafts one
 * buyer makes at the same moment, which the engines running side by side do.
 * The page then says so, as it should, and the buyer presses again; each
 * press after the first is noted on the test.
 */
async function createDraft(page: Page, name: string, testInfo: TestInfo) {
  const deadline = Date.now() + CREATE_BUDGET;
  for (let attempt = 1; ; attempt++) {
    const answer = page.waitForResponse(
      (r) =>
        r.url().includes('/api/quotes/drafts') &&
        r.request().method() === 'POST',
      { timeout: ADD_TIMEOUT },
    );
    await page.getByTestId('rename-draft-submit').click();
    const response = await answer;
    if (response.ok()) return;
    const body = await response.text();
    expect(
      response.status() === 502 && body.includes(CREATE_FAILED),
      `the draft was not made: ${response.status()} ${body.slice(0, 300)}`,
    ).toBe(true);
    await expect(page.getByTestId('rename-draft-failed')).toBeVisible();
    // A create Geins gave up on may still land; it is not made twice.
    const late = (await listDrafts(page))?.some((d) => d.name === name);
    expect(late, `${name} landed after Geins answered it failed`).toBe(false);
    expect(Date.now() < deadline, `no draft within ${CREATE_BUDGET} ms`).toBe(
      true,
    );
    testInfo.annotations.push({
      type: 'geins create retried',
      description: `attempt ${attempt} answered "${CREATE_FAILED}"`,
    });
    await page.waitForTimeout(2000 * attempt);
  }
}

const menuButton = (page: Page) => page.getByTestId('add-to-quote-button');

for (const width of ['desktop', 'mobile'] as const) {
  test(`adds a product to a new draft and again to that draft, on ${width}`, async ({
    page,
  }, testInfo) => {
    await (width === 'desktop' ? setDesktopViewport : setMobileViewport)(page);
    await page.goto('/se/sv/portal/quotations');
    outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
    const product = await plainProduct(page, 5);
    const name = draftName(testInfo, width);
    const cartBefore = await buyersCart(page);

    await page.goto(`/p/${product.alias}`);
    await waitForHydration(page);
    await expect(menuButton(page)).toBeVisible({ timeout: PAGE_TIMEOUT });

    // A new request, named in the dialog, with 2 of the product.
    await setAmount(page, 2);
    await menuButton(page).click();
    await page.getByTestId('add-to-quote-new').click();
    await page.getByTestId('rename-draft-input').fill(name);
    await createDraft(page, name, testInfo);
    const notice = page.getByTestId('add-to-quote-confirmation');
    await expect(notice).toContainText(
      await localeText(page, 'product.quote_menu.added_new'),
      { timeout: ADD_TIMEOUT },
    );
    await expect(notice).toContainText(name);

    // The same product again, 3 more, picked from the menu by the draft's name.
    await setAmount(page, 3);
    await menuButton(page).click();
    await page
      .getByTestId('add-to-quote-draft')
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
    await expect(notice).toContainText(
      await localeText(page, 'product.quote_menu.added'),
      { timeout: ADD_TIMEOUT },
    );

    // Read back: the draft view shows the product, and Geins holds one line of
    // it at 5.
    await notice.getByTestId('add-to-quote-view').click();
    await expect(page).toHaveURL(/\/portal\/quotations\/[^/]+$/, {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.getByText(product.name).first()).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
    const id = page.url().split('/').pop()!;
    const read = await page.request.get(`/api/quotes/${id}`);
    expect(read.ok()).toBe(true);
    const { quote } = (await read.json()) as {
      quote: { name: string; lineItems: { skuId: number; quantity: number }[] };
    };
    expect(quote.name).toBe(name);
    expect(
      quote.lineItems.filter((line) => line.skuId === product.skuId),
    ).toEqual([expect.objectContaining({ skuId: product.skuId, quantity: 5 })]);

    // The buyer's own cart is as it was.
    expect(await buyersCart(page)).toEqual(cartBefore);
  });
}
