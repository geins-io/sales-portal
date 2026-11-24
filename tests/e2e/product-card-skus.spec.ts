import { test, expect, type Page } from './fixtures';
import {
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';
import { apiGet } from './api-call';
import { unitsAvailable, type StockedCandidate } from './product-choice';

/**
 * A card cannot pick between SKUs, so a product sold in several shows a link
 * to its page where a product with one shows quantity and add to cart. The
 * product is found through the API; where the catalogue has none in stock,
 * the file is out of scope rather than failing.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'the card offers buying only to a signed-in buyer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

interface ListedProduct {
  alias: string;
  name: string;
  skus?: { skuId: number }[];
  totalStock?: StockedCandidate['stock'];
}

const PAGE_SIZE = 100;

async function productWithSeveralSkus(
  page: Page,
): Promise<ListedProduct | undefined> {
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const response = await apiGet(page.request, '/api/product-lists/products', {
      params: {
        take: String(PAGE_SIZE),
        skip: String(skip),
        filter: JSON.stringify({ sort: 'ALPHABETICAL' }),
      },
    });
    expect(response.ok()).toBe(true);
    const products: ListedProduct[] = (await response.json()).products ?? [];
    for (const product of products) {
      if ((product.skus?.length ?? 0) < 2) continue;
      if (unitsAvailable(product.totalStock) < 1) continue;
      if (await isConfigurable(page, product.alias)) continue;
      return product;
    }
    if (products.length < PAGE_SIZE) return undefined;
  }
}

/**
 * The search ranks a long query's matches differently from call to call, so
 * the card is looked for under the query that finds the product among the
 * fewest results: one of its words, usually.
 */
async function narrowestQuery(
  page: Page,
  product: ListedProduct,
): Promise<string | undefined> {
  let best: { query: string; count: number } | undefined;
  const queries = [product.name, ...product.name.split(/\s+/)].filter(
    (q) => q.length >= 4,
  );
  for (const query of new Set(queries)) {
    const response = await apiGet(page.request, '/api/search/products', {
      params: { query, take: '24' },
    });
    if (!response.ok()) continue;
    const found: { alias?: string }[] = (await response.json()).products ?? [];
    if (!found.some((p) => p.alias === product.alias)) continue;
    if (!best || found.length < best.count) {
      best = { query, count: found.length };
    }
  }
  return best?.query;
}

for (const view of ['grid', 'list'] as const) {
  test(`a ${view} card of a product with several SKUs links to its page instead of adding`, async ({
    page,
    context,
    baseURL,
  }) => {
    const product = await productWithSeveralSkus(page);
    outOfScope(
      !product,
      'fixture-missing',
      'no product in stock is sold in several SKUs',
    );

    const query = await narrowestQuery(page, product!);
    outOfScope(
      !query,
      'fixture-missing',
      `the search finds ${product!.alias} under no query made of its name`,
    );

    await context.addCookies([
      { name: 'plp-view-mode', value: view, url: baseURL! },
    ]);
    await page.goto(`/search?q=${encodeURIComponent(query!)}`);
    await waitForHydration(page);

    const card = page
      .locator('[data-testid="product-card"]:visible')
      .filter({ has: page.getByRole('heading', { name: product!.name }) })
      .first();
    await expect(card).toBeVisible({ timeout: 15000 });

    const link = card.getByTestId('go-to-product-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveText(
      await localeText(page, 'product.go_to_product'),
    );
    await expect(card.getByTestId('add-to-cart-button')).toHaveCount(0);

    const href = await link.getAttribute('href');
    expect(href, 'the link has no href').toBeTruthy();
    await link.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.getByTestId('pdp-top-area')).toBeVisible();
  });
}
