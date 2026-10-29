import { test, expect, type Page } from './fixtures';
import {
  addToCart,
  discoverPurchasableProduct,
  fetchCart,
  outOfScope,
  waitForHydration,
} from './helpers';

/**
 * Buyers taking turns in one browser. Each buyer gets their own cart, never
 * the cart of the buyer before them, and gets theirs back at the next sign-in.
 *
 * The pairs come from the `.env` letters: `E2E_USERNAME` and `E2E_USERNAME_F`
 * are buyers in the same company, `E2E_USERNAME_B` is a buyer in another one.
 */
const buyer = (letter: '' | '_F' | '_B') => ({
  username: process.env[`E2E_USERNAME${letter}`] ?? '',
  password: process.env[`E2E_PASSWORD${letter}`] ?? '',
});
const A = buyer('');
const SAME_COMPANY = buyer('_F');
const OTHER_COMPANY = buyer('_B');

outOfScope(
  ![A, SAME_COMPANY, OTHER_COMPANY].every((c) => c.username && c.password),
  'no-credentials',
  'switching buyers needs E2E_USERNAME, E2E_USERNAME_F and E2E_USERNAME_B with their passwords',
);

// Every test signs its buyers in itself, in one fresh browser.
test.use({ storageState: { cookies: [], origins: [] } });

async function cartIdOf(page: Page): Promise<string | undefined> {
  return (await page.context().cookies()).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
}

/**
 * The shared `login`, waiting for the reload the sign-in makes. The login page
 * moves its old app off `/login` while that reload is still on its way, so the
 * URL alone resolves too early and the next `goto` is aborted.
 */
async function signIn(
  page: Page,
  credentials: { username: string; password: string },
): Promise<void> {
  await page.goto('/se/sv/login');
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const emailInput = page.locator('[data-testid="login-email"]');
  await expect(emailInput).toBeVisible({ timeout: 20000 });
  await emailInput.fill(credentials.username);
  await page
    .locator('[data-testid="login-password"]')
    .fill(credentials.password);

  const reloaded = page.waitForEvent('load', { timeout: 30000 });
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      { timeout: 20000 },
    ),
    page.locator('[data-testid="login-submit"]').click(),
  ]);
  expect(
    response.ok(),
    `sign-in failed (HTTP ${response.status()}): check the E2E_USERNAME* / E2E_PASSWORD* pair in .env`,
  ).toBe(true);

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 20000,
  });
  await reloaded;
  await waitForHydration(page);
}

async function signOut(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/logout');
  expect(response.ok(), 'sign-out did not answer 200').toBe(true);
}

/**
 * Empties each cart the test wrote to. The tenant's carts answer to their id
 * alone, so the buyer signed in at the end can empty all of them.
 */
async function emptyCarts(page: Page, cartIds: Set<string>): Promise<void> {
  for (const cartId of cartIds) {
    const response = await page.request.get('/api/cart', {
      params: { cartId },
    });
    if (!response.ok()) continue;
    const items: { id?: string }[] = (await response.json())?.items ?? [];
    for (const { id } of items) {
      if (!id) continue;
      await page.request.delete('/api/cart/items', {
        params: { cartId, itemId: id },
      });
    }
  }
}

test.describe('the cart follows its buyer', () => {
  const written = new Set<string>();

  test.afterEach(async ({ page }) => {
    try {
      await emptyCarts(page, written);
    } finally {
      written.clear();
    }
  });

  test("buyers taking turns never get each other's cart, and each gets theirs back", async ({
    page,
  }) => {
    test.slow();
    await signIn(page, A);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);
    const cartA = await cartIdOf(page);
    expect(cartA, "A's add made no cart").toBeTruthy();
    written.add(cartA!);

    await signOut(page);
    expect(
      await cartIdOf(page),
      'sign-out left the cart behind',
    ).toBeUndefined();

    // Same company: the case Geins refused on a configurator account.
    await signIn(page, SAME_COMPANY);
    expect(
      await cartIdOf(page),
      "the next buyer was handed A's cart",
    ).toBeUndefined();
    await addToCart(page, product.alias);
    const cartE = await cartIdOf(page);
    written.add(cartE!);
    expect(cartE).not.toBe(cartA);
    expect((await fetchCart(page)).items).toEqual([
      expect.objectContaining({ skuId: product.skuId, quantity: 1 }),
    ]);

    await signOut(page);
    await signIn(page, OTHER_COMPANY);
    expect(
      await cartIdOf(page),
      'a buyer in another company got a cart',
    ).toBeUndefined();
    await addToCart(page, product.alias);
    const cartB = await cartIdOf(page);
    written.add(cartB!);
    expect([cartA, cartE]).not.toContain(cartB);
    expect((await fetchCart(page)).items).toEqual([
      expect.objectContaining({ skuId: product.skuId, quantity: 1 }),
    ]);

    await signOut(page);
    await signIn(page, A);
    expect(await cartIdOf(page), 'A did not get their cart back').toBe(cartA);
    expect((await fetchCart(page)).items).toEqual([
      expect.objectContaining({ skuId: product.skuId, quantity: 1 }),
    ]);
  });

  test('a buyer whose session expired gets their cart back; another buyer gets none', async ({
    page,
  }) => {
    test.slow();
    await signIn(page, A);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);
    const cartA = await cartIdOf(page);
    written.add(cartA!);

    // An expired session: the session cookies go, the cart cookie stays.
    await page.context().clearCookies({ name: 'auth_token' });
    await page.context().clearCookies({ name: 'refresh_token' });
    expect(await cartIdOf(page)).toBe(cartA);

    await signIn(page, SAME_COMPANY);
    expect(
      await cartIdOf(page),
      "the next buyer was handed A's cart",
    ).toBeUndefined();

    await page.context().clearCookies({ name: 'auth_token' });
    await page.context().clearCookies({ name: 'refresh_token' });
    await signIn(page, A);
    expect(await cartIdOf(page), 'A did not get their cart back').toBe(cartA);
    expect((await fetchCart(page)).items).toEqual([
      expect.objectContaining({ skuId: product.skuId, quantity: 1 }),
    ]);
  });
});
