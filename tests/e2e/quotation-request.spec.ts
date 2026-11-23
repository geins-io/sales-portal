import { test, expect, type Page, type Route } from './fixtures';
import {
  hasE2ECredentials,
  openInApp,
  outOfScope,
  signedInState,
} from './helpers';
import { apiGet, apiRoute, isApiCall } from './api-call';

/**
 * The "Skicka offertförfrågan" page. Sending a request cannot be undone, so
 * every quotation call is answered by the test and never reaches Geins. The
 * quotation is read in the browser after an in-app navigation, which is what
 * lets the test answer the read too.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'quotations need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

const PAGE_TIMEOUT = 20000;
const QUOTE_ID = 'e2e-request-draft';
const LIST_PATH = '/se/sv/portal/quotations';
const VIEW_PATH = `${LIST_PATH}/${QUOTE_ID}`;

const SEK = { code: 'SEK' };
const CONFIGURED_PRICE = {
  sellingPriceIncVat: 29256.7,
  sellingPriceExVat: 23405.36,
  vat: 5851.34,
  currency: SEK,
};

/** A line brought over from a configured cart line, as the API maps it. */
const CONFIGURED_LINE = {
  productId: 1001,
  id: 'e2e-line-configured',
  skuId: 1001,
  name: 'E2E Configured Display',
  articleNumber: 'CFG-001',
  quantity: 1,
  unitPrice: 29256.7,
  unitPriceFormatted: '29 256,70 kr',
  totalPrice: 29256.7,
  totalPriceFormatted: '29 256,70 kr',
  unitPriceExVat: 23405.36,
  unitPriceExVatFormatted: '23 405,36 kr',
  totalPriceExVat: 23405.36,
  totalPriceExVatFormatted: '23 405,36 kr',
  configuration: {
    configurationId: 'e2e-configuration',
    summary: [{ label: 'Panel', value: 'E2E 55" panel' }],
    sections: [
      {
        name: 'Configuration',
        sortIndex: 1,
        variables: [],
        optionGroups: [
          {
            id: 'e2e-group',
            name: 'Panel',
            sortIndex: 1,
            options: [
              {
                name: 'E2E 55" panel',
                quantity: 1,
                unitPrice: {
                  sellingPriceIncVat: 1250,
                  sellingPriceExVat: 1000,
                  vat: 250,
                  currency: SEK,
                },
              },
            ],
            optionGroups: [],
          },
        ],
        sections: [],
      },
    ],
  },
  linePrices: { unit: CONFIGURED_PRICE, total: CONFIGURED_PRICE },
};

function makeQuote(status: string, extraLines: object[] = []) {
  return {
    id: QUOTE_ID,
    quoteNumber: '2611-2-0099-00',
    createdBy: 'buyer@example.com',
    contactName: 'E2E Buyer',
    contactEmail: 'buyer@example.com',
    status,
    name: 'Spring restock',
    lineItems: [
      {
        productId: 1025,
        id: 'e2e-line-1025',
        skuId: 1025,
        name: 'E2E Widget',
        articleNumber: 'E2E-1025',
        quantity: 10,
        unitPrice: 43.75,
        unitPriceFormatted: '43,75 kr',
        totalPrice: 437.5,
        totalPriceFormatted: '437,50 kr',
        unitPriceExVat: 35,
        unitPriceExVatFormatted: '35,00 kr',
        totalPriceExVat: 350,
        totalPriceExVatFormatted: '350,00 kr',
      },
      ...extraLines,
    ],
    subtotal: 437.5,
    subtotalFormatted: '437,50 kr',
    tax: 87.5,
    taxFormatted: '87,50 kr',
    shipping: 0,
    shippingFormatted: '',
    total: 437.5,
    totalFormatted: '437,50 kr',
    subtotalExVat: 350,
    subtotalExVatFormatted: '350,00 kr',
    shippingExVat: 0,
    shippingExVatFormatted: '',
    totalExVat: 350,
    totalExVatFormatted: '350,00 kr',
    currency: 'SEK',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
  };
}

interface Calls {
  patch: unknown[];
  release: number;
  messages: { message: string; answerRef?: string }[];
  deleted: string[];
}

