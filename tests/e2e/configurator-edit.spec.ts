import { test, expect, type Page, type Response } from '@playwright/test';
import {
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';

/**
 * Editing a configured cart line, end to end on a real CPQ backend.
 *
 * The line is put in the cart through the portal's own routes, since adding one
 * from the page is the configurator spec's subject; everything after that is
 * the buyer's: "Ändra konfiguration" on the cart page, a change on the page the
 * line opens in, and then update, cancel, an expiry or a configuration that
 * cannot be reopened. Every test removes what it put in the cart and places no
 * order.
 *
 * The product is the platform side's configured product on the monitor
 * account. Where it is not configurable — the fixture backend, another tenant —
 * the file is out of scope rather than failing.
 */

const ALIAS = 'digging-bucket-7-20-t';

/** The group the tests change, and the option that is not its default. */
const GROUP_NAME = 'Steel Quality';
const OTHER_OPTION = 'Wear resistant steel';

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'editing a cart line needs a signed-in buyer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

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
interface Document {
  configurationId: string;
  sections: WireSection[];
}

/** Where the changed group sits in a document, by the provider's own ids. */
function locate(document: Document) {
  const walk = (
    sections: WireSection[],
  ): { sectionId: string; group: WireGroup } | null => {
    for (const section of sections) {
      const group = section.optionGroups?.find((g) => g.name === GROUP_NAME);
      if (group) return { sectionId: section.id, group };
      const nested = walk(section.sections ?? []);
      if (nested) return nested;
    }
    return null;
  };
  const found = walk(document.sections);
  expect(found, `${GROUP_NAME} is not in the document`).not.toBeNull();
  const option = found!.group.options.find((o) => o.name === OTHER_OPTION);
  expect(option, `${OTHER_OPTION} is not in ${GROUP_NAME}`).toBeDefined();
  return { ...found!, optionId: option!.id };
}

/** This host's cart only: the stored session may hold other tenants' cookies. */
async function cartIdOf(page: Page): Promise<string> {
  const id = (await page.context().cookies(page.url())).find(
    (c) => c.name === 'cart_id',
  )?.value;
  expect(id, 'the page holds no cart').toBeTruthy();
  return id!;
}

interface Line {
  id: string;
  quantity?: number;
  configuration?: {
    configurationId: string;
    summary: { label: string; value: string }[];
  };
  totalPrice?: { sellingPriceExVat?: number };
}

async function lines(page: Page, cartId: string): Promise<Line[]> {
  const response = await page.request.get('/api/cart', { params: { cartId } });
  if (!response.ok()) return [];
  return ((await response.json()) as { items?: Line[] }).items ?? [];
}

/**
 * A configured line at the product's defaults, added the way the buyer adds
 * one, so the cart is the page's own. Answers the cart and the line, with the
 * drawer open on it.
 */
async function addConfiguredLine(
  page: Page,
): Promise<{ cartId: string; line: Line }> {
  await page.goto(`/se/sv/p/${ALIAS}`);
  await waitForHydration(page);
  const commit = page.getByTestId('configurator-commit');
  await expect(commit).toBeEnabled({ timeout: 30_000 });
  const added = page.waitForResponse(
    (r) =>
      /\/api\/configurations\/[^/]+\/cart$/.test(r.url()) &&
      r.request().method() === 'POST',
  );
  await commit.click();
  const response = await added;
  expect(response.status()).toBe(200);
  const { itemId } = (await response.json()) as { itemId: string };
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  const cartId = await cartIdOf(page);
  const line = (await lines(page, cartId)).find((l) => l.id === itemId);
  expect(line?.configuration).toBeDefined();
  return { cartId, line: line! };
}

async function removeLine(page: Page, cartId: string, itemId: string) {
  const removed = await page.request.delete('/api/cart/items', {
    params: { cartId, itemId },
  });
  expect(removed.ok(), 'the line the test added was not removed').toBe(true);
}

function reopenResponse(page: Page): Promise<Response> {
  return page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/configurations/reopen') &&
      r.request().method() === 'POST',
  );
}

/**
 * The way the buyer goes: open the line's block, press "Ändra". From the drawer
 * the add left open, or from the cart page.
 */
