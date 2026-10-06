import { test, expect, type APIRequestContext } from '@playwright/test';
import { outOfScope, waitForHydration } from './helpers';
import { BASE_URL } from './target';

/**
 * Second-market category page, signed out.
 *
 * SSR and the hydrating client must fetch under the same market. The server
 * reads cookies from the request, so a first visit to a second market carries
 * no cookie (or the previous market's) while the response sets the URL's. When
 * the market came from the cookie, the client's payload keys missed and the
 * page threw a 404 after hydration, with the server HTML still looking right.
 *
 * Runs only on a tenant that serves more than one market.
 */

interface MarketTarget {
  defaultMarket: string;
  market: string;
  locale: string;
  categoryPath: string;
}

async function secondMarketTarget(
  request: APIRequestContext,
): Promise<MarketTarget | null> {
  const response = await request.get('/api/config');
  expect(response.ok(), 'GET /api/config must succeed').toBe(true);
  const config = await response.json();

  const markets: string[] = config?.availableMarkets ?? [];
  const defaultMarket: string = config?.market ?? markets[0] ?? '';
  const market = markets.find((m) => m !== defaultMarket);
  if (!market) return null;

  const locale = String(config?.locale ?? config?.availableLocales?.[0] ?? '')
    .split('-')[0]!
    .toLowerCase();
  expect(locale, 'tenant config must carry a locale').not.toBe('');

  const menuResponse = await request.get('/api/cms/menu', {
    params: { menuLocationId: 'main', locale, market },
  });
  expect(menuResponse.ok(), 'GET /api/cms/menu must succeed').toBe(true);
  const menu = await menuResponse.json();
  const category = (menu?.menuItems ?? []).find(
    (item: { type?: string; canonicalUrl?: string }) =>
      item.type === 'category' &&
      item.canonicalUrl?.startsWith(`/${market}/${locale}/c/`),
  );
  expect(
    category,
    `the main menu must list a category on market ${market}`,
  ).toBeTruthy();

  return {
    defaultMarket,
    market,
    locale,
    categoryPath: category.canonicalUrl,
  };
}

test.describe('Second-market category page', () => {
  let target: MarketTarget | null = null;

  test.beforeAll(async ({ request }) => {
    target = await secondMarketTarget(request);
  });

  test.beforeEach(() => {
    outOfScope(
      target === null,
      'tenant-config',
      'the tenant serves a single market',
    );
  });

  async function expectListedOnMarket(
    page: import('@playwright/test').Page,
    market: string,
  ): Promise<void> {
    await waitForHydration(page);

    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.error-page')).toHaveCount(0);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toMatch(new RegExp(`^/${market}/`));
  }

  test('lists products on a fresh visit', async ({ page }) => {
    const { market, categoryPath } = target!;

    await page.goto(categoryPath);

    await expectListedOnMarket(page, market);
  });

  test('lists products when the cookie still names the default market', async ({
    page,
    context,
  }) => {
    const { defaultMarket, market, categoryPath } = target!;
    await context.addCookies([
      { name: 'market', value: defaultMarket, url: BASE_URL },
    ]);

    await page.goto(categoryPath);

    await expectListedOnMarket(page, market);
  });
});