/**
 * Answers the quotation's read, its thread, details write, release, and
 * the messages the buyer writes, which the thread then holds until deleted.
 * Nothing follows them, so each may be deleted.
 */
async function answerQuotation(
  page: Page,
  initialStatus: string,
  extraLines: object[] = [],
) {
  const calls: Calls = { patch: [], release: 0, messages: [], deleted: [] };
  const written = () =>
    calls.messages.flatMap((m, i) => {
      if (calls.deleted.includes(writtenId(i))) return [];
      const parent = calls.messages.findIndex(
        (_p, j) => writtenId(j) === m.answerRef,
      );
      return {
        id: writtenId(i),
        at: new Date(Date.UTC(2026, 10, 16, 10, i)).toISOString(),
        side: 'buyer',
        authorName: 'E2E Buyer',
        text: m.message,
        deletable: true,
        ...(parent >= 0 && {
          replyTo: {
            authorName: 'E2E Buyer',
            text: calls.messages[parent]!.message,
          },
        }),
      };
    });
  let status = initialStatus;
  // Once sent, the quotation reads back what the details write carried.
  let sent: object | undefined;
  const quote = () => ({
    ...makeQuote(status, extraLines),
    ...(status === 'request_draft' || !sent ? {} : { request: sent }),
  });
  await page.route(
    apiRoute(`/api/quotes/${QUOTE_ID}/**`),
    async (route: Route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/request') && request.method() === 'PATCH') {
        sent = request.postDataJSON();
        calls.patch.push(sent);
        return route.fulfill({ json: { quote: quote() } });
      }
      if (
        isApiCall(request.url(), `/api/quotes/${QUOTE_ID}/messages`) &&
        request.method() === 'POST'
      ) {
        calls.messages.push(request.postDataJSON());
        return route.fulfill({
          json: { message: { id: writtenId(calls.messages.length - 1) } },
        });
      }
      if (
        isApiCall(request.url(), `/api/quotes/${QUOTE_ID}/messages/*`) &&
        request.method() === 'DELETE'
      ) {
        calls.deleted.push(path.split('/').pop()!);
        return route.fulfill({ json: { deleted: true } });
      }
      // Once sent, the thread holds the request comment, as Geins writes it.
      if (
        isApiCall(request.url(), `/api/quotes/${QUOTE_ID}/messages`) &&
        request.method() === 'GET'
      ) {
        const comment = (sent as { comment?: string } | undefined)?.comment;
        const entries =
          status === 'request_draft' || !comment
            ? []
            : [
                {
                  id: 'e2e-comment',
                  at: new Date().toISOString(),
                  side: 'buyer',
                  authorName: 'E2E Buyer',
                  text: comment,
                  event: {
                    type: 'request_sent',
                    from: 'request_draft',
                    to: 'requested',
                  },
                },
              ];
        const all = [...entries, ...written()];
        return route.fulfill({
          json: { thread: { entries: all, messageCount: all.length } },
        });
      }
      if (path.endsWith('/release') && request.method() === 'POST') {
        calls.release += 1;
        status = 'requested';
        return route.fulfill({ json: { quote: quote() } });
      }
      if (request.method() === 'GET') {
        return route.fulfill({ json: { quote: quote() } });
      }
      return route.fallback();
    },
  );
  return calls;
}

