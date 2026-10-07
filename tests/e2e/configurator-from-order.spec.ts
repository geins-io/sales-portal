import { test, expect, type Page } from '@playwright/test';
import {
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';

/**
 * Opening a configured order row in the configurator, end to end on a real CPQ
 * backend. The row's name links to its configurator page, and the server
 * replays the row's choices into a new session.
 *
 * The order was placed for this spec with one choice off the defaults, so a
 * replay and a fresh start look different: the replayed form holds that
 * choice at its price, and the line added from it carries the order row's
 * summary. That line is removed again; no order is placed.
 *
 * The product is the platform side's configured product on the monitor
 * account. Where it is not configurable — the fixture backend, another tenant —
 * the file is out of scope rather than failing.
 */

const ALIAS = 'digging-bucket-7-20-t';

/** Order 1687 on the monitor account: one configured row, Steel Quality off its default. */
const ORDER_ID = 'e2fcb466-f242-4188-ba35-9c69fccd3dfe';
const ROW = 0;
const GROUP_NAME = 'Steel Quality';
const ORDERED_OPTION = 'Wear resistant steel';
/** The configured net price with that choice, as the order was placed at it. */
const ORDERED_NET = /2\s?647,20/;

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'opening an order row needs a signed-in buyer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

interface SummaryRow {
  label: string;
  value: string;
}

interface WireOption {
  id: string;
  name: string;
}
interface WireGroup {
  id: string;
  name: string;
  options: WireOption[];
}
interface WireSection {
  id: string;
  optionGroups?: WireGroup[];
  sections?: WireSection[];
}

/** Where the group sits in a document, by the provider's own ids. */
function locate(sections: WireSection[]): {
  sectionId: string;
  group: WireGroup;
  orderedId: string;
} {
  const walk = (
    list: WireSection[],
  ): { sectionId: string; group: WireGroup } | null => {
    for (const section of list) {
      const group = section.optionGroups?.find((g) => g.name === GROUP_NAME);
      if (group) return { sectionId: section.id, group };
      const nested = walk(section.sections ?? []);
      if (nested) return nested;
    }
    return null;
  };
  const found = walk(sections);
  expect(found, `${GROUP_NAME} is not in the document`).not.toBeNull();
  const option = found!.group.options.find((o) => o.name === ORDERED_OPTION);
  expect(option, `${ORDERED_OPTION} is not in ${GROUP_NAME}`).toBeDefined();
  return { ...found!, orderedId: option!.id };
}

/**
 * The order row's summary as the API reads it. Retried: the row's
 * configuration is read with a short cap, and a cold backend can miss it once.
 * A read that has answered also warms the order page that follows.
 */
async function orderedSummary(page: Page): Promise<SummaryRow[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await page.request.get(`/api/orders/${ORDER_ID}`);
    expect(
      response.ok(),
      `order ${ORDER_ID} answered ${response.status()} — the test account lost the order this spec was placed for`,
    ).toBe(true);
    const { order } = (await response.json()) as {
      order: {
        cart?: {
          items?: ({ configuration?: { summary: SummaryRow[] } } | null)[];
        };
      };
    };
    const summary = order.cart?.items?.[ROW]?.configuration?.summary;
    if (summary) {
      expect(summary).toContainEqual({
        label: GROUP_NAME,
        value: ORDERED_OPTION,
      });
      return summary;
    }
  }
  throw new Error(
    `order ${ORDER_ID} row ${ROW} reads back without its configuration`,
  );
}

/**
 * The row's name as the buyer finds it: in the table on a wide screen, in the
 * rows sheet on a narrow one.
 */
async function openOrderRow(page: Page): Promise<void> {
  await page.goto(`/se/sv/portal/orders/${ORDER_ID}`);
  await waitForHydration(page);
  const query = `order=${ORDER_ID}&row=${ROW}`;
  // Without its configuration a row links to its product page as before.
  const missing =
    "the order page answered without the row's configuration (its read failed or timed out)";

  const tableRow = page.getByTestId('order-item-row').nth(ROW);
  const tableLink = tableRow.getByTestId('order-item-name-link');
  if (await tableLink.isVisible()) {
    await expect(
      tableRow.getByTestId('cart-item-configuration-toggle'),
      missing,
    ).toBeVisible();
    await expect(tableLink).toHaveAttribute('href', new RegExp(query));
    return tableLink.click();
  }
  await page.getByTestId('view-rows-trigger').click();
  const sheetRow = page.getByTestId('item-rows-row').nth(ROW);
  await expect(
    sheetRow.getByTestId('cart-item-configuration-toggle'),
    missing,
  ).toBeVisible();
  const sheetLink = sheetRow.getByRole('link');
  await expect(sheetLink).toHaveAttribute('href', new RegExp(query));
  await sheetLink.click();
}

