import { test, expect, type Page, type Response } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  fetchQuote,
  fetchQuoteList,
  isE2EData,
  SENT_QUOTE_STATUSES,
  findSentQuote,
  readPrice,
  setVatDisplay,
  signedInState,
  type ApiQuote,
} from './helpers';
import { apiGet } from './api-call';
import {
  PAGE_TIMEOUT,
  fetchListedQuotes,
  fetchPendingQuoteIds,
  readItemLines,
  TWO_DECIMALS,
} from './portal-shared';

/**
 * Portal E2E Tests: the quotation list, the quotation page and their
 * amounts.
 *
 * The other portal areas have their own portal-*.spec.ts files, so the CI legs
 * can share the portal out. All portal pages require authentication, so the
 * file skips without a test account. Tests handle empty states since the
 * account may have no data.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'portal pages need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

// Per-test login would exceed the 5-per-minute login rate limit.
test.use({ storageState: signedInState });

/**
 * The newest quotation a seller has sent. The buyer's own requests sit in the
 * same list and show no seller data yet, and new ones keep arriving on top,
 * so a test that reads seller data cannot take the first row.
 */
async function fetchSentQuoteId(page: Page): Promise<string> {
  const sent = (await fetchListedQuotes(page)).find((quote) =>
    SENT_QUOTE_STATUSES.includes(quote.status),
  );
  expect(
    sent,
    'the test account has no quotation a seller has sent — the fixture is broken',
  ).toBeDefined();
  return sent!.id;
}

/**
 * Choose a tab on the quotations list. The newest sent quotation is the first
 * row on Offerter, while on Alla the drafts come first and can push it past
 * page 1.
 */
async function chooseQuotationsTab(page: Page, filter: string) {
  const tab = page.locator(`[data-testid="quotations-filter-${filter}"]`);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/** A page of the quotation list as `/api/quotes` answers it. */
interface ListRead {
  quotes: {
    id: string;
    name?: string;
    quoteNumber: string;
    createdAt: string;
  }[];
  total: number;
}

/** The next read of the quotation list whose query `match` takes. */
function nextListRead(
  page: Page,
  match: (query: URLSearchParams) => boolean,
): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/quotes' &&
      response.request().method() === 'GET' &&
      match(url.searchParams)
    );
  });
}

/**
 * Opens the quotation list from the overview, so the browser makes the list's
 * reads itself, and answers its first page and its tab counts.
 */
async function openQuotationList(
  page: Page,
): Promise<{ list: ListRead; counts: Record<string, number> }> {
  await page.goto('/se/sv/portal');
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const listRead = nextListRead(page, () => true);
  const countsRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/quotes/counts' &&
      response.request().method() === 'GET',
  );
  await page
    .locator('[data-testid="portal-tabs"] a[href$="/portal/quotations"]')
    .click();
  const [list, counts] = await Promise.all([listRead, countsRead]);
  expect(list.ok(), '/api/quotes did not answer 200').toBe(true);
  expect(counts.ok(), '/api/quotes/counts did not answer 200').toBe(true);
  return {
    list: (await list.json()) as ListRead,
    counts: ((await counts.json()) as { counts: Record<string, number> })
      .counts,
  };
}

/** The ids of the rows the list shows, in order. */
function tableRowIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('table [data-testid="quotation-row"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-id')));
}