/** A Guid for the n-th message the buyer writes, as Geins ids look. */
const writtenId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test.describe('Send a quote request', () => {
  test('sends the entered details, then the request, and shows them on the sent page and in the view', async ({
    page,
  }) => {
    const calls = await answerQuotation(page, 'request_draft');

    await openInApp(page, LIST_PATH, `${VIEW_PATH}/request`);
    await expect(
      page.locator('[data-testid="quote-request-page"]'),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    await expect(
      page.locator('[data-testid="quote-request-title"]'),
    ).toContainText('Spring restock');
    // A table from md up, cards below it.
    await expect(
      page.locator(
        '[data-testid="line-item-row"]:visible, [data-testid="line-item-card"]:visible',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-testid="quote-articles"] input'),
    ).toHaveCount(0);
    await expect(page.locator('#checkout-terms-checkbox')).toHaveCount(0);

    const date = new Date();
    date.setDate(date.getDate() + 30);
    const desired = date.toLocaleDateString('en-CA');
    await page
      .locator('[data-testid="checkout-desired-delivery-date"]')
      .fill(desired);
    await page
      .locator('[data-testid="checkout-customer-order-number"]')
      .fill('PO-E2E-77');
    await page
      .locator('[data-testid="checkout-goods-label"]')
      .fill('Lastbrygga B');
    await page
      .locator('[data-testid="quote-request-message"]')
      .fill('Leverans till lager 2');

    await page.locator('[data-testid="place-order-button"]').click();
    await page.waitForURL(new RegExp(`${VIEW_PATH}/sent$`), {
      timeout: PAGE_TIMEOUT,
    });

    expect(calls.patch).toEqual([
      {
        desiredDeliveryDate: desired,
        customerOrderNumber: 'PO-E2E-77',
        goodsLabel: 'Lastbrygga B',
        comment: 'Leverans till lager 2',
      },
    ]);
    expect(calls.release).toBe(1);
    const thanks = page.locator('[data-testid="quote-thanks"]');
    await expect(thanks).toBeVisible({ timeout: PAGE_TIMEOUT });
    await expect(thanks).toHaveAttribute('data-kind', 'request');
    await expect(
      page.locator('[data-testid="quote-thanks-number"]'),
    ).toContainText(makeQuote('requested').quoteNumber);
    await expect(
      page.locator('[data-testid="quote-thanks-contents"]'),
    ).toBeVisible();
    const sentInfo = page.locator('[data-testid="quote-thanks-request"]');
    await expect(sentInfo).toBeVisible();
    await expect(
      sentInfo.locator('[data-testid="quote-thanks-your-reference"]'),
    ).toContainText('PO-E2E-77');
    await expect(
      sentInfo.locator('[data-testid="quote-thanks-desired-date"]'),
    ).toContainText(desired);
    await expect(
      sentInfo.locator('[data-testid="quote-thanks-goods-label"]'),
    ).toContainText('Lastbrygga B');
    await expect(
      sentInfo.locator('[data-testid="quote-thanks-comment"]'),
    ).toHaveText('Ditt meddelande: Leverans till lager 2');

    await page.locator('[data-testid="quote-thanks-portal"]').click();
    await page.waitForURL(new RegExp(`${VIEW_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
    const meta = page.locator('[data-testid="quote-meta"]');
    await expect(
      meta.locator('[data-testid="quote-meta-your-reference"]'),
    ).toContainText('PO-E2E-77');
    await expect(
      meta.locator('[data-testid="quote-meta-desired-date"]'),
    ).toContainText(String(date.getFullYear()));
    await expect(
      meta.locator('[data-testid="quote-meta-goods-label"]'),
    ).toContainText('Lastbrygga B');
    // The comment is read in the thread, as the request it was sent with.
    await expect(
      meta.locator('[data-testid="quote-meta-comment"]'),
    ).toHaveCount(0);
    const open = page.locator('[data-testid="quote-thread-open"]');
    await expect(open.locator('[data-testid="quote-thread-count"]')).toHaveText(
      '1',
    );
    await open.click();
    const entry = page.locator(
      '[data-testid="quote-thread"] [data-testid="quote-thread-entry"]',
    );
    await expect(entry).toHaveCount(1, { timeout: PAGE_TIMEOUT });
    await expect(entry).toHaveAttribute('data-side', 'buyer');
    await expect(
      entry.locator('[data-testid="quote-thread-event"]'),
    ).toHaveText('skickade förfrågan');
    await expect(entry.locator('[data-testid="quote-thread-text"]')).toHaveText(
      'Leverans till lager 2',
    );
  });

  test('shows a configured line with its configuration', async ({ page }) => {
    await answerQuotation(page, 'request_draft', [CONFIGURED_LINE]);

    await openInApp(page, LIST_PATH, `${VIEW_PATH}/request`);
    await expect(
      page.locator('[data-testid="quote-request-page"]'),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    // A table from md up, cards below it: the visible one carries the line.
    const line = page
      .locator(
        '[data-testid="line-item-row"]:visible, [data-testid="line-item-card"]:visible',
      )
      .nth(1);
    await expect(line).toContainText('E2E Configured Display');
    await expect(line.getByTestId('line-item-configured')).toBeVisible();
    // On the side of the buyer's VAT choice.
    await expect(line).toContainText(/23 405,36 kr|29 256,70 kr/);
    await expect(
      page
        .locator(
          '[data-testid="line-item-row"]:visible, [data-testid="line-item-card"]:visible',
        )
        .first()
        .getByTestId('line-specification-open'),
    ).toHaveCount(0);

    await line.getByTestId('line-specification-open').click();
    const specification = page.getByTestId('line-specification-sheet');
    await expect(specification).toBeInViewport({ ratio: 1 });
    await expect(specification).toContainText('Panel');
    await expect(specification).toContainText('E2E 55" panel');
    await expect(
      specification.getByTestId('line-specification-net'),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(specification).toBeHidden();
  });

  test('opens the estimate note on click and keeps it open until dismissed', async ({
    page,
  }) => {
    await answerQuotation(page, 'request_draft');

    await openInApp(page, LIST_PATH, `${VIEW_PATH}/request`);
    const badge = page.locator('[data-testid="quote-estimate-badge"]');
    await expect(badge).toBeVisible({ timeout: PAGE_TIMEOUT });
    const note = page.locator('[data-testid="quote-estimate-note"]');
    await expect(note).toHaveCount(0);

    await badge.click();
    await expect(note).toBeVisible();
    await expect(note).toContainText('bekräftas av din säljare');
    // Not a hover tooltip: moving away leaves it open.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    await expect(note).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(note).toHaveCount(0);

    await badge.click();
    await expect(note).toBeVisible();
    await page.locator('[data-testid="quote-request-title"]').click();
    await expect(note).toHaveCount(0);
  });

  test('keeps the request on the page when sending fails', async ({ page }) => {
    await answerQuotation(page, 'request_draft');
    await page.route(apiRoute(`/api/quotes/${QUOTE_ID}/release`), (route) =>
      route.fulfill({ status: 502, json: { message: 'Bad gateway' } }),
    );

    await openInApp(page, LIST_PATH, `${VIEW_PATH}/request`);
    await expect(
      page.locator('[data-testid="quote-request-page"]'),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    await page.locator('[data-testid="place-order-button"]').click();
    await expect(
      page.locator('[data-testid="quote-request-error"]'),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${VIEW_PATH}/request$`));
  });

  test('sends a quotation that is not sent from the sent page to the quotation view', async ({
    page,
  }) => {
    await answerQuotation(page, 'pending');

    await openInApp(page, LIST_PATH, `${VIEW_PATH}/sent`);
    await page.waitForURL(new RegExp(`${VIEW_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });

  test('sends a quotation that is not a draft to the quotation view', async ({
    page,
  }) => {
    await answerQuotation(page, 'pending');

    await openInApp(page, LIST_PATH, `${VIEW_PATH}/request`);
    await page.waitForURL(new RegExp(`${VIEW_PATH}$`), {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quote-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });
});

/** Whether this tenant lets the buyer write in the quote log: `quotes` and `quoteConversation` on. */
async function quoteConversationOn(page: Page): Promise<boolean> {
  const response = await apiGet(page.request, '/api/config');
  expect(response.ok(), '/api/config did not answer 200').toBe(true);
  const { features } = await response.json();
  return (
    features?.quotes?.enabled === true &&
    features?.quoteConversation?.enabled === true
  );
}

test.describe('Read the quote log with the conversation off', () => {
  test.beforeEach(async ({ page }) => {
    outOfScope(
      await quoteConversationOn(page),
      'tenant-config',
      'quoteConversation is on for this tenant',
    );
  });

  test('shows the log to read, with no field, and an empty text that asks for nothing', async ({
    page,
  }) => {
    await answerQuotation(page, 'requested');
    await openInApp(page, LIST_PATH, VIEW_PATH);
    const open = page.locator('[data-testid="quote-thread-open"]');
    await expect(open).toHaveText(/Offertlogg/, { timeout: PAGE_TIMEOUT });
    await expect(open.locator('svg')).toHaveCount(0);
    await open.click();

    const log = page.locator('[data-testid="quote-thread"]');
    await expect(log.locator('[data-testid="quote-thread-empty"]')).toHaveText(
      'Inga meddelanden än.',
      { timeout: PAGE_TIMEOUT },
    );
    await expect(log.locator('[data-testid="quote-thread-input"]')).toHaveCount(
      0,
    );
    await expect(log.locator('[data-testid="quote-thread-more"]')).toHaveCount(
      0,
    );
  });
});

test.describe('Write in the quote log', () => {
  test.beforeEach(async ({ page }) => {
    outOfScope(
      !(await quoteConversationOn(page)),
      'tenant-config',
      'quotes or quoteConversation is off for this tenant',
    );
  });

  test('writes a message, then replies to it, and the thread shows both', async ({
    page,
  }) => {
    const calls = await answerQuotation(page, 'requested');
    await openInApp(page, LIST_PATH, VIEW_PATH);
    const open = page.locator('[data-testid="quote-thread-open"]');
    await expect(open).toHaveText(/Offertlogg/, { timeout: PAGE_TIMEOUT });
    await expect(open.locator('svg')).toHaveCount(1);
    await open.click();

    const log = page.locator('[data-testid="quote-thread"]');
    await expect(log.locator('[data-testid="quote-thread-empty"]')).toHaveText(
      'Inga meddelanden än. Skriv till din säljare om du har frågor om offerten.',
      { timeout: PAGE_TIMEOUT },
    );
    const input = log.locator('[data-testid="quote-thread-input"]');
    const send = log.locator('[data-testid="quote-thread-send"]');
    await expect(send).toBeDisabled();

    await input.fill('Går det att få dem i gult?');
    await input.press('ControlOrMeta+Enter');

    const entries = log.locator('[data-testid="quote-thread-entry"]');
    await expect(entries).toHaveCount(1, { timeout: PAGE_TIMEOUT });
    await expect(input).toHaveValue('');
    await expect(open.locator('[data-testid="quote-thread-count"]')).toHaveText(
      '1',
    );

    await entries.first().locator('[data-testid="quote-thread-more"]').click();
    await page.locator('[data-testid="quote-thread-reply-action"]').click();
    await expect(
      log.locator('[data-testid="quote-thread-replying"]'),
    ).toContainText('Svarar E2E Buyer');
    await expect(input).toBeFocused();
    await input.fill('Eller i blått.');
    await send.click();

    await expect(entries).toHaveCount(2, { timeout: PAGE_TIMEOUT });
    await expect(
      entries.nth(1).locator('[data-testid="quote-thread-reply"]'),
    ).toContainText('Går det att få dem i gult?');
    await expect(
      log.locator('[data-testid="quote-thread-replying"]'),
    ).toHaveCount(0);
    expect(calls.messages).toEqual([
      { message: 'Går det att få dem i gult?' },
      { message: 'Eller i blått.', answerRef: writtenId(0) },
    ]);
  });

  test('keeps the text when a send fails, and says so', async ({ page }) => {
    await answerQuotation(page, 'requested');
    await page.route(
      apiRoute(`/api/quotes/${QUOTE_ID}/messages`),
      async (route: Route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 502, json: { message: 'Bad Gateway' } })
          : route.fallback(),
    );
    await openInApp(page, LIST_PATH, VIEW_PATH);
    await page
      .locator('[data-testid="quote-thread-open"]')
      .click({ timeout: PAGE_TIMEOUT });

    const log = page.locator('[data-testid="quote-thread"]');
    const input = log.locator('[data-testid="quote-thread-input"]');
    await input.fill('Hej');
    await log.locator('[data-testid="quote-thread-send"]').click();

    await expect(
      log.locator('[data-testid="quote-thread-send-error"]'),
    ).toHaveText('Meddelandet kunde inte skickas. Försök igen.', {
      timeout: PAGE_TIMEOUT,
    });
    await expect(input).toHaveValue('Hej');
  });

  test('deletes a message after asking, and the other stays', async ({
    page,
  }) => {
    const calls = await answerQuotation(page, 'requested');
    await openInApp(page, LIST_PATH, VIEW_PATH);
    const open = page.locator('[data-testid="quote-thread-open"]');
    await expect(open).toHaveText(/Offertlogg/, { timeout: PAGE_TIMEOUT });
    await open.click();
    const log = page.locator('[data-testid="quote-thread"]');
    const input = log.locator('[data-testid="quote-thread-input"]');
    const entries = log.locator('[data-testid="quote-thread-entry"]');
    for (const [n, text] of ['Första.', 'Andra.'].entries()) {
      await input.fill(text);
      await input.press('ControlOrMeta+Enter');
      await expect(entries).toHaveCount(n + 1, { timeout: PAGE_TIMEOUT });
    }

    await entries.first().locator('[data-testid="quote-thread-more"]').click();
    await page.locator('[data-testid="quote-thread-delete-action"]').click();
    const dialog = page.locator('[data-testid="quote-action-dialog"]');
    await expect(dialog).toContainText('Radera meddelandet?');
    await expect(dialog).toContainText(
      'Meddelandet tas bort för både dig och säljaren.',
    );
    await dialog.locator('[data-testid="quote-action-confirm"]').click();

    await expect(dialog).toHaveCount(0);
    await expect(entries).toHaveCount(1, { timeout: PAGE_TIMEOUT });
    await expect(entries.first()).toContainText('Andra.');
    await expect(input).toBeFocused();
    expect(calls.deleted).toEqual([writtenId(0)]);
  });

  test('says so when the message was locked meanwhile, and shows what came in', async ({
    page,
  }) => {
    await answerQuotation(page, 'requested');
    let answered = false;
    await page.route(
      apiRoute(`/api/quotes/${QUOTE_ID}/messages/**`),
      async (route: Route) => {
        if (route.request().method() !== 'DELETE') return route.fallback();
        answered = true;
        return route.fulfill({ status: 409, json: { message: 'Conflict' } });
      },
    );
    await page.route(
      apiRoute(`/api/quotes/${QUOTE_ID}/messages`),
      async (route: Route) => {
        if (!answered || route.request().method() !== 'GET') {
          return route.fallback();
        }
        const entries = [
          {
            id: writtenId(0),
            at: '2026-11-16T10:00:00.000Z',
            side: 'buyer',
            authorName: 'E2E Buyer',
            text: 'Ja, det kör vi på.',
          },
          {
            id: 'e2e-answer',
            at: '2026-11-16T10:01:00.000Z',
            side: 'seller',
            authorName: 'E2E Seller',
            text: 'Då beställer vi.',
          },
        ];
        return route.fulfill({
          json: { thread: { entries, messageCount: entries.length } },
        });
      },
    );
    await openInApp(page, LIST_PATH, VIEW_PATH);
    const open = page.locator('[data-testid="quote-thread-open"]');
    await expect(open).toHaveText(/Offertlogg/, { timeout: PAGE_TIMEOUT });
    await open.click();
    const log = page.locator('[data-testid="quote-thread"]');
    const input = log.locator('[data-testid="quote-thread-input"]');
    const entries = log.locator('[data-testid="quote-thread-entry"]');
    await input.fill('Ja, det kör vi på.');
    await input.press('ControlOrMeta+Enter');
    await expect(entries).toHaveCount(1, { timeout: PAGE_TIMEOUT });

    await entries.first().locator('[data-testid="quote-thread-more"]').click();
    await page.locator('[data-testid="quote-thread-delete-action"]').click();
    await page
      .locator('[data-testid="quote-action-dialog"]')
      .locator('[data-testid="quote-action-confirm"]')
      .click();

    await expect(log.locator('[data-testid="quote-thread-notice"]')).toHaveText(
      'Meddelandet kan inte längre raderas. Säljaren har svarat eller offerten har ändrats.',
      { timeout: PAGE_TIMEOUT },
    );
    await expect(entries).toHaveCount(2);
    await expect(entries.last()).toBeInViewport();
    await entries.first().locator('[data-testid="quote-thread-more"]').click();
    await expect(
      page.locator('[data-testid="quote-thread-delete-action"]'),
    ).toHaveCount(0);
  });
});