function replayResponse(page: Page) {
  return page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/configurations/from-order') &&
      r.request().method() === 'POST',
  );
}

async function openSection(page: Page, sectionId: string): Promise<void> {
  const section = page.locator(
    `[data-testid="configurator-section"][data-section-id="${sectionId}"]`,
  );
  if (await section.isVisible()) return;
  const railEntry = page.locator(
    `[data-testid="configurator-rail-entry"][data-section-id="${sectionId}"]`,
  );
  if (await railEntry.isVisible()) {
    await railEntry.click();
  } else {
    const steps = await page.getByTestId('configurator-rail-entry').count();
    const next = page.getByTestId('configurator-next');
    for (let step = 0; step < steps + 5; step++) {
      if (await section.isVisible()) break;
      await next.click();
    }
  }
  await expect(section).toBeVisible();
}

/** The group's chooser, which names the option the session holds. */
async function chooserOf(page: Page, where: ReturnType<typeof locate>) {
  await openSection(page, where.sectionId);
  return page
    .locator(
      `[data-testid="configurator-group"][data-group-id="${where.group.id}"]`,
    )
    .getByTestId('configurator-group-chooser');
}

/** This host's cart only: the stored session may hold other tenants' cookies. */
async function cartIdOf(page: Page): Promise<string> {
  const id = (await page.context().cookies(page.url())).find(
    (c) => c.name === 'cart_id',
  )?.value;
  expect(id, 'the page holds no cart').toBeTruthy();
  return id!;
}

