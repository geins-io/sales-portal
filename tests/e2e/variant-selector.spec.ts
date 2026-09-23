import { test, expect, type Page } from '@playwright/test';
import {
  fetchCart,
  hasE2ECredentials,
  outOfScope,
  STORAGE_STATE,
  waitForHydration,
} from './helpers';

/**
 * Variant selector E2E Tests
 *
 * Geins returns a variant group as a tree one level per dimension, with the
 * variant's alias on the product node at the bottom. With one dimension the
 * top node is that product node; with two, the top nodes carry no alias. A
 * pick has to reach the sibling's own page, and siblings are not always in
 * the current product's category, so the page must land on the sibling's
 * canonical without passing through a rebuilt path.
 */

interface VariantNode {
  alias?: string | null;
  dimension?: string | null;
  value?: string | null;
  label?: string | null;
  variants?: VariantNode[] | null;
}

interface Variant {
  alias: string;
  selection: Record<string, string>;
  labels: Record<string, string>;
}

interface VariantProduct {
  alias: string;
  dimensions: number;
  variants: Variant[];
}

function flatten(nodes: VariantNode[] | null | undefined): Variant[] {
  const out: Variant[] = [];
  const walk = (
    list: VariantNode[] | null | undefined,
    selection: Record<string, string>,
    labels: Record<string, string>,
  ) => {
    for (const node of list ?? []) {
      const sel = { ...selection };
      const lab = { ...labels };
      if (node.dimension && node.value != null) {
        sel[node.dimension] = node.value;
        lab[node.dimension] = node.label || node.value;
      }
      if (node.alias)
        out.push({ alias: node.alias, selection: sel, labels: lab });
      else walk(node.variants, sel, lab);
    }
  };
  walk(nodes, {}, {});
  return out;
}

let discovered: VariantProduct[] | null = null;

/**
 * Products whose variant group has more than one variant, from a stable
 * alphabetical sample. Stops as soon as both shapes have been seen.
 */
async function discoverVariantProducts(page: Page): Promise<VariantProduct[]> {
  if (discovered) return discovered;
  const list = await page.request.get('/api/product-lists/products', {
    params: { take: '100', filter: JSON.stringify({ sort: 'ALPHABETICAL' }) },
  });
  expect(list.ok()).toBe(true);
  const aliases: string[] = ((await list.json()).products ?? [])
    .map((p: { alias?: string }) => p.alias)
    .filter(Boolean);

  const found: VariantProduct[] = [];
  for (let i = 0; i < aliases.length; i += 10) {
    const batch = await Promise.all(
      aliases.slice(i, i + 10).map(async (alias) => {
        const res = await page.request.get(`/api/products/${alias}`);
        if (!res.ok()) return null;
        const body = await res.json();
        const product = body.product ?? body;
        const variants = flatten(product.variantGroup?.variants);
        if (variants.length < 2) return null;
        const own = variants.find((v) => v.alias === product.alias);
        if (!own) return null;
        return {
          alias: product.alias as string,
          dimensions: Object.keys(own.selection).length,
          variants,
        };
      }),
    );
    found.push(...batch.filter((p): p is VariantProduct => !!p));
    if (
      found.some((p) => p.dimensions === 1) &&
      found.some((p) => p.dimensions > 1)
    )
      break;
  }
  discovered = found;
  return found;
}

async function productOf(page: Page, dimensions: 'one' | 'several') {
  const products = await discoverVariantProducts(page);
  const product = products.find((p) =>
    dimensions === 'one' ? p.dimensions === 1 : p.dimensions > 1,
  );
  outOfScope(
    !product,
    'fixture-missing',
    `no product with ${dimensions === 'one' ? 'one variant dimension' : 'two or more variant dimensions'} in the catalogue sample`,
  );
  return product!;
}

async function canonicalPath(page: Page, alias: string): Promise<string> {
  const res = await page.request.get(`/api/products/${alias}`);
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return (body.product ?? body).canonicalUrl as string;
}

async function openProduct(page: Page, alias: string) {
  await page.goto(`/p/${alias}`);
  await page.waitForLoadState('load');
  await waitForHydration(page);
}

/**
 * Pick `value` on `dimension` and return every URL the frame went through on
 * the way, so a detour over a rebuilt path shows up as an extra entry.
 */
async function pick(page: Page, dimension: string, value: string) {
  await page.locator(`[data-testid="variant-trigger-${dimension}"]`).click();
  const option = page.locator(
    `[data-testid="variant-option"][data-value="${value}"]`,
  );
  await expect(option).toBeVisible();
  const visited: string[] = [];
  const onNav = (frame: { url(): string; parentFrame(): unknown }) => {
    if (!frame.parentFrame()) visited.push(new URL(frame.url()).pathname);
  };
  const start = new URL(page.url()).pathname;
  page.on('framenavigated', onNav);
  await option.click();
  return {
    visited,
    start,
    stop: () => page.off('framenavigated', onNav),
  };
}

