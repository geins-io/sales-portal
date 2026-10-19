import { test, expect } from './fixtures';
import {
  e2eCredentials,
  fillLoginForm,
  hasE2ECredentials,
  outOfScope,
  waitForHydration,
} from './helpers';

/**
 * An organization buyer who signs in on another market lands on the market of
 * their company's delivery country. The switch reads the company and the
 * channel and fails open, so a broken read leaves the buyer where they started
 * with nothing else visibly wrong; this test is what notices.
 *
 * The URL alone cannot tell: the deep-link guard (server/middleware/
 * 01.buyer-market.ts) also redirects a buyer allowed on one market only, so
 * the test reads the switch's own answer on the sign-in response.
 *
 * Runs only on a tenant that serves more than one market. It starts on the
 * first market that is not the default, so a buyer whose company delivers to
 * that market is out of scope; and it takes a market alias to be the country
 * code, so a tenant whose aliases are not country codes is out of scope rather
 * than failing.
 */

test.describe('Buyer market on sign-in', () => {
  test.beforeEach(() => {
    outOfScope(
      !hasE2ECredentials(),
      'no-credentials',
      'signing in needs E2E_USERNAME / E2E_PASSWORD',
    );
  });

  test("moves a buyer who signs in on another market to their company's market", async ({
    page,
    context,
  }) => {
    const configResponse = await page.request.get('/api/config');
    expect(configResponse.ok(), 'GET /api/config must succeed').toBe(true);
    const config = await configResponse.json();
    const markets: string[] = config?.availableMarkets ?? [];
    const defaultMarket: string = config?.market ?? markets[0] ?? '';
    const startMarket = markets.find((m) => m !== defaultMarket);
    outOfScope(
      !startMarket,
      'tenant-config',
      'the tenant serves a single market',
    );
    const locale = String(config?.locale ?? config?.availableLocales?.[0] ?? '')
      .split('-')[0]!
      .toLowerCase();

    // The page navigates away right after sign-in, which discards the
    // response body, so it is read on the way through.
    let switched: { market?: string | null } | undefined;
    let setMarket: string | undefined;
    await page.route('**/api/auth/login', async (route) => {
      const response = await route.fetch();
      switched = await response.json();
      setMarket = response
        .headersArray()
        .filter((h) => h.name.toLowerCase() === 'set-cookie')
        .map((h) => /^market=([^;]*)/.exec(h.value)?.[1])
        .find(Boolean);
      await route.fulfill({ response });
    });

    await page.goto(`/${startMarket}/${locale}/login`);
    await waitForHydration(page);
    await fillLoginForm(page, e2eCredentials.username, e2eCredentials.password);
    const [login] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/auth/login') &&
          r.request().method() === 'POST',
      ),
      page.locator('[data-testid="login-submit"]').click(),
    ]);
    expect(login.ok(), `sign-in answered HTTP ${login.status()}`).toBe(true);

    const companyResponse = await page.request.get('/api/portal/company');
    outOfScope(
      !companyResponse.ok(),
      'tenant-config',
      'the e2e buyer has no company',
    );
    const { company } = await companyResponse.json();
    const addresses: Array<{
      country?: string | null;
      addressType?: string | null;
    }> = company?.addresses ?? [];
    const country = (
      addresses.find(
        (a) => a.country && /shipping|delivery/i.test(a.addressType ?? ''),
      )?.country ??
      addresses.find((a) => a.country)?.country ??
      ''
    ).toLowerCase();
    const buyerMarket = markets.find((m) => m === country);
    outOfScope(
      !buyerMarket || buyerMarket === startMarket,
      'tenant-config',
      `no other market matches the buyer's delivery country "${country}"`,
    );

    expect(
      switched?.market,
      `sign-in must switch a buyer whose company delivers to ${country.toUpperCase()} to ${buyerMarket}`,
    ).toBe(buyerMarket);
    expect(setMarket, 'sign-in must set the market cookie').toBe(buyerMarket);
    await expect(
      page,
      `a buyer whose company delivers to ${country.toUpperCase()} must leave /${startMarket}/ for /${buyerMarket}/`,
    ).toHaveURL(new RegExp(`/${buyerMarket}/${locale}/`), { timeout: 20000 });
    const marketCookie = (await context.cookies()).find(
      (c) => c.name === 'market',
    );
    expect(marketCookie?.value).toBe(buyerMarket);
  });
});
