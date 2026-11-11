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

/**
 * A request draft edited in the quotation view, against Geins: each test makes
 * its own draft from a cart, edits it, reads it back after a reload, and
 * deletes it. Nothing is sent to the seller and no order is placed; a draft a
 * failed test leaves behind is deleted in `afterEach`.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'quote drafts need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

// One test at a time per leg: each makes a draft, and Geins fails some of the
// drafts one buyer makes at the same moment.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const PAGE_TIMEOUT = 20000;
/** Long enough for a save, short of the undo window. */
const SAVE_TIMEOUT = 8000;
const LIST_PATH = '/se/sv/portal/quotations';
const OFF = 'quotes and quoteRequests are not both on for this tenant';
/** How long the set-up keeps asking Geins for a draft; a create can take 70 s. */
const CREATE_BUDGET = 90_000;
/** Drafts a crashed run left behind; never one a run still uses. */
const STALE_AFTER = 60 * 60 * 1000;
const CREATE_FAILED = 'Create quotation request failed.';

/** The draft the worker's current test makes, for the afterEach to delete. */
let own: { name: string; id?: string } | null = null;

/** What the rename step names a draft. */
const renamedName = (name: string) => `${name} renamed`;

/**
 * A name only this test in this run uses, so the set-up can find the draft
 * Geins made after a create it gave up on, and the clean-up finds its own.
 */