test.describe('Portal Quotations', () => {
  test('should render quotations page with search', async ({ page }) => {
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Search input
    const searchInput = page.locator('[data-testid="quotations-search"]');
    await expect(searchInput).toBeVisible({ timeout: PAGE_TIMEOUT });
    // The placeholder names the date shape the rows show.
    await expect(searchInput).toHaveAttribute(
      'placeholder',
      'Sök namn, offertnr eller ÅÅÅÅ-MM-DD…',
    );

    // Wait for loading to finish
    const loading = page.locator('[data-testid="quotations-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Either quotations table or empty state
    const quotationsTable = page.locator('[data-testid="quotations-table"]');
    const quotationsEmpty = page.locator('[data-testid="quotations-empty"]');

    const hasTable = await quotationsTable.isVisible().catch(() => false);
    const hasEmpty = await quotationsEmpty.isVisible().catch(() => false);

    // Exactly one of the two: `quotations-table` wraps the non-empty branch,
    // so it exists only when the list has rows. This states the invariant more
    // plainly than `hasTable || hasEmpty`; it does not catch more, since
    // `v-if` / `v-else` already makes both-true impossible. What the rows and
    // headers below assert is the part the old test never had.
    expect(hasTable).not.toBe(hasEmpty);

    if (hasTable) {
      // Both responsive shapes sit in the DOM at once and CSS decides which
      // one shows, so count what is visible. `md` is 768px (Tailwind), the
      // same breakpoint the page's `md:hidden` / `hidden md:block` use.
      const isNarrow = (page.viewportSize()?.width ?? 1280) < 768;

      const visibleRows = quotationsTable.locator(
        '[data-testid="quotation-row"]:visible',
      );
      expect(await visibleRows.count()).toBeGreaterThan(0);

      if (!isNarrow) {
        const headerCells = quotationsTable.locator('thead th:visible');
        const count = await headerCells.count();
        // Expected columns: Quote number, Created, Contact, Total, Status, (actions)
        expect(count).toBeGreaterThanOrEqual(5);
      }
    }
  });

  test('each tab shows the count the server read and its own first page', async ({
    page,
  }) => {
    const { list, counts } = await openQuotationList(page);
    await expect(page.locator('[data-testid="quotations-loading"]')).toBeHidden(
      { timeout: PAGE_TIMEOUT },
    );

    for (const filter of ['all', 'drafts', 'requests', 'quotations']) {
      let read = list;
      if (filter !== 'all') {
        const next = nextListRead(page, (query) => query.get('tab') === filter);
        await chooseQuotationsTab(page, filter);
        read = (await (await next).json()) as ListRead;
      }
      await expect(
        page.locator(`[data-testid="quotations-filter-count-${filter}"]`),
      ).toHaveText(String(counts[filter]));
      expect(read.quotes.length).toBeLessThanOrEqual(20);
      if (read.quotes.length === 0) {
        await expect(
          page.locator('[data-testid="quotations-empty"]'),
        ).toBeVisible();
      } else {
        await expect
          .poll(() => tableRowIds(page))
          .toEqual(read.quotes.map((quote) => quote.id));
      }
    }

    // Alla is newest first, drafts among the rest.
    const created = list.quotes.map((quote) => Date.parse(quote.createdAt));
    expect(created).toEqual([...created].sort((a, b) => b - a));
  });

  test('the list pages past 20 on the server', async ({ page }) => {
    const { list } = await openQuotationList(page);
    outOfScope(
      list.total <= 20,
      'fixture-missing',
      'the test account has 20 quotations or fewer, so the list has one page',
    );

    const summary = page.locator('[data-testid="quotations-count"]');
    await expect(summary).toHaveAttribute('data-total', String(list.total));
    await expect(summary).toHaveAttribute('data-shown', '20');

    const next = nextListRead(page, (query) => query.get('skip') === '20');
    await page.locator('[data-testid="quotations-next"]').click();
    const response = await next;
    expect(new URL(response.url()).searchParams.get('take')).toBe('20');
    const second = (await response.json()) as ListRead;

    expect(second.quotes.length).toBeGreaterThan(0);
    await expect
      .poll(() => tableRowIds(page))
      .toEqual(second.quotes.map((quote) => quote.id));
    await expect(summary).toHaveAttribute('data-total', String(second.total));
  });

  test('the search box searches on the server, by name and by date', async ({
    page,
  }) => {
    const { list } = await openQuotationList(page);
    const named = list.quotes.find(
      (quote) => !isE2EData(quote.name) && (quote.name ?? '').trim().length > 2,
    );
    outOfScope(
      !named,
      'fixture-missing',
      'no quotation on the first page has a name to search for',
    );
    const term = named!.name!.trim();
    const search = page.locator('[data-testid="quotations-search"]');

    const byName = nextListRead(page, (query) => query.get('search') === term);
    await search.fill(term);
    const found = (await (await byName).json()) as ListRead;
    expect(found.quotes.map((quote) => quote.id)).toContain(named!.id);
    for (const quote of found.quotes) {
      expect(
        `${quote.name ?? ''} ${quote.quoteNumber}`.toLowerCase(),
      ).toContain(term.toLowerCase());
    }
    await expect
      .poll(() => tableRowIds(page))
      .toEqual(found.quotes.map((quote) => quote.id));

    // The day as the row writes it, typed back into the box.
    const shown = (
      await page
        .locator(
          `table [data-testid="quotation-row"][data-id="${named!.id}"] [data-testid="quotation-created"]`,
        )
        .innerText()
    ).trim();
    const byDate = nextListRead(page, (query) => query.has('createdFrom'));
    await search.fill(shown);
    const dated = await byDate;
    const query = new URL(dated.url()).searchParams;
    expect(query.has('search'), 'a date is not sent as text').toBe(false);
    expect(query.get('createdBefore')).toBeTruthy();
    const day = (await dated.json()) as ListRead;
    expect(day.quotes.map((quote) => quote.id)).toContain(named!.id);
    await expect
      .poll(() =>
        page
          .locator('table [data-testid="quotation-created"]')
          .allInnerTexts()
          .then((texts) => texts.map((text) => text.trim())),
      )
      .toEqual(day.quotes.map(() => shown));
  });

  test('should navigate from list to populated detail page with all sections', async ({
    page,
  }) => {
    const sentQuoteId = await fetchSentQuoteId(page);

    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for loading to finish
    const loading = page.locator('[data-testid="quotations-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });
    await chooseQuotationsTab(page, 'quotations');

    // Requesting a quotation is the half the platform does not offer; reading
    // one it already holds works, and that is what this test covers. So an
    // empty list here is a broken fixture rather than a scope boundary — it
    // used to be declared as one, which hid every selector below.
    await expect(
      page.locator('[data-testid="quotations-table"]'),
      'the quotations list rendered its empty state — the test account lost its quotations',
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Desktop puts a view link in the row, mobile makes the whole card the
    // link; both are anchors into the quote, so match on the destination
    // rather than on a testid only the desktop one carries. Both shapes are in
    // the DOM at once and CSS decides which one shows, hence `:visible` — the
    // old `.count()` branch saw the hidden desktop link on Mobile Chrome and
    // clicked something nothing renders.
    const quoteLink = page
      .locator(
        `[data-testid="quotations-table"] a[href$="/portal/quotations/${sentQuoteId}"]:visible`,
      )
      .first();
    await expect(
      quoteLink,
      `the list shows no link to quotation ${sentQuoteId} on its first page`,
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
    await quoteLink.click();

    await page.waitForURL(
      new RegExp(`/se/sv/portal/quotations/${sentQuoteId}$`),
      { timeout: PAGE_TIMEOUT },
    );

    // Detail page landed — must NOT be the 404 fallback
    const detail = page.locator('[data-testid="quote-detail"]');
    await expect(detail).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Core header: back link, title, status badge
    await expect(page.locator('[data-testid="back-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="quote-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-badge"]')).toBeVisible();

    // The lines render as a desktop table (`hidden lg:block`) or, below lg,
    // behind a sheet trigger, as on the order page. Assert the shape this
    // project can see and count its rows. `lg` is 1024px (Tailwind).
    const isNarrow = (page.viewportSize()?.width ?? 1280) < 1024;
    if (isNarrow) {
      await page.locator('[data-testid="view-rows-trigger"]').click();
      await expect(page.locator('[data-testid="item-rows-sheet"]')).toBeVisible(
        { timeout: PAGE_TIMEOUT },
      );
    }
    const lineRows = page.locator(
      isNarrow
        ? '[data-testid="item-rows-row"]'
        : '[data-testid="order-item-row"]',
    );
    await expect(lineRows.first()).toBeVisible({ timeout: PAGE_TIMEOUT });
    expect(await lineRows.count()).toBeGreaterThan(0);
    if (isNarrow) await page.keyboard.press('Escape');

    // Sidebar summary and details
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="quote-meta-status"]'),
    ).toBeVisible();
    // The contact row is the seller. A request the buyer sent has no owner
    // until a seller takes it, so the row follows the quotation's data.
    const id = new URL(page.url()).pathname.split('/').pop();
    const response = await apiGet(page.request, `/api/quotes/${id}`);
    expect(response.ok(), `/api/quotes/${id} did not answer 200`).toBe(true);
    const { quote } = (await response.json()) as {
      quote: { seller?: { name: string } | null };
    };
    const saleContact = page.locator('[data-testid="sale-contact"]');
    if (quote.seller) {
      await expect(saleContact).toContainText(quote.seller.name);
    } else {
      await expect(saleContact).toHaveCount(0);
    }

    // Customer and addresses sit in a collapsed card; open it first.
    await page.locator('[data-testid="customer-card-trigger"]').click();
    await expect(page.locator('[data-testid="customer-info"]')).toBeVisible();
    const invoiceAddress = page.locator('[data-testid="invoice-address"]');
    const deliveryAddress = page.locator('[data-testid="delivery-address"]');
    const hasInvoice = await invoiceAddress.isVisible().catch(() => false);
    const hasDelivery = await deliveryAddress.isVisible().catch(() => false);
    // At least one address block should render when the quote has billing data
    expect(hasInvoice || hasDelivery).toBe(true);

    // Back link round-trip — returns to list
    await page.locator('[data-testid="back-link"]').click();
    await page.waitForURL(/\/se\/sv\/portal\/quotations\/?$/, {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quotations-table"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });
  // The store picks which of a quotation's two numbers the buyer sees, on the
  // server; the pages show exactly what the API gives, or no number at all.
  test('the list and the quotation show the number the API gives, or none', async ({
    page,
  }) => {
    const [listed] = await fetchListedQuotes(page);
    expect(listed, 'the test account has no quotations').toBeDefined();
    const id = listed!.id;
    const response = await apiGet(page.request, `/api/quotes/${id}`);
    expect(response.ok(), `/api/quotes/${id} did not answer 200`).toBe(true);
    const { quote } = (await response.json()) as {
      quote: { quoteNumber: string; name?: string };
    };
    const number = quote.quoteNumber;

    await page.goto('/se/sv/portal/quotations');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="quotations-loading"]')).toBeHidden(
      { timeout: PAGE_TIMEOUT },
    );
    // The search reads the number shown, so it finds the row by it.
    await page
      .locator('[data-testid="quotations-search"]')
      .fill(number || quote.name || '');
    // A table row on desktop, a linked card on phones; both are in the DOM.
    const row = page
      .locator(`tr[data-testid="quotation-row"][data-id="${id}"]:visible`)
      .or(
        page.locator(
          `a[data-testid="quotation-row"][href$="/portal/quotations/${id}"]:visible`,
        ),
      );
    const listKind = row.locator('[data-testid="quotation-kind"]');
    if (number) {
      await expect(listKind).toContainText(`· ${number}`);
    } else {
      await expect(listKind).not.toContainText('·');
    }

    await page.goto(`/se/sv/portal/quotations/${id}`);
    await waitForHydration(page);
    const kind = page.locator('[data-testid="quote-kind"]');
    await expect(kind).toBeVisible({ timeout: PAGE_TIMEOUT });
    if (number) {
      await expect(kind).toContainText(`· ${number}`);
    } else {
      await expect(kind).not.toContainText('·');
      await expect(
        page.locator('[data-testid="quote-title"]'),
      ).not.toContainText('#');
    }
  });

  // An answer cannot be undone and the account's quotations are shared test
  // data, so this only opens the dialog and cancels it — it never confirms.
  test('a pending quotation asks before it is declined, offers a message, and cancel changes nothing', async ({
    page,
  }) => {
    // Read before any navigation: leaving a page mid-hydration makes Nuxt
    // reload it, which cancels the next goto.
    const [pendingQuoteId] = await fetchPendingQuoteIds(page);
    outOfScope(
      !pendingQuoteId,
      'fixture-missing',
      'the test account has no pending quotation left to open the dialog on',
    );

    await page.goto(`/se/sv/portal/quotations/${pendingQuoteId!}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="accept-btn"]')).toBeEnabled();

    await page.locator('[data-testid="decline-btn"]').click();
    const dialog = page.locator('[data-testid="quote-action-dialog"]');
    await expect(dialog).toBeVisible({ timeout: PAGE_TIMEOUT });
    await expect(dialog.getByRole('heading')).toHaveText('Avböj offerten?');
    const message = dialog.getByLabel('Meddelande till säljaren (valfritt)');
    await expect(message).toHaveAttribute('maxlength', '4000');
    await message.fill('För dyrt');
    await expect(
      dialog.locator('[data-testid="quote-action-message-count"]'),
    ).toHaveText('8 / 4000');

    await dialog.locator('[data-testid="quote-action-cancel"]').click();
    await expect(dialog).toBeHidden({ timeout: PAGE_TIMEOUT });
    await expect(page.locator('[data-testid="status-badge"]')).toHaveText(
      'Väntande',
    );
    await expect(page.locator('[data-testid="decline-btn"]')).toBeVisible();
  });
});

/**
 * Portal Quotation Values
 *
 * Every amount the quotation surfaces show, against the numbers `/api/quotes`
 * answered with. Numbers, never strings: the list and the detail format the
 * same total with a different number of decimals, and both use a non-breaking
 * space and a decimal comma.
 *
 * This is the only surface where unit price x quantity can be asserted at all.
 * Every order line the storefront produces carries quantity 1, so there the
 * multiplication has no data; a quotation carries lines of 50 and 12. The
 * multiplication is asserted on the API's raw numbers: 12 x 14.875 is 178.50,
 * while 12 x the rendered 14,88 is 178.56, so multiplying what the screen
 * shows would assert the defect rather than catch it.
 *
 * Quotations are chosen by what they contain — a unit price that needs more
 * than two decimals, a quantity above one — never by a fixed id, which would
 * rot the day the account is reseeded.
 */
test.describe('Portal Quotation Values', () => {
  /** What one rendered amount may be off by: the screen rounds to two decimals, the API does not. */
  const ROUNDING = 0.005;

  /**
   * Slack on every tolerance below. 14.88 - 14.875 is 0.005000000000000782 in
   * binary floating point, so a tie against half a cent fails a comparison
   * written exactly.
   */
  const SLACK = 1e-9;

  /** True for a number the screen cannot show exactly, e.g. a unit price of 14.875. */
  function isUnrounded(value: number): boolean {
    return Math.abs(value * 100 - Math.round(value * 100)) > SLACK;
  }

  /**
   * A rendered amount against the raw number behind it.
   *
   * `toBeCloseTo(value, 2)` is the wrong tool here: it demands a difference
   * below half a cent, and a unit price of 14.875 rounds to 14,88 — exactly
   * half a cent away. That is correct rendering, so the tolerance includes it.
   */
  function expectRendered(rendered: number, raw: number, what: string) {
    expect(
      Math.abs(rendered - raw),
      `${what}: the screen shows ${rendered}, the API says ${raw}`,
    ).toBeLessThanOrEqual(ROUNDING + SLACK);
  }

  /**
   * The quotation priced in more than two decimals — the one where a page
   * that rounds before it multiplies lands on a different number than one
   * that multiplies first. Without it the run proves nothing about rounding,
   * so its absence fails rather than passes quietly.
   */
  async function unroundedQuote(page: Page): Promise<ApiQuote> {
    // The inc side: that is where the account's quotations were priced in
    // more than two decimals, so the tests using this set that side too.
    const quote = await findSentQuote(page, 'inc', (candidate) =>
      candidate.items.some((line) => isUnrounded(line.unitPrice)),
    );
    expect(
      quote,
      'no quotation the account can read is priced in more than two decimals, ' +
        'so this run cannot show a page that rounds a unit price before it ' +
        'multiplies. Give a quotation line a unit price like 14.875.',
    ).toBeDefined();
    return quote!;
  }

  async function openQuotationsList(page: Page) {
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="quotations-loading"]')).toBeHidden(
      {
        timeout: PAGE_TIMEOUT,
      },
    );
    await expect(
      page.locator('[data-testid="quotations-table"]'),
      'the quotations list rendered its empty state — the test account lost its quotations',
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
    await chooseQuotationsTab(page, 'quotations');
  }

  async function openQuotationDetail(page: Page, id: string) {
    await page.goto(`/se/sv/portal/quotations/${id}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  }

  for (const side of ['ex', 'inc'] as const) {
    test(`the list, the detail page and the API agree on a quotation total, ${side} VAT`, async ({
      page,
    }) => {
      await setVatDisplay(page, side);
      const sentQuoteId = await fetchSentQuoteId(page);
      await openQuotationsList(page);

      // Both list shapes are in the DOM at once and CSS decides which one
      // shows; the mobile card is the link, the desktop row holds one.
      const toSent = `[href$="/portal/quotations/${sentQuoteId}"]`;
      const row = page
        .locator(`[data-testid="quotation-row"]${toSent}:visible`)
        .or(
          page
            .locator('[data-testid="quotation-row"]:visible')
            .filter({ has: page.locator(`a${toSent}`) }),
        );
      await expect(row).toBeVisible({ timeout: PAGE_TIMEOUT });

      // Desktop puts the view link in a cell of the row, mobile makes the card
      // itself the link. Its href carries the id both endpoints key on, which is
      // the only thing pairing this row's amount with a quotation.
      const innerLink = row.locator('a[href*="/portal/quotations/"]');
      const href = (await innerLink.count())
        ? await innerLink.first().getAttribute('href')
        : await row.getAttribute('href');
      const id = href?.split('/').filter(Boolean).pop();
      expect(id, `no quotation id in the row's link: ${href}`).toBeTruthy();

      const listTotal = await readPrice(
        row.locator('[data-testid="quotation-total"]'),
      );
      await expect(row.locator('[data-testid="quotation-total"]')).toHaveText(
        TWO_DECIMALS,
      );

      const listed = (await fetchQuoteList(page, side)).find(
        (quote) => quote.id === id,
      );
      expect(
        listed,
        `the list endpoint does not report the quotation the row links to: ${id}`,
      ).toBeDefined();
      expectRendered(listTotal, listed!.total, 'the list total');

      const api = await fetchQuote(page, id!, side);
      const other = await fetchQuote(page, id!, side === 'inc' ? 'ex' : 'inc');
      if (api.tax > 0) {
        expect(
          Math.abs(listTotal - other.total),
          'the list shows the other VAT side',
        ).toBeGreaterThan(ROUNDING + SLACK);
      }
      // Both endpoints computed this amount; the strings they format it into
      // differ in decimals, the numbers must not.
      expect(listed!.total).toBeCloseTo(api.total, 2);

      await openQuotationDetail(page, api.id);

      await expect(
        page.locator('[data-testid="order-summary-subtotal"]'),
      ).toHaveText(TWO_DECIMALS);
      expectRendered(
        await readPrice(page.locator('[data-testid="order-summary-total"]')),
        api.total,
        'the detail total',
      );
      expectRendered(
        await readPrice(page.locator('[data-testid="order-summary-subtotal"]')),
        api.subtotal,
        'the subtotal',
      );
      // `tax` maps from the subtotal's VAT and is one number in both modes, so
      // subtotal + tax + shipping is not the total on this page.
      // Each amount is held to the API on its own; an identity between them
      // would fail a correct page.
      expectRendered(
        await readPrice(page.locator('[data-testid="order-summary-tax"]')),
        api.tax,
        'the tax',
      );

      // The row renders only for a priced shipping option, so a quotation
      // without one must show no fee at all rather than a zero.
      if (api.shipping > 0) {
        expectRendered(
          await readPrice(
            page.locator('[data-testid="order-summary-shipping"]'),
          ),
          api.shipping,
          'the shipping fee',
        );
      } else {
        await expect(
          page.locator('[data-testid="order-summary-shipping"]'),
        ).toHaveCount(0);
      }
    });
  }

  test('the quotation lines add up to the subtotal it shows', async ({
    page,
  }) => {
    await setVatDisplay(page, 'inc');
    const api = await unroundedQuote(page);

    const apiSum = api.items.reduce((sum, line) => sum + line.totalPrice, 0);
    expect(apiSum).toBeCloseTo(api.subtotal, 2);

    await openQuotationDetail(page, api.id);
    const lines = await readItemLines(page);
    expect(lines.length).toBe(api.items.length);

    const screenSubtotal = await readPrice(
      page.locator('[data-testid="order-summary-subtotal"]'),
    );
    const screenSum = lines.reduce((sum, line) => sum + line.totalPrice, 0);
    // Every rendered amount carries its own rounding, the subtotal included.
    expect(Math.abs(screenSum - screenSubtotal)).toBeLessThanOrEqual(
      (lines.length + 1) * ROUNDING + SLACK,
    );
  });

  test('a line priced in more than two decimals still multiplies out', async ({
    page,
  }) => {
    await setVatDisplay(page, 'inc');
    const api = await unroundedQuote(page);
    expect(
      api.items.filter((line) => line.quantity > 1).length,
      'every line of the quotation carries quantity 1, which makes the ' +
        'multiplication below unfalsifiable — 12 of a product must stay one ' +
        'line of twelve.',
    ).toBeGreaterThan(0);

    await openQuotationDetail(page, api.id);
    const lines = await readItemLines(page);
    expect(lines.length).toBe(api.items.length);

    for (const [index, line] of lines.entries()) {
      const apiLine = api.items[index]!;
      expect(line.quantity).toBe(apiLine.quantity);
      expectRendered(
        line.unitPrice,
        apiLine.unitPrice,
        `line ${index} unit price`,
      );
      expectRendered(
        line.totalPrice,
        apiLine.totalPrice,
        `line ${index} total`,
      );

      // The multiplication itself, on the raw numbers: 12 x 14.875 = 178.50
      // exactly. On screen the unit price is already rounded to two decimals,
      // so its product drifts with the quantity and gets the tolerance — the
      // rendered line total is the one held to the API above.
      expect(apiLine.totalPrice).toBeCloseTo(
        apiLine.unitPrice * apiLine.quantity,
        2,
      );
      if (apiLine.quantity <= 1) continue;
      expect(
        Math.abs(line.totalPrice - line.unitPrice * line.quantity),
      ).toBeLessThanOrEqual((apiLine.quantity + 1) * ROUNDING + SLACK);
    }
  });
});
