import { test, expect, type Page } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  signedInState,
} from './helpers';
import { apiGet } from './api-call';

/**
 * A quotation the seller has sent more than one version of: each version opens
 * on its own page, a replaced one read only, and the picker moves between them.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'quotations need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

const PAGE_TIMEOUT = 20000;

interface Version {
  quotationId: string;
  quoteNumber: string;
  status: string;
  validFrom?: string;
}

interface Chain {
  latest: Version;
  /** An offer the newest replaced. */
  older: Version;
}

/** The first listed quotation whose versions hold the one `pick` wants. */
async function findChain(
  page: Page,
  pick: (rest: Version[]) => Version | undefined,
): Promise<Chain | undefined> {
  const response = await apiGet(page.request, '/api/quotes');
  expect(response.ok(), '/api/quotes did not answer 200').toBe(true);
  const { quotes } = (await response.json()) as { quotes: { id: string }[] };
  for (const listed of quotes) {
    const read = await apiGet(page.request, `/api/quotes/${listed.id}`);
    if (!read.ok()) continue;
    const { quote } = (await read.json()) as {
      quote: { versions: Version[] };
    };
    const [latest, ...rest] = quote.versions;
    const older = pick(rest);
    if (latest && older) return { latest, older };
  }
  return undefined;
}

/** An offer a newer version replaced. */
const replacedOffer = (rest: Version[]) =>
  rest.find((v) => v.validFrom && v.status === 'revised');
/** The buyer's request, last and never sent by the seller, once replaced. */
const replacedRequest = (rest: Version[]) =>
  rest.find((v) => !v.validFrom && v.status === 'revised');

const viewPath = (id: string) => `/se/sv/portal/quotations/${id}`;

async function open(page: Page, id: string) {
  await page.goto(viewPath(id));
  await waitForHydration(page);
  await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
    timeout: PAGE_TIMEOUT,
  });
}

test.describe('Quotation versions', () => {
  test('a replaced version reads Ersatt, offers no answer, and leads to the newest', async ({
    page,
  }) => {
    const chain = await findChain(page, replacedOffer);
    outOfScope(
      !chain,
      'fixture-missing',
      'the test account has no quotation with a replaced offer',
    );
    const { latest, older } = chain!;

    await open(page, older.quotationId);

    await expect(page.locator('[data-testid="status-badge"]')).toHaveText(
      'Ersatt',
    );
    const notice = page.locator('[data-testid="quote-superseded"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(
      older.quoteNumber
        ? `${older.quoteNumber} är ersatt`
        : 'Den här versionen är ersatt',
    );
    for (const id of [
      'accept-btn',
      'decline-btn',
      'quote-withdraw',
      'quote-place-order',
    ]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toHaveCount(0);
    }

    await page.locator('[data-testid="quote-view-latest"]').click();
    await expect(page).toHaveURL(
      new RegExp(`/quotations/${latest.quotationId}$`),
      {
        timeout: PAGE_TIMEOUT,
      },
    );
    await expect(page.locator('[data-testid="quote-superseded"]')).toHaveCount(
      0,
    );
  });

  test("the buyer's request opens as sent, with estimated prices and no answer", async ({
    page,
  }) => {
    const chain = await findChain(page, replacedRequest);
    outOfScope(
      !chain,
      'fixture-missing',
      'the test account has no request the seller has made an offer from',
    );
    const { latest, older: request } = chain!;

    await open(page, request.quotationId);

    await expect(page.locator('[data-testid="quote-kind"]')).toContainText(
      'Offertförfrågan',
    );
    const notice = page.locator('[data-testid="quote-superseded"]');
    await expect(notice).toContainText('Din förfrågan');
    await expect(notice).toContainText(
      'Så här såg förfrågan ut när du skickade den',
    );
    await expect(notice).not.toContainText('ersatt');
    await expect(
      page.locator('[data-testid="quote-meta-status"]'),
    ).toContainText('Förfrågan som du skickade.');
    await expect(
      page.locator('[data-testid="quote-estimate-badge"]'),
    ).toBeVisible();
    for (const id of [
      'accept-btn',
      'decline-btn',
      'quote-withdraw',
      'quote-place-order',
    ]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toHaveCount(0);
    }

    await page.locator('[data-testid="quote-view-latest"]').click();
    await expect(page).toHaveURL(
      new RegExp(`/quotations/${latest.quotationId}$`),
      { timeout: PAGE_TIMEOUT },
    );
  });

  test('the picker opens an older version on its own page', async ({
    page,
  }) => {
    const chain = await findChain(page, replacedOffer);
    outOfScope(
      !chain,
      'fixture-missing',
      'the test account has no quotation with a replaced offer',
    );
    const { latest, older } = chain!;

    await open(page, latest.quotationId);

    const picker = page.locator('[data-testid="quote-revision-select"]');
    await expect(picker).toContainText('Senaste');
    await picker.click();
    await page
      .locator(`[data-testid="quote-version-${older.quotationId}"]`)
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/quotations/${older.quotationId}$`),
      {
        timeout: PAGE_TIMEOUT,
      },
    );
    await expect(
      page.locator('[data-testid="quote-superseded"]'),
    ).toBeVisible();
  });
});