test.describe('Variant selector', () => {
  test('one dimension: shows the current variant and moves to the picked sibling', async ({
    page,
  }) => {
    await page.goto('/');
    const product = await productOf(page, 'one');
    const own = product.variants.find((v) => v.alias === product.alias)!;
    const [dimension] = Object.keys(own.selection) as [string];
    const target = product.variants.find((v) => v.alias !== product.alias)!;
    const expected = await canonicalPath(page, target.alias);

    await openProduct(page, product.alias);
    await expect(
      page.locator(`[data-testid="variant-trigger-${dimension}"]`),
    ).toHaveText(own.labels[dimension]!);

    const nav = await pick(page, dimension, target.selection[dimension]!);
    await expect(page).toHaveURL((url) => url.pathname === expected);
    await waitForHydration(page);
    nav.stop();

    expect(
      nav.visited.filter((p) => p !== expected && p !== nav.start),
      `detour on the way to ${expected}`,
    ).toEqual([]);
    await expect(
      page.locator(`[data-testid="variant-trigger-${dimension}"]`),
    ).toHaveText(target.labels[dimension]!);
  });

  test('two dimensions: every dimension lists all its values and each pick lands on its sibling', async ({
    page,
  }) => {
    await page.goto('/');
    const product = await productOf(page, 'several');
    const own = product.variants.find((v) => v.alias === product.alias)!;
    const dimensions = Object.keys(own.selection);

    await openProduct(page, product.alias);
    for (const dimension of dimensions) {
      await expect(
        page.locator(`[data-testid="variant-trigger-${dimension}"]`),
      ).toHaveText(own.labels[dimension]!);
    }

    // Every dimension offers every value in the group, not only the ones
    // under the current product's own top node.
    const last = dimensions[dimensions.length - 1]!;
    const lastValues = new Set(product.variants.map((v) => v.selection[last]));
    await page.locator(`[data-testid="variant-trigger-${last}"]`).click();
    await expect(page.locator('[data-testid="variant-option"]')).toHaveCount(
      lastValues.size,
    );
    await page.keyboard.press('Escape');

    for (const dimension of [dimensions[0]!, last]) {
      const target = product.variants.find(
        (v) => v.selection[dimension] !== own.selection[dimension],
      )!;
      const expected = await canonicalPath(page, target.alias);

      await openProduct(page, product.alias);
      const nav = await pick(page, dimension, target.selection[dimension]!);
      await expect(page).toHaveURL((url) => url.pathname === expected);
      await waitForHydration(page);
      nav.stop();

      expect(
        nav.visited.filter((p) => p !== expected && p !== nav.start),
        `detour on the way to ${expected}`,
      ).toEqual([]);
      for (const d of dimensions) {
        await expect(
          page.locator(`[data-testid="variant-trigger-${d}"]`),
        ).toHaveText(target.labels[d]!);
      }
    }
  });
});

test.describe('Variant selector and the cart', () => {
  outOfScope(
    !hasE2ECredentials(),
    'no-credentials',
    'adding to cart needs an authenticated customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
  );
  test.use({ storageState: STORAGE_STATE });

  test('the cart receives the picked variant, not the page it was picked on', async ({
    page,
  }) => {
    await page.goto('/');
    const product = await productOf(page, 'several');
    const own = product.variants.find((v) => v.alias === product.alias)!;
    const [dimension] = Object.keys(own.selection) as [string];
    const target = product.variants.find(
      (v) => v.selection[dimension] !== own.selection[dimension],
    )!;
    const expected = await canonicalPath(page, target.alias);
    const targetRes = await page.request.get(`/api/products/${target.alias}`);
    const targetBody = await targetRes.json();
    const articleNumber = (targetBody.product ?? targetBody).skus[0]
      .articleNumber as string;

    await openProduct(page, product.alias);
    const nav = await pick(page, dimension, target.selection[dimension]!);
    await expect(page).toHaveURL((url) => url.pathname === expected);
    await waitForHydration(page);
    nav.stop();

    const addButton = page
      .locator('[data-testid="add-to-cart-button"]')
      .first();
    outOfScope(
      !(await addButton.isVisible().catch(() => false)),
      'fixture-missing',
      `the picked variant ${target.alias} has no add-to-cart button (out of stock?)`,
    );
    await expect(addButton).toBeEnabled({ timeout: 10000 });
    const [added] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/cart/items') &&
          r.request().method() === 'POST',
      ),
      addButton.click(),
    ]);
    expect(added.ok(), `POST /api/cart/items answered ${added.status()}`).toBe(
      true,
    );
    await expect(page.locator('[data-testid="cart-drawer"]')).toBeVisible();

    const cart = await fetchCart(page);
    expect(cart.items.map((i) => i.articleNumber)).toEqual([articleNumber]);
  });
});