async function editLine(
  page: Page,
  itemId: string,
  from: 'drawer' | 'cart page',
): Promise<void> {
  let scope = page.getByTestId('cart-drawer');
  if (from === 'cart page') {
    await page.goto('/se/sv/cart');
    await waitForHydration(page);
    scope = page.getByTestId('cart-page');
  }
  const item = scope
    .getByTestId('cart-item')
    .filter({ has: page.locator(`#cart-item-configuration-${itemId}`) });
  // Above the toggle, so it shows with the summary closed.
  await item.getByTestId('cart-item-edit').click();
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

/** Chooses the group's other option and waits for the re-evaluated document. */
async function chooseOther(
  page: Page,
  where: ReturnType<typeof locate>,
): Promise<Response> {
  await openSection(page, where.sectionId);
  const group = page.locator(
    `[data-testid="configurator-group"][data-group-id="${where.group.id}"]`,
  );
  await group.getByTestId('configurator-group-chooser').click();
  const sheet = page.getByTestId('configurator-group-sheet');
  await expect(sheet).toBeInViewport({ ratio: 1 });
  const changed = page.waitForResponse(
    (r) =>
      /\/api\/configurations\/[^/]+\/changes$/.test(r.url()) &&
      r.request().method() === 'POST',
  );
  await sheet.locator(`[data-option-id="${where.optionId}"]`).click();
  const response = await changed;
  // The action says it is busy until the answer is in. Counted rather than
  // read: a session that answered 410 takes the action off the page.
  await expect(
    page.locator('[data-testid="configurator-commit"][aria-busy="true"]'),
  ).toHaveCount(0);
  // The sheet is modal; the action sits behind it.
  if (await sheet.isVisible()) await page.keyboard.press('Escape');
  return response;
}

const steelOf = (line: Line | undefined) =>
  line?.configuration?.summary.find((row) => row.label === GROUP_NAME)?.value;

test.describe('Editing a configured cart line', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const configurable = await isConfigurable(page, ALIAS);
    outOfScope(
      !configurable,
      'tenant-config',
      `${ALIAS} is not configurable on this target (it is on the monitor account with the merchant-api or composite backend)`,
    );
  });

  test('updates the line in place: one line, the same id, the new choice and price', async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    const before = (await lines(page, cartId)).length;
    try {
      const reopened = reopenResponse(page);
      await editLine(page, line.id, 'drawer');
      const document = (await (await reopened).json()) as Document;

      await expect(page).toHaveURL(
        new RegExp(`[?&]cart=${cartId}&line=${line.id}`),
      );
      await expect(page.getByTestId('configurator-editing')).toBeVisible({
        timeout: 30_000,
      });
      await chooseOther(page, locate(document));

      const swapped = page.waitForResponse(
        (r) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(r.url()) &&
          r.request().method() === 'PUT',
      );
      await page.getByTestId('configurator-commit').click();
      expect((await swapped).status()).toBe(200);

      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      await expect(page).not.toHaveURL(/[?&](cart|line)=/);
      await expect(page.getByTestId('configurator-editing')).toHaveCount(0);

      const after = await lines(page, cartId);
      const configured = after.filter((l) => l.configuration);
      expect(after.map((l) => l.id)).toContain(line.id);
      expect(after.length).toBe(before);
      const updated = after.find((l) => l.id === line.id);
      expect(updated?.configuration?.configurationId).not.toBe(
        line.configuration?.configurationId,
      );
      expect(steelOf(updated)).toBe(OTHER_OPTION);
      expect(updated?.totalPrice?.sellingPriceExVat).not.toBe(
        line.totalPrice?.sellingPriceExVat,
      );
      expect(
        configured.filter(
          (l) =>
            l.configuration?.configurationId ===
            updated?.configuration?.configurationId,
        ),
      ).toHaveLength(1);
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });

  test('cancels: the line stays as it was and the edit session is released', async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    try {
      const reopened = reopenResponse(page);
      await editLine(page, line.id, 'cart page');
      const document = (await (await reopened).json()) as Document;
      await expect(page.getByTestId('configurator-editing')).toBeVisible({
        timeout: 30_000,
      });
      await chooseOther(page, locate(document));

      await page.getByTestId('configurator-edit-cancel').click();

      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      await expect(page).not.toHaveURL(/[?&](cart|line)=/);
      const kept = (await lines(page, cartId)).find((l) => l.id === line.id);
      expect(kept?.configuration?.configurationId).toBe(
        line.configuration?.configurationId,
      );
      expect(steelOf(kept)).toBe(steelOf(line));
      const released = await page.request.get(
        `/api/configurations/${document.configurationId}`,
      );
      expect(released.status()).toBe(410);
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });

  test("brings the line's choices back after the session expired during the edit", async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    try {
      const reopened = reopenResponse(page);
      await editLine(page, line.id, 'cart page');
      const document = (await (await reopened).json()) as Document;
      await expect(page.getByTestId('configurator-editing')).toBeVisible({
        timeout: 30_000,
      });
      // Nothing about the session is on screen while editing either.
      await expect(page.getByTestId('configurator-panel-expiry')).toHaveCount(
        0,
      );

      // A released session answers exactly what an expired one does.
      await page.request.delete(
        `/api/configurations/${document.configurationId}`,
      );
      await chooseOther(page, locate(document));

      const expired = page.getByTestId('configurator-panel-expired');
      await expect(expired).toBeVisible();
      await expect(expired).toContainText(
        await localeText(page, 'configurator.edit.expired'),
      );
      await expect(expired.getByRole('button')).toHaveText(
        await localeText(page, 'configurator.edit.start_over'),
      );
      const again = reopenResponse(page);
      await expired.getByRole('button').click();
      expect((await again).status()).toBe(200);

      await expect(page.getByTestId('configurator-commit')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId('configurator-editing')).toBeVisible();

      // The form holds the line's Steel Quality, not the change the expired
      // session never took.
      const where = locate(document);
      const lineChoice = where.group.options.find(
        (option) => option.name.trim() === steelOf(line)?.trim(),
      );
      expect(
        lineChoice,
        `the line's ${GROUP_NAME} is not an option`,
      ).toBeDefined();
      expect(lineChoice!.id).not.toBe(where.optionId);
      await openSection(page, where.sectionId);
      const group = page.locator(
        `[data-testid="configurator-group"][data-group-id="${where.group.id}"]`,
      );
      await expect(
        group.locator(`[data-option-id="${lineChoice!.id}"]`),
      ).toHaveAttribute('data-selected', 'true');
      await expect(
        group.locator(
          `[data-option-id="${where.optionId}"][data-selected="true"]`,
        ),
      ).toHaveCount(0);
      const kept = (await lines(page, cartId)).find((l) => l.id === line.id);
      expect(kept?.configuration?.configurationId).toBe(
        line.configuration?.configurationId,
      );
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });

  test('configures afresh, still updating the same line, when the configuration cannot be reopened', async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    try {
      // What the portal answers for the provider's ConfigurationNotReopenable.
      await page.route('**/api/configurations/reopen', (route) =>
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 422,
            message: 'The configuration cannot be reopened',
            data: { code: 'VALIDATION_ERROR' },
          }),
        }),
      );
      const created = page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/configurations') &&
          r.request().method() === 'POST',
      );
      await editLine(page, line.id, 'cart page');
      const document = (await (await created).json()) as Document;

      await expect(page.getByTestId('configurator-edit-notice')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId('configurator-editing')).toBeVisible();
      await chooseOther(page, locate(document));

      const swapped = page.waitForResponse(
        (r) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(r.url()) &&
          r.request().method() === 'PUT',
      );
      await page.unroute('**/api/configurations/reopen');
      await page.getByTestId('configurator-commit').click();
      expect((await swapped).status()).toBe(200);

      const updated = (await lines(page, cartId)).find((l) => l.id === line.id);
      expect(updated?.configuration?.configurationId).not.toBe(
        line.configuration?.configurationId,
      );
      expect(steelOf(updated)).toBe(OTHER_OPTION);
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });
});