function draftName(testInfo: TestInfo, slug: string): string {
  const run = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}.${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`
    : `local${process.ppid}`;
  const repeat = testInfo.repeatEachIndex ? `-${testInfo.repeatEachIndex}` : '';
  const name = `${E2E_DATA_PREFIX}${run}-${testInfo.project.name}-${slug}${repeat}`;
  own = { name };
  return name;
}

interface ListedDraft {
  id: string;
  name?: string;
  status: string;
  createdAt: string;
}

/** The account's request drafts, or null when the list could not be read. */
async function listDrafts(page: Page): Promise<ListedDraft[] | null> {
  const response = await page.request.get('/api/quotes');
  if (!response.ok()) return null;
  const { quotes = [] } = (await response.json()) as { quotes?: ListedDraft[] };
  return quotes.filter((quote) => quote.status === 'request_draft');
}

interface DraftProduct {
  alias: string;
  skuId: number;
  name: string;
  articleNumber: string;
}

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
 * Plain products with one SKU, the ones quick add can put on a draft. The list
 * marks a configurable product only on some backends, so each is asked.
 */
async function plainProducts(
  page: Page,
  count: number,
): Promise<DraftProduct[]> {
  const response = await page.request.get('/api/product-lists/products', {
    params: { take: '50', filter: JSON.stringify({ sort: 'ALPHABETICAL' }) },
  });
  expect(response.ok()).toBe(true);
  const { products = [] } = (await response.json()) as {
    products?: {
      alias?: string;
      name?: string;
      articleNumber?: string;
      configurable?: boolean;
      skus?: { skuId: number }[];
    }[];
  };
  const plain: DraftProduct[] = [];
  for (const p of products) {
    if (plain.length === count) break;
    if (
      p.configurable ||
      p.skus?.length !== 1 ||
      !p.articleNumber ||
      !p.alias
    ) {
      continue;
    }
    if (await isConfigurable(page, p.alias)) continue;
    plain.push({
      alias: p.alias,
      skuId: p.skus[0]!.skuId,
      name: p.name ?? '',
      articleNumber: p.articleNumber,
    });
  }
  expect(plain.length, `${count} plain products`).toBe(count);
  return plain;
}

function ownId(id: string): string {
  if (own) own.id = id;
  return id;
}

/** A new draft holding these products, one of each; its id. */
async function makeDraft(
  page: Page,
  products: DraftProduct[],
  name: string,
): Promise<string> {
  const cart = await page.request.post('/api/cart');
  expect(cart.ok(), 'no cart was made').toBe(true);
  const cartId = (await cart.json()).id as string;
  for (const { skuId } of products) {
    const added = await page.request.post('/api/cart/items', {
      data: { cartId, skuId, quantity: 1 },
    });
    expect(added.ok(), `SKU ${skuId} did not go in the cart`).toBe(true);
  }
  // Set-up only; the portal itself does not retry. Geins fails some drafts
  // one buyer makes at the same moment ("Create quotation request failed.")
  // and can take 70 s on one, so a create given up on may still land: each
  // round first looks for the draft by its name.
  const deadline = Date.now() + CREATE_BUDGET;
  let last = '';
  for (let round = 0; Date.now() < deadline; round++) {
    const drafts = await listDrafts(page);
    const found = drafts?.find((draft) => draft.name === name);
    if (found) return ownId(found.id);
    if (drafts) {
      // The request is made from the cart in the buyer's cart cookie, set
      // just before: the open page's own cart can take the cookie meanwhile.
      await page
        .context()
        .addCookies([
          { name: 'cart_id', value: cartId, url: new URL(page.url()).origin },
        ]);
      const made = await page.request
        .post('/api/quotes/requests', {
          data: { name },
          timeout: Math.max(deadline - Date.now(), 1000),
        })
        .catch((error: unknown) => {
          // Cut off by the budget: the next round looks the draft up.
          if (!String(error).includes('Timeout')) throw error;
          last = String(error);
          return null;
        });
      if (made?.ok()) return ownId((await made.json()).quote.id as string);
      if (made) {
        last = `${made.status()} ${await made.text()}`;
        expect(
          made.status() >= 500 || last.includes(CREATE_FAILED),
          `the draft was not made: ${last}`,
        ).toBe(true);
      }
    }
    await page.waitForTimeout(
      Math.min(2000 * 2 ** round, 10_000) + Math.random() * 1500,
    );
  }
  const late = (await listDrafts(page))?.find((draft) => draft.name === name);
  if (late) return ownId(late.id);
  throw new Error(`no draft named ${name} within ${CREATE_BUDGET} ms: ${last}`);
}

/** Clean-up: a draft still there is deleted. */
async function deleteDraft(page: Page, id: string) {
  if ((await page.request.get(`/api/quotes/${id}`)).status() === 404) return;
  const answer = await page.request.delete(`/api/quotes/${id}`);
  expect(answer.ok(), `draft ${id} was left in Geins`).toBe(true);
}

/**
 * Clean-up, also when the set-up threw: the test's draft, then, after a
 * moment for a create that landed late, any draft still carrying its names.
 */
test.afterEach(async ({ page }) => {
  if (!own) return;
  const { name, id } = own;
  own = null;
  if (id) await deleteDraft(page, id);
  await page.waitForTimeout(3000);
  for (const draft of (await listDrafts(page)) ?? []) {
    if (draft.name === name || draft.name === renamedName(name)) {
      await deleteDraft(page, draft.id);
    }
  }
});

// Once per worker, through the first test's signed-in page: `signedInState`
// is a test fixture, so a beforeAll has no session to read the list with.
let swept = false;
test.beforeEach(async ({ page }) => {
  if (swept) return;
  swept = true;
  const now = Date.now();
  for (const draft of (await listDrafts(page)) ?? []) {
    const age = now - Date.parse(draft.createdAt);
    if (draft.name?.startsWith(E2E_DATA_PREFIX) && age > STALE_AFTER) {
      await page.request.delete(`/api/quotes/${draft.id}`);
    }
  }
});

async function readDraft(page: Page, id: string) {
  const response = await page.request.get(`/api/quotes/${id}`);
  expect(response.ok(), `/api/quotes/${id} did not answer 200`).toBe(true);
  const { quote } = await response.json();
  return quote as {
    name: string;
    lineItems: { skuId: number; quantity: number }[];
  };
}

/**
 * Add a product with quick add. The search is answered by the test with this
 * product alone: Geins' ranking is not what is under test here, and it is not
 * stable (on the team tenant the same name search put the product first only
 * 8 times in 12), so a real search is left out of this spec.
 */
async function quickAdd(page: Page, product: DraftProduct) {
  await page.route('**/api/search/products?*', (route) =>
    route.fulfill({
      json: {
        products: [
          {
            productId: product.skuId,
            name: product.name,
            alias: product.alias,
            articleNumber: product.articleNumber,
            skus: [{ skuId: product.skuId }],
            productImages: [],
          },
        ],
        count: 1,
      },
    }),
  );
  await page.getByTestId('quote-quick-add-input').fill(product.name);
  await page
    .getByTestId('quote-quick-add-hit')
    .filter({ hasText: product.articleNumber })
    .click();
  await page.unroute('**/api/search/products?*');
}

async function openDraft(page: Page, id: string) {
  await page.goto(`${LIST_PATH}/${id}`);
  await waitForHydration(page);
  await expect(page.getByTestId('quote-draft-lines')).toBeVisible({
    timeout: PAGE_TIMEOUT,
  });
}

/** "All changes saved" once nothing waits. */
async function expectSaved(page: Page) {
  await expect(page.getByTestId('quote-save-state')).toHaveText(
    await localeText(page, 'portal.quotations.draft.saved'),
    { timeout: SAVE_TIMEOUT },
  );
}

const rowFor = (page: Page, name: string) =>
  page.getByTestId('quote-item-row').filter({ hasText: name });

test.describe('Edit a request draft', () => {
  test('renames it, changes an amount, adds and removes lines, and reads it back', async ({
    page,
  }, testInfo) => {
    await setDesktopViewport(page);
    await page.goto(LIST_PATH);
    outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
    const [a, b, c] = (await plainProducts(page, 3)) as [
      DraftProduct,
      DraftProduct,
      DraftProduct,
    ];

    const name = draftName(testInfo, 'draft editing');
    const renamed = renamedName(name);
    const id = await makeDraft(page, [a, b], name);
    await openDraft(page, id);

    // Rename from the ⋯ menu; Enter saves.
    await page.getByTestId('quote-more').click();
    await page.getByTestId('quote-rename').click();
    const nameField = page.getByTestId('quote-name-input');
    await expect(nameField).toBeFocused();
    await nameField.fill(renamed);
    await nameField.press('Enter');
    await expect(page.getByTestId('quote-title')).toHaveText(renamed);
    await expectSaved(page);

    // An amount, typed.
    const amount = rowFor(page, a.name).getByRole('spinbutton');
    await amount.fill('3');
    await amount.press('Tab');
    await expectSaved(page);

    await quickAdd(page, c);
    await expect(rowFor(page, c.name)).toBeVisible({ timeout: SAVE_TIMEOUT });
    await expectSaved(page);

    // Remove b and undo it: nothing changes.
    await rowFor(page, b.name).getByTestId('quote-item-remove').click();
    await expect(rowFor(page, b.name)).toHaveCount(0);
    await page.getByTestId('quote-undo').click();
    await expect(rowFor(page, b.name)).toBeVisible();

    // Remove b for real; leaving the view saves it.
    await rowFor(page, b.name).getByTestId('quote-item-remove').click();
    await page.getByTestId('back-link').click();
    await page.waitForURL(new RegExp(`${LIST_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });

    // Read back from Geins, then in the view after a fresh load.
    const saved = await readDraft(page, id);
    expect(saved.name).toBe(renamed);
    expect(saved.lineItems.map((l) => [l.skuId, l.quantity]).sort()).toEqual(
      [
        [a.skuId, 3],
        [c.skuId, 1],
      ].sort(),
    );
    await openDraft(page, id);
    await expect(page.getByTestId('quote-title')).toHaveText(renamed);
    await expect(page.getByTestId('quote-item-row')).toHaveCount(2);
    await expect(rowFor(page, a.name).getByRole('spinbutton')).toHaveValue('3');

    // Removing the last line asks first; cancel keeps everything.
    await rowFor(page, c.name).getByTestId('quote-item-remove').click();
    await rowFor(page, a.name).getByTestId('quote-item-remove').click();
    const dialog = page.getByTestId('delete-draft-dialog');
    await expect(dialog.getByRole('heading')).toHaveText(
      await localeText(page, 'portal.quotations.delete_dialog.last_line_title'),
    );
    await dialog
      .getByRole('button', { name: await localeText(page, 'common.cancel') })
      .click();
    await expect(dialog).toBeHidden();
    await expect(rowFor(page, a.name)).toBeVisible();
    await page.getByTestId('quote-undo').click();
    await expect(page.getByTestId('quote-item-row')).toHaveCount(2);

    // Delete from the ⋯ menu.
    await page.getByTestId('quote-more').click();
    await page.getByTestId('quote-delete').click();
    await expect(dialog.getByRole('heading')).toHaveText(
      await localeText(page, 'portal.quotations.delete_dialog.title'),
    );
    await page.getByTestId('delete-draft-confirm').click();
    await page.waitForURL(new RegExp(`${LIST_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });
    expect((await page.request.get(`/api/quotes/${id}`)).status()).toBe(404);
  });

  test('works the same at phone width', async ({ page }, testInfo) => {
    await setMobileViewport(page);
    await page.goto(LIST_PATH);
    outOfScope(!(await quoteRequestsOn(page)), 'tenant-config', OFF);
    const [a, b] = (await plainProducts(page, 2)) as [
      DraftProduct,
      DraftProduct,
    ];

    const name = draftName(testInfo, 'draft on a phone');
    const id = await makeDraft(page, [a, b], name);
    await openDraft(page, id);
    const card = page
      .getByTestId('quote-item-card')
      .filter({ hasText: a.name });
    await expect(card).toBeVisible();
    await expect(page.getByTestId('quote-items-table')).toBeHidden();

    await card.getByRole('button', { name: /increase/i }).click();
    await expectSaved(page);
    await expect(page.getByTestId('quote-continue')).toBeVisible();

    await page.reload();
    await waitForHydration(page);
    await expect(card.getByRole('spinbutton')).toHaveValue('2', {
      timeout: PAGE_TIMEOUT,
    });

    // Removing the last line deletes the draft, once confirmed.
    await page
      .getByTestId('quote-item-card')
      .filter({ hasText: b.name })
      .getByTestId('quote-item-remove-mobile')
      .click();
    await card.getByTestId('quote-item-remove-mobile').click();
    await page.getByTestId('delete-draft-confirm').click();
    await page.waitForURL(new RegExp(`${LIST_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });
    expect((await page.request.get(`/api/quotes/${id}`)).status()).toBe(404);
  });
});