test.describe('Opening a configured order row', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    outOfScope(
      !(await isConfigurable(page, ALIAS)),
      'tenant-config',
      `${ALIAS} is not configurable on this target (it is on the monitor account with the merchant-api or composite backend)`,
    );
  });

  test("opens the configurator holding the row's choices at their price, and the line it adds carries the order's configuration", async ({
    page,
  }) => {
    const summary = await orderedSummary(page);

    const replayed = replayResponse(page);
    await openOrderRow(page);
    const response = await replayed;

    expect(response.status()).toBe(200);
    expect(JSON.parse(response.request().postData() ?? '{}')).toEqual({
      productId: expect.any(String),
      publicOrderId: ORDER_ID,
      row: ROW,
    });
    const body = (await response.json()) as {
      replayed: boolean;
      configuration: { sections: WireSection[] };
    };
    expect(body.replayed).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/${ALIAS}\\?order=`));
    await expect(page.getByTestId('configurator-not-replayed')).toHaveCount(0);

    // Off the default, so a fresh start would show something else here.
    const where = locate(body.configuration.sections);
    const chooser = await chooserOf(page, where);
    await expect(chooser).toHaveAttribute('data-option-id', where.orderedId);
    await expect(chooser).toHaveAttribute('data-selected', 'true');
    await expect(chooser).toContainText(ORDERED_OPTION);
    await expect(page.getByTestId('configurator-panel-net')).toHaveText(
      ORDERED_NET,
    );

    const commit = page.getByTestId('configurator-commit');
    await expect(commit).toBeEnabled({ timeout: 30_000 });
    const added = page.waitForResponse(
      (r) =>
        /\/api\/configurations\/[^/]+\/cart$/.test(r.url()) &&
        r.request().method() === 'POST',
    );
    await commit.click();
    const addResponse = await added;
    expect(addResponse.status()).toBe(200);
    const { itemId } = (await addResponse.json()) as { itemId: string };
    const cartId = await cartIdOf(page);
    try {
      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      await expect(page).not.toHaveURL(/[?&](order|row)=/);

      const cart = await page.request.get('/api/cart', { params: { cartId } });
      const { items } = (await cart.json()) as {
        items: { id: string; configuration?: { summary: SummaryRow[] } }[];
      };
      expect(
        items.find((item) => item.id === itemId)?.configuration?.summary,
        "the line added from the replayed session is not the order row's configuration",
      ).toEqual(summary);
    } finally {
      const removed = await page.request.delete('/api/cart/items', {
        params: { cartId, itemId },
      });
      expect(removed.ok(), 'the line the test added was not removed').toBe(
        true,
      );
    }
  });

  test("resumes the session's own choices after it expired, not the order's again", async ({
    page,
  }) => {
    await orderedSummary(page);
    await page.clock.install();

    const replayed = replayResponse(page);
    await openOrderRow(page);
    const body = (await (await replayed).json()) as {
      replayed: boolean;
      configuration: { configurationId: string; sections: WireSection[] };
    };
    expect(body.replayed).toBe(true);

    // The buyer moves off the order's choice before the session runs out.
    const where = locate(body.configuration.sections);
    const other = where.group.options.find((o) => o.id !== where.orderedId);
    expect(
      other,
      `${GROUP_NAME} has no option but the ordered one`,
    ).toBeDefined();
    const chooser = await chooserOf(page, where);
    await chooser.click();
    const sheet = page.getByTestId('configurator-group-sheet');
    await expect(sheet).toBeInViewport({ ratio: 1 });
    const changed = page.waitForResponse(
      (r) =>
        /\/api\/configurations\/[^/]+\/changes$/.test(r.url()) &&
        r.request().method() === 'POST',
    );
    await sheet.locator(`[data-option-id="${other!.id}"]`).click();
    const { expiresAt } = (await (await changed).json()) as {
      expiresAt: string;
    };
    if (await sheet.isVisible()) await page.keyboard.press('Escape');
    await expect(chooser).toHaveAttribute('data-option-id', other!.id);

    // A released session answers exactly what an expired one does.
    const { configurationId } = body.configuration;
    await page.request.delete(`/api/configurations/${configurationId}`);
    const asked = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname ===
        `/api/configurations/${configurationId}/renew`,
    );
    const now = await page.evaluate(() => Date.now());
    await page.clock.fastForward(Date.parse(expiresAt) - now + 31_000);
    expect((await asked).status()).toBe(410);

    const expired = page.getByTestId('configurator-panel-expired');
    await expect(expired).toBeVisible();
    await expect(expired.getByRole('button')).toHaveText(
      await localeText(page, 'configurator.panel.resume'),
    );
    let replayedAgain = false;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/configurations/from-order')) {
        replayedAgain = true;
      }
    });
    const restored = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/configurations/restore' &&
        r.request().method() === 'POST',
    );
    await expired.getByRole('button').click();
    const answer = await restored;
    expect(answer.status()).toBe(200);
    expect(((await answer.json()) as { replayed: boolean }).replayed).toBe(
      true,
    );

    await expect(page.getByTestId('configurator-commit')).toBeVisible({
      timeout: 30_000,
    });
    await expect(await chooserOf(page, where)).toHaveAttribute(
      'data-option-id',
      other!.id,
    );
    await expect(page.getByTestId('configurator-not-restored')).toHaveCount(0);
    await expect(page.getByTestId('configurator-not-replayed')).toHaveCount(0);
    expect(replayedAgain).toBe(false);
  });

  test("starts from the defaults, and says so, when the row's choices cannot be replayed", async ({
    page,
  }) => {
    await orderedSummary(page);
    // A row the order does not have: the server's own path for a row that
    // carries nothing to replay.
    await page.route('**/api/configurations/from-order', (route) =>
      route.continue({
        postData: JSON.stringify({
          ...JSON.parse(route.request().postData() ?? '{}'),
          row: 999,
        }),
      }),
    );

    const replayed = replayResponse(page);
    await openOrderRow(page);
    const response = await replayed;

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      replayed: boolean;
      configuration: { sections: WireSection[] };
    };
    expect(body.replayed).toBe(false);
    await expect(page.getByTestId('configurator-not-replayed')).toBeVisible({
      timeout: 30_000,
    });

    const where = locate(body.configuration.sections);
    const chooser = await chooserOf(page, where);
    await expect(chooser).not.toHaveAttribute(
      'data-option-id',
      where.orderedId,
    );
    await expect(page.getByTestId('configurator-panel-net')).not.toHaveText(
      ORDERED_NET,
    );
  });
});