test.describe("Changing a configured line's quantity", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const configurable = await isConfigurable(page, ALIAS);
    outOfScope(
      !configurable,
      'tenant-config',
      `${ALIAS} is not configurable on this target (it is on the monitor account with the merchant-api or composite backend)`,
    );
  });

  /** Every quantity change the page sends, as the requests leave. */
  function quantityPuts(page: Page): { quantity: number }[] {
    const sent: { quantity: number }[] = [];
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/api/cart/items' &&
        request.method() === 'PUT'
      ) {
        sent.push(request.postDataJSON() as { quantity: number });
      }
    });
    return sent;
  }

  function quantityAnswer(page: Page): Promise<Response> {
    return page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/cart/items' &&
        r.request().method() === 'PUT',
      { timeout: 60_000 },
    );
  }

  /**
   * The line after the change: the same id at the new quantity, carrying a
   * newly committed configuration, priced by the cart's own answer.
   */
  async function expectChanged(
    page: Page,
    cartId: string,
    before: Line,
    quantity: number,
    answer: Response,
  ) {
    expect(answer.status()).toBe(200);
    const answered = ((await answer.json()) as { items: Line[] }).items.find(
      (l) => l.id === before.id,
    );
    const read = (await lines(page, cartId)).find((l) => l.id === before.id);
    expect(read?.quantity).toBe(quantity);
    expect(read?.configuration?.configurationId).toBeTruthy();
    expect(read?.configuration?.configurationId).not.toBe(
      before.configuration?.configurationId,
    );
    expect(answered?.totalPrice?.sellingPriceExVat).toBe(
      read?.totalPrice?.sellingPriceExVat,
    );
    expect(read?.totalPrice?.sellingPriceExVat).not.toBe(
      before.totalPrice?.sellingPriceExVat,
    );
  }

  test('sends rapid clicks on the cart page as one change through the configuration', async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    try {
      await page.goto('/se/sv/cart');
      await waitForHydration(page);
      const item = page
        .getByTestId('cart-page')
        .getByTestId('cart-item')
        .filter({ has: page.locator(`#cart-item-configuration-${line.id}`) });
      const sent = quantityPuts(page);
      const answered = quantityAnswer(page);
      const increment = item.locator(
        '[data-testid="quantity-input"] button:last-of-type',
      );

      await increment.click();
      await increment.click();
      await increment.click();
      await expect(item.getByTestId('cart-item-updating')).toBeVisible();
      await expect(increment).toBeDisabled();
      // Checkout waits for the line, so no order leaves at the old quantity.
      await expect(page.getByTestId('cart-checkout-button')).toBeDisabled();

      const answer = await answered;
      await expect(item.getByTestId('cart-item-updating')).toHaveCount(0);
      expect(sent).toEqual([expect.objectContaining({ quantity: 4 })]);
      await expectChanged(page, cartId, line, 4, answer);
      await expect(
        item.locator('[data-testid="quantity-input"] input'),
      ).toHaveValue('4');
      await expect(item.getByTestId('cart-item-quantity-error')).toHaveCount(0);
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });

  test('changes the quantity from the drawer the add opened', async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    try {
      const item = page
        .getByTestId('cart-drawer')
        .getByTestId('cart-item')
        .filter({ has: page.locator(`#cart-item-configuration-${line.id}`) });
      const sent = quantityPuts(page);
      const answered = quantityAnswer(page);

      await item
        .locator('[data-testid="quantity-input"] button:last-of-type')
        .click();

      const answer = await answered;
      expect(sent).toEqual([expect.objectContaining({ quantity: 2 })]);
      await expectChanged(page, cartId, line, 2, answer);
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });

  test('leaves the line as it was, and says so, when the change is refused', async ({
    page,
  }) => {
    const { cartId, line } = await addConfiguredLine(page);
    try {
      // What the portal answers when the provider refuses the quantity.
      await page.route('**/api/cart/items', (route) =>
        route.request().method() === 'PUT'
          ? route.fulfill({
              status: 422,
              contentType: 'application/json',
              body: JSON.stringify({
                statusCode: 422,
                message: 'The provider rejected the change',
                data: { code: 'VALIDATION_ERROR' },
              }),
            })
          : route.continue(),
      );
      await page.goto('/se/sv/cart');
      await waitForHydration(page);
      const item = page
        .getByTestId('cart-page')
        .getByTestId('cart-item')
        .filter({ has: page.locator(`#cart-item-configuration-${line.id}`) });

      await item
        .locator('[data-testid="quantity-input"] button:last-of-type')
        .click();

      await expect(item.getByTestId('cart-item-quantity-error')).toHaveText(
        'Antalet kunde inte ändras. Produkten i varukorgen är oförändrad.',
      );
      await expect(
        item.locator('[data-testid="quantity-input"] input'),
      ).toHaveValue('1');
      await page.unroute('**/api/cart/items');
      const kept = (await lines(page, cartId)).find((l) => l.id === line.id);
      expect(kept?.quantity).toBe(1);
      expect(kept?.configuration?.configurationId).toBe(
        line.configuration?.configurationId,
      );
    } finally {
      await removeLine(page, cartId, line.id);
    }
  });
});
