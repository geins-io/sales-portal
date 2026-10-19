import { test, expect, type Page } from '@playwright/test';
import {
  hasE2ECredentials,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';

/**
 * A product sold in several SKUs of its own, not as sibling products. Geins
 * sends the choice only in `skus`, under its internal `DefaultProduct`
 * dimension. The buyer has to pick a SKU, and the picked one is the one that
 * lands in the cart.
 *
 * The product is one on the test account with SKUs S, M and L beside its
 * original. Where it is missing or has lost them, the file is out of scope
 * rather than failing. The test removes the line it added and places no order.
 */

const ALIAS = 'skyddsglasogon-klar-en-166';
const PICK_NAME = 'M';

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'adding to the cart needs a signed-in buyer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

interface Sku {
  skuId: number;
  name?: string;
  articleNumber?: string;
  stock?: { totalStock: number };
}

async function productSkus(page: Page): Promise<Sku[]> {
  const response = await page.request.get(`/api/products/${ALIAS}`);
  if (!response.ok()) return [];
  return ((await response.json()) as { skus?: Sku[] }).skus ?? [];
}

/** This host's cart only: the stored session may hold other tenants' cookies. */
async function cartIdOf(page: Page): Promise<string | undefined> {
  return (await page.context().cookies(page.url())).find(
    (c) => c.name === 'cart_id',
  )?.value;
}

test('the buyer picks a SKU and the picked SKU is the one added', async ({
  page,
}) => {
  const skus = await productSkus(page);
  const picked = skus.find((s) => s.name === PICK_NAME);
  outOfScope(
    skus.length < 2 || !picked || (picked.stock?.totalStock ?? 0) < 1,
    'fixture-missing',
    `${ALIAS} is not sold in several SKUs with "${PICK_NAME}" in stock`,
  );

  await page.goto(`/p/${ALIAS}`);
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const topArea = page.getByTestId('pdp-top-area');
  await expect(page.getByTestId('variant-trigger-sku')).toBeVisible();
  await expect(topArea).not.toContainText('DefaultProduct');

  // Nothing is added before a pick: the button asks for one and opens the sheet.
  const addButton = page.getByTestId('add-to-cart-button');
  await expect(addButton).toHaveText(
    await localeText(page, 'product.choose_variant'),
  );
  const adds: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/cart/items') && r.method() === 'POST') {
      adds.push(r.postData() ?? '');
    }
  });
  await addButton.click();

  const sheet = page.getByTestId('variant-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('variant-option')).toHaveCount(skus.length);
  expect(adds).toEqual([]);

  await sheet
    .locator(`[data-testid="variant-option"][data-value="${picked!.skuId}"]`)
    .click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('variant-trigger-sku')).toHaveText(PICK_NAME);
  await expect(page.getByTestId('product-article-number')).toContainText(
    picked!.articleNumber!,
  );
  await expect(addButton).toHaveText(
    await localeText(page, 'product.add_to_cart'),
  );

  let cartId: string | undefined;
  const lineIds: string[] = [];
  try {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/cart/items') &&
          r.request().method() === 'POST',
      ),
      addButton.click(),
    ]);
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON()).toMatchObject({
      skuId: picked!.skuId,
    });

    cartId = await cartIdOf(page);
    if (!cartId) throw new Error('the add left no cart cookie');
    const cart = await page.request.get('/api/cart', { params: { cartId } });
    const items =
      ((await cart.json()) as { items?: { id: string; skuId: number }[] })
        .items ?? [];
    lineIds.push(...items.map((i) => i.id));
    expect(items.map((i) => i.skuId)).toEqual([picked!.skuId]);
  } finally {
    for (const itemId of lineIds) {
      await page.request.delete('/api/cart/items', {
        params: { cartId: cartId!, itemId },
      });
    }
  }
});
