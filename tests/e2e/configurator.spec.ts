import { test, expect, type Page } from '@playwright/test';
import {
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  readPrice,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';

/**
 * Configurator E2E Tests
 *
 * The whole configurator stack in one browser journey: the page dispatcher
 * picks the configurator, a session is created, a choice is posted as a change
 * batch, the re-evaluated document turns the configuration valid, and the
 * action commits it, adds the committed line to the cart and carries on in a
 * session reopened from that line. A green run says route, service, fixture and
 * form agree;
 * the component tests say only that each half works alone.
 *
 * The product is named rather than discovered. `discoverProduct` answers "any
 * product with a SKU", and this file is about one document with one unmet
 * requirement — the seed's colour group — which no discovery can ask for.
 */

/** The catalogue product the fixture's seed declares it configures. */
const SEED_ALIAS = 'arbetsbord-pro';

/**
 * Names from the seed's document, not from a locale file: the validity banner
 * lists the group by the name the provider sent, so asserting on it holds in
 * every language the tenant runs.
 */
const COLOUR_GROUP = 'color';
const COLOUR_GROUP_NAME = 'Colour';

/** The section the colour group sits in, nested under the first one. */
const COLOUR_SECTION = 'finish';

/**
 * The first colour in the seed's list that costs anything: the three before it
 * are free, so choosing one of those would leave the price assertion comparing
 * a number to itself.
 */
const PRICED_COLOUR = 'ral-7016';
const PRICED_COLOUR_NET = 150;

/** A second priced row, for the click that must not reach the network. */
const OTHER_COLOUR = 'ral-9006';

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'the configurator is gated on an access rule that defaults to authenticated (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

// Preflight L4 signs in once and writes the session; a per-test login would
// exceed the 5-per-minute rate limit.
test.use({ storageState: signedInState });

/**
 * Why this target cannot run the flow, or `null`.
 *
 * Two questions in a fixed order, because they are answered by different
 * gates. `configurable` on the product asks the backend seam alone, so it says
 * whether an implementation is behind the configurator at all. The feature
 * flag and its access rule live in `requireConfigurator`, which answers before
 * the body is read — so an empty POST reaches the gate and nothing else, and
 * no session is created to probe it. Asking them the other way round would
 * read a backend that is off as a feature that is off.
 */
async function unavailableReason(
  page: Page,
  alias = SEED_ALIAS,
): Promise<string | null> {
  if (!(await isConfigurable(page, alias))) {
    return `the configurator backend is off on this target, or ${alias} is missing from the catalogue`;
  }

  const gate = await page.request.post('/api/configurations', { data: {} });
  if (gate.status() === 404) {
    return 'the configurator feature is off for this tenant, or its access rule refuses the e2e user';
  }

  return null;
}

/** The form after the session has been created, whatever the document holds. */
async function openConfigurator(page: Page, alias = SEED_ALIAS): Promise<void> {
  await page.goto(`/p/${alias}`);
  await waitForHydration(page);

  // Both of these belong to the configurator page alone. `product-tabs` does
  // not: the two pages share the tab strip, so its presence says nothing about
  // which one was mounted.
  await expect(page.getByTestId('configurator-product')).toBeVisible();
  await expect(page.getByTestId('configurator-form-slot')).toBeVisible();

  await expect(
    page.locator('[data-testid="configurator-section"]').first(),
  ).toBeVisible({ timeout: 20000 });
}

/**
 * Bring a section's page up. The rail is desktop-only (`hidden lg:block`), so
 * the mobile project walks there with the pager instead. Neither path selects
 * by position: the rail entry is found by its section id, and the walk stops
 * when the section it wants is the one on screen.
 */
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
    // One step per entry is enough to reach any of them from anywhere.
    const steps = await page.getByTestId('configurator-rail-entry').count();
    const next = page.getByTestId('configurator-next');
    for (let step = 0; step < steps; step++) {
      if (await section.isVisible()) break;
      await next.click();
    }
  }

  await expect(section).toBeVisible();
}

/** The colour group as it renders in the form, never as the full-list sheet
 * renders it: the sheet repeats the same `data-option-id` values. Twenty-six
 * colours are chosen from the sheet, so the form holds one chooser row, which
 * carries the chosen colour's id. */
function colourGroup(page: Page) {
  return page.locator(
    `[data-testid="configurator-group"][data-group-id="${COLOUR_GROUP}"]`,
  );
}

/** The colour group's full list, opened from its chooser row. */
async function openColourSheet(page: Page) {
  await colourGroup(page).getByTestId('configurator-group-chooser').click();
  const sheet = page.getByTestId('configurator-group-sheet');
  // In place, not only visible: the sheet slides in, and a forced click skips
  // the wait for a row to stop moving.
  await expect(sheet).toBeInViewport({ ratio: 1 });
  return sheet;
}

/**
 * The action, which says it is busy while a batch is in flight: the signal
 * that a recompute has finished, waited for rather than slept through.
 */
function action(page: Page) {
  return page.getByTestId('configurator-commit');
}

function changeResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      /\/api\/configurations\/[^/]+\/changes$/.test(response.url()) &&
      response.request().method() === 'POST',
  );
}

/** The cart lines behind the `cart_id` cookie, none when there is no cart. */
async function cartLineIds(page: Page): Promise<string[]> {
  const cartId = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
  if (!cartId) return [];
  const response = await page.request.get('/api/cart', {
    params: { cartId },
  });
  if (!response.ok()) return [];
  const body = (await response.json()) as { items?: { id: string }[] };
  return (body.items ?? []).map((item) => item.id);
}

/** Removes the lines the test added, so the shared account's cart stays as it was. */
async function removeCartLines(page: Page, keep: string[]): Promise<void> {
  const cartId = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
  if (!cartId) return;
  for (const itemId of await cartLineIds(page)) {
    if (keep.includes(itemId)) continue;
    await page.request.delete('/api/cart/items', {
      params: { cartId, itemId },
    });
  }
}

test.describe('Configurator', () => {
  test('configures the seeded product to valid and adds it to the cart', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page);

    // A fresh document is invalid on the colour group alone; every other
    // required group arrives preselected.
    const validity = page.getByTestId('configurator-required-status');
    await validity.getByTestId('configurator-required-toggle').click();
    await expect(validity).toContainText(COLOUR_GROUP_NAME);
    await expect(page.getByTestId('configurator-commit')).toBeDisabled();

    const priceBefore = await readPrice(
      page.getByTestId('configurator-panel-net'),
    );

    await openSection(page, COLOUR_SECTION);

    const changed = changeResponse(page);
    await (await openColourSheet(page))
      .locator(`[data-option-id="${PRICED_COLOUR}"]`)
      .click();
    await changed;
    await expect(action(page)).toHaveAttribute('aria-busy', 'false');

    await expect(
      colourGroup(page).locator(`[data-option-id="${PRICED_COLOUR}"]`),
    ).toHaveAttribute('data-selected', 'true');

    // The whole document comes back re-evaluated, so the price and the
    // validity are the server's answer to the one choice that was sent.
    await expect
      .poll(() => readPrice(page.getByTestId('configurator-panel-net')))
      .toBe(priceBefore + PRICED_COLOUR_NET);
    await expect(validity).not.toContainText(COLOUR_GROUP_NAME);

    const commit = page.getByTestId('configurator-commit');
    await expect(commit).toBeEnabled();

    const linesBefore = await cartLineIds(page);
    try {
      const committed = page.waitForResponse(
        (response) =>
          /\/api\/configurations\/[^/]+\/commit$/.test(response.url()) &&
          response.request().method() === 'POST',
      );
      const added = page.waitForResponse(
        (response) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(response.url()) &&
          response.request().method() === 'POST',
      );
      await commit.click();
      expect((await committed).status()).toBe(200);
      expect((await added).status()).toBe(200);

      // The drawer opens as it does for any product, with one line more.
      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      expect((await cartLineIds(page)).length).toBe(linesBefore.length + 1);

      // The page carries on as it was: the form, reopened from the new line,
      // holds the buyer's choice and its price, and the action is live again.
      await expect(
        page.locator('[data-testid="configurator-section"]').first(),
      ).toBeVisible({ timeout: 20000 });
      // The drawer is modal; the buyer closes it to go on configuring.
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('cart-drawer')).toBeHidden();
      await openSection(page, COLOUR_SECTION);
      await expect(
        colourGroup(page).locator(`[data-option-id="${PRICED_COLOUR}"]`),
      ).toHaveAttribute('data-selected', 'true');
      await expect
        .poll(() => readPrice(page.getByTestId('configurator-panel-net')))
        .toBe(priceBefore + PRICED_COLOUR_NET);
      await expect(page.getByTestId('configurator-commit')).toBeEnabled();
      await expect(page.getByTestId('configurator-committed')).toHaveCount(0);
      await expect(page.getByTestId('configurator-add-failed')).toHaveCount(0);
    } finally {
      await removeCartLines(page, linesBefore);
    }
  });

  test('a list card leads to the configurator, never to the cart', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    // The seed's own list page, read from the product rather than named: the
    // category is the catalogue's, not the fixture's.
    const product = await (
      await page.request.get(`/api/products/${SEED_ALIAS}`)
    ).json();
    const listUrl: string | undefined = product?.primaryCategory?.canonicalUrl;
    expect(listUrl, `${SEED_ALIAS} has no primary category`).toBeTruthy();

    // Any write to the cart, from the card or from anything it leads to.
    const cartWrites: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() !== 'GET' &&
        new URL(request.url()).pathname.startsWith('/api/cart')
      ) {
        cartWrites.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(listUrl!);
    await waitForHydration(page);

    const card = page
      .getByTestId('product-card')
      .filter({ hasText: product.name })
      .first();
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.getByTestId('add-to-cart-button')).toHaveCount(0);
    await expect(card.getByTestId('card-price-on-configuration')).toBeVisible();
    await expect(card.getByTestId('card-price')).toHaveCount(0);

    const link = card.getByTestId('configure-product-link');
    await expect(link).toBeVisible();
    await link.click();

    await expect(page.getByTestId('configurator-product')).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.locator('[data-testid="configurator-section"]').first(),
    ).toBeVisible({ timeout: 20000 });
    expect(cartWrites).toEqual([]);
  });

  test('sends no second batch while one is pending', async ({ page }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    // The fixture answers in milliseconds, so the locked form is not
    // observable without holding the response. Held until the second click
    // is made rather than for a fixed time: reopening the sheet takes longer
    // than a second and a half on the mobile project.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/configurations/*/changes', async (route) => {
      await held;
      await route.continue();
    });

    let batches = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/configurations\/[^/]+\/changes$/.test(request.url())
      ) {
        batches++;
      }
    });

    await openConfigurator(page);
    await openSection(page, COLOUR_SECTION);

    const changed = changeResponse(page);
    await (await openColourSheet(page))
      .locator(`[data-option-id="${PRICED_COLOUR}"]`)
      .click();
    await expect(action(page)).toHaveAttribute('aria-busy', 'true');

    // The sheet closed behind the first choice and opens again while the batch
    // is in flight. `force` because the row is disabled until it comes back,
    // and Playwright would otherwise wait for it rather than click.
    const sheet = await openColourSheet(page);
    await sheet
      .locator(`[data-option-id="${OTHER_COLOUR}"]`)
      .click({ force: true });

    release();
    await changed;
    await expect(action(page)).toHaveAttribute('aria-busy', 'false');

    // Deliberately a network assertion. Two layers can stop the second choice
    // — the row's own guard and the session's `busy` check — and what matters
    // is that nothing went out, whichever one of them a later change rewrites.
    expect(batches).toBe(1);
    await expect(
      colourGroup(page).locator(`[data-option-id="${PRICED_COLOUR}"]`),
    ).toHaveAttribute('data-selected', 'true');
    await expect(
      sheet.locator(`[data-option-id="${OTHER_COLOUR}"]`),
    ).toHaveAttribute('data-selected', 'false');
  });

  test("brings the buyer's last choices back after the session expired", async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/configurations' &&
        response.request().method() === 'POST',
    );
    await openConfigurator(page);
    const { configurationId } = (await (await created).json()) as {
      configurationId: string;
    };

    // Nothing about the session is on screen: it is renewed silently.
    await expect(page.getByTestId('configurator-panel-expiry')).toHaveCount(0);

    await openSection(page, COLOUR_SECTION);
    const changed = changeResponse(page);
    await (await openColourSheet(page))
      .locator(`[data-option-id="${PRICED_COLOUR}"]`)
      .click();
    await changed;
    await expect(action(page)).toHaveAttribute('aria-busy', 'false');

    // A released session answers exactly what an expired one does.
    const released = await page.request.delete(
      `/api/configurations/${configurationId}`,
    );
    expect(released.status()).toBe(204);

    const refused = changeResponse(page);
    await (await openColourSheet(page))
      .locator(`[data-option-id="${OTHER_COLOUR}"]`)
      .click();
    expect((await refused).status()).toBe(410);

    const expired = page.getByTestId('configurator-panel-expired');
    await expect(expired).toBeVisible();
    await expect(expired.getByRole('button')).toHaveText(
      await localeText(page, 'configurator.panel.resume'),
    );
    const restored = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/configurations/restore' &&
        response.request().method() === 'POST',
    );
    await expired.getByRole('button').click();
    const answer = await restored;
    expect(answer.status()).toBe(200);
    expect(((await answer.json()) as { replayed: boolean }).replayed).toBe(
      true,
    );

    // The form holds the choice the expired session took, not the one it
    // never did, and not the empty default.
    await expect(action(page)).toBeVisible({ timeout: 20000 });
    await openSection(page, COLOUR_SECTION);
    await expect(
      colourGroup(page).locator(`[data-option-id="${PRICED_COLOUR}"]`),
    ).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('configurator-not-restored')).toHaveCount(0);
    await expect(page.getByTestId('configurator-panel-expiry')).toHaveCount(0);
  });

  test('shows the expired panel once the time has run out, without a click, and resumes with the choices', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');
    await page.clock.install();

    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/configurations' &&
        response.request().method() === 'POST',
    );
    await openConfigurator(page);
    const { configurationId } = (await (await created).json()) as {
      configurationId: string;
    };

    await openSection(page, COLOUR_SECTION);
    const changed = changeResponse(page);
    await (await openColourSheet(page))
      .locator(`[data-option-id="${PRICED_COLOUR}"]`)
      .click();
    const { expiresAt } = (await (await changed).json()) as {
      expiresAt: string;
    };
    await expect(action(page)).toHaveAttribute('aria-busy', 'false');

    // A released session answers exactly what an expired one does.
    const released = await page.request.delete(
      `/api/configurations/${configurationId}`,
    );
    expect(released.status()).toBe(204);

    // Past expiry and the next check, with nothing touched on the page.
    const asked = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
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
    const restored = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/configurations/restore' &&
        response.request().method() === 'POST',
    );
    await expired.getByRole('button').click();
    const answer = await restored;
    expect(answer.status()).toBe(200);
    expect(((await answer.json()) as { replayed: boolean }).replayed).toBe(
      true,
    );

    await expect(action(page)).toBeVisible({ timeout: 20000 });
    await openSection(page, COLOUR_SECTION);
    await expect(
      colourGroup(page).locator(`[data-option-id="${PRICED_COLOUR}"]`),
    ).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('configurator-not-restored')).toHaveCount(0);
  });
});

/**
 * The third seed, for the one rule that speaks on a group: a steel worktop
 * leaves the edge profile two levels down with a note beside its title.
 */
const DEEP_ALIAS = 'monteringsstation-pro';
const EDGE_NOTE = 'Only the ABS edge band fits a stainless steel top.';

test.describe('Configurator group message', () => {
  test('shows a group message as an icon whose tooltip opens by pointer and by focus', async ({
    page,
    isMobile,
  }) => {
    const unavailable = await unavailableReason(page, DEEP_ALIAS);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page, DEEP_ALIAS);
    await openSection(page, 'worktop');

    const worktop = page.locator(
      '[data-testid="configurator-group"][data-group-id="top"]',
    );
    await worktop.getByTestId('configurator-group-chooser').click();
    const sheet = page.getByTestId('configurator-group-sheet');
    await expect(sheet).toBeInViewport({ ratio: 1 });
    const changed = changeResponse(page);
    await sheet.locator('[data-option-id="top-steel"]').click();
    await changed;
    await expect(action(page)).toHaveAttribute('aria-busy', 'false');

    await openSection(page, 'edge');
    const info = page
      .locator(
        '[data-testid="configurator-group"][data-group-id="edge-profile"]',
      )
      .getByTestId('configurator-group-info');
    await expect(info).toHaveAttribute('data-severity', 'info');
    // An icon, not the box the message used to be.
    await expect(page.getByText(EDGE_NOTE)).toBeHidden();

    const tooltip = page.getByTestId('configurator-group-info-content');
    if (isMobile) {
      await info.tap();
    } else {
      await info.hover();
    }
    await expect(tooltip).toContainText(EDGE_NOTE);

    // Away and back by keyboard: the text a screen reader hears arrives the
    // same way.
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    // A tap leaves the button focused, and focusing it again fires nothing.
    await info.blur();
    await info.focus();
    await expect(tooltip).toContainText(EDGE_NOTE);
    // The primitive puts the text a second time in a visually hidden element
    // with role="tooltip" and, from its `VisuallyHidden` default,
    // aria-hidden="true", so it is out of the accessibility tree. It is still
    // what `aria-describedby` points at, and a reference is read even when
    // hidden, so what the button is described by is the question to ask.
    const describedBy = await info.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(
      EDGE_NOTE,
    );
    await expect(info).toHaveAccessibleDescription(
      new RegExp(EDGE_NOTE.replace(/\./g, '\\.')),
    );
  });
});

/**
 * The same seed's "No extended warranty": quantity, minimum and maximum all 0,
 * preselected, as the real provider sends it. A pick that carried its 0 was
 * refused before it reached the provider.
 */
const WARRANTY_GROUP = 'warranty';

test.describe('Configurator option of quantity 0', () => {
  test('chooses the option of quantity 0 again after another one', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page, DEEP_ALIAS);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page, DEEP_ALIAS);
    await openSection(page, 'power');

    const group = page.locator(
      `[data-testid="configurator-group"][data-group-id="${WARRANTY_GROUP}"]`,
    );
    const pick = async (optionId: string) => {
      await group.getByTestId('configurator-group-chooser').click();
      const sheet = page.getByTestId('configurator-group-sheet');
      await expect(sheet).toBeInViewport({ ratio: 1 });
      const changed = changeResponse(page);
      await sheet.locator(`[data-option-id="${optionId}"]`).click();
      expect((await changed).status()).toBe(200);
      await expect(action(page)).toHaveAttribute('aria-busy', 'false');
      await expect(
        group.locator(`[data-option-id="${optionId}"]`),
      ).toHaveAttribute('data-selected', 'true');
    };

    await expect(
      group.locator('[data-option-id="warranty-none"]'),
    ).toHaveAttribute('data-selected', 'true');
    await pick('warranty-1y');
    await pick('warranty-none');
    await expect(page.getByTestId('configurator-commit')).toBeEnabled();
  });
});

/**
 * The same seed's open number with a refusal the range cannot say: zero is
 * refused, as the real provider refuses it beside a length.
 */
const TRANSPORT_TIME = 'transport-time';

test.describe('Configurator refused change', () => {
  test('steps an empty field up to the first step and says so at the field when a value is refused', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page, DEEP_ALIAS);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page, DEEP_ALIAS);
    await openSection(page, 'structure');

    const field = page.locator(
      `[data-testid="configurator-variable"][data-variable-id="${TRANSPORT_TIME}"]`,
    );
    const input = field.locator('input');
    const refused = field.getByTestId('configurator-change-refused');
    const busy = action(page);
    await expect(input).toHaveValue('');

    // The first step from empty is one step up from zero, not zero itself.
    let changed = changeResponse(page);
    await field.getByRole('button', { name: 'Increase' }).click();
    let response = await changed;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      changes: [{ type: 'variable', variableId: TRANSPORT_TIME, value: 1 }],
    });
    await expect(busy).toHaveAttribute('aria-busy', 'false');
    await expect(input).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByTestId('configurator-form-error')).toBeHidden();

    // A value the range allows and the provider refuses.
    changed = changeResponse(page);
    await input.fill('0');
    await input.press('Enter');
    response = await changed;
    expect(response.status()).toBe(422);
    await expect(busy).toHaveAttribute('aria-busy', 'false');
    await expect(refused).toBeVisible();
    await expect(input).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByTestId('configurator-form-error')).toBeHidden();

    // The form is still the buyer's, and the next value goes through.
    changed = changeResponse(page);
    await input.fill('2');
    await input.press('Enter');
    response = await changed;
    expect(response.status()).toBe(200);
    await expect(busy).toHaveAttribute('aria-busy', 'false');
    await expect(input).toHaveAttribute('aria-valuenow', '2');
    await expect(refused).toBeHidden();
  });
});

/**
 * The fixture's seed that commits as created and has stock for a second unit.
 * The workbench above needs a colour first and has one unit in stock.
 */
const CART_SEED_ALIAS = 'skapsektion-pro';

/** How many list rows a target without the seed is searched for a product. */
const CANDIDATES = 20;

interface WireOption {
  id: string;
  name: string;
  selected: boolean;
  available: boolean;
  readOnly: boolean;
}
interface WireGroup {
  id: string;
  name: string;
  available: boolean;
  maxSelections?: number;
  options: WireOption[];
}
interface WireSection {
  id: string;
  visible: boolean;
  optionGroups: WireGroup[];
  sections: WireSection[];
}
interface WireDocument {
  configurationId: string;
  isValid: boolean;
  sections: WireSection[];
}

/** One choice the buyer can switch to in a single-choice group. */
interface EditTarget {
  sectionId: string;
  groupId: string;
  groupName: string;
  current: string;
  optionId: string;
  next: string;
}

/** The first visible single-choice group holding a choice and an alternative. */
function editTarget(document: WireDocument): EditTarget | null {
  const walk = (sections: WireSection[]): EditTarget | null => {
    for (const section of sections) {
      if (!section.visible) continue;
      for (const group of section.optionGroups) {
        if (!group.available || group.maxSelections !== 1) continue;
        const current = group.options.find((option) => option.selected);
        const next = group.options.find(
          (option) =>
            !option.selected &&
            option.available &&
            !option.readOnly &&
            option.name.trim() !== '',
        );
        if (current && next) {
          return {
            sectionId: section.id,
            groupId: group.id,
            groupName: group.name.trim(),
            current: current.name.trim(),
            optionId: next.id,
            next: next.name.trim(),
          };
        }
      }
      const nested = walk(section.sections);
      if (nested) return nested;
    }
    return null;
  };
  return walk(document.sections);
}

/**
 * Whether a product carries the whole flow: stock for two, valid as created
 * and a choice to change. Asked of a session that is released straight away.
 */
async function suitsTheCart(page: Page, alias: string): Promise<boolean> {
  const response = await page.request.get(`/api/products/${alias}`);
  if (!response.ok()) return false;
  const product = (await response.json()) as {
    productId?: number;
    configurable?: boolean;
    skus?: { stock?: { totalStock?: number } }[];
  };
  const stock = product.skus?.[0]?.stock?.totalStock ?? 0;
  if (!product.configurable || stock < 2) return false;

  const created = await page.request.post('/api/configurations', {
    data: { productId: String(product.productId), quantity: 1 },
  });
  if (!created.ok()) return false;
  const document = (await created.json()) as WireDocument;
  await page.request.delete(`/api/configurations/${document.configurationId}`);
  return document.isValid && editTarget(document) !== null;
}

/**
 * The fixture's seed where the fixture serves, otherwise the first configurable
 * product in the list that suits the flow, so no account's catalogue is named.
 */
async function cartProduct(page: Page): Promise<string | null> {
  if (await isConfigurable(page, CART_SEED_ALIAS)) {
    return (await suitsTheCart(page, CART_SEED_ALIAS)) ? CART_SEED_ALIAS : null;
  }
  const response = await page.request.get('/api/product-lists/products', {
    params: {
      take: String(CANDIDATES),
      filter: JSON.stringify({ sort: 'ALPHABETICAL' }),
    },
  });
  if (!response.ok()) return null;
  const { products = [] } = (await response.json()) as {
    products?: { alias?: string; configurable?: boolean }[];
  };
  for (const { alias, configurable } of products) {
    if (alias && configurable && (await suitsTheCart(page, alias))) {
      return alias;
    }
  }
  return null;
}

interface CartLine {
  id: string;
  quantity: number;
  configuration?: {
    configurationId: string;
    summary: { label: string; value: string }[];
  };
}

/** This host's cart only: the stored session may hold other tenants' cookies. */
async function cartIdOf(page: Page): Promise<string | undefined> {
  return (await page.context().cookies(page.url())).find(
    (cookie) => cookie.name === 'cart_id',
  )?.value;
}

async function readLines(page: Page, cartId: string): Promise<CartLine[]> {
  const response = await page.request.get('/api/cart', { params: { cartId } });
  expect(response.ok(), 'the cart could not be read').toBe(true);
  return ((await response.json()) as { items?: CartLine[] }).items ?? [];
}

/** The summary rows trimmed, as the buyer reads them. */
function rowsOf(line: CartLine | undefined) {
  return (line?.configuration?.summary ?? []).map((row) => ({
    label: row.label.trim(),
    value: row.value.trim(),
  }));
}

test.describe('Configured line through the cart', () => {
  test.describe.configure({ timeout: 120_000 });

  test('adds a configured line, edits it, changes its quantity and removes it', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);
    const alias = await cartProduct(page);
    outOfScope(
      !alias,
      'tenant-config',
      'no configurable product here commits as created with stock for two and a choice to change (the configurator is off, or the catalogue has none)',
    );

    let cartId: string | undefined;
    try {
      // ---------- Add ----------
      await openConfigurator(page, alias!);
      const commit = action(page);
      await expect(commit).toBeEnabled({ timeout: 30_000 });
      await expect(commit).toHaveAttribute('aria-busy', 'false');
      const added = page.waitForResponse(
        (response) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(response.url()) &&
          response.request().method() === 'POST',
      );
      await commit.click();
      const addResponse = await added;
      expect(addResponse.status()).toBe(200);
      const { itemId } = (await addResponse.json()) as { itemId: string };
      cartId = await cartIdOf(page);
      expect(cartId, 'the add left no cart').toBeTruthy();

      const [line] = await readLines(page, cartId!);
      expect(line?.id).toBe(itemId);
      expect(line?.configuration).toBeDefined();

      // ---------- The line in the drawer ----------
      const drawer = page.getByTestId('cart-drawer');
      await expect(drawer).toBeVisible();
      const lineIn = (scope: ReturnType<Page['getByTestId']>) =>
        scope
          .getByTestId('cart-item')
          .filter({ has: page.locator(`#cart-item-configuration-${itemId}`) });
      await expect(
        lineIn(drawer).getByTestId('cart-item-configured'),
      ).toBeVisible();
      await lineIn(drawer)
        .getByTestId('cart-item-configuration-toggle')
        .click();
      await expect(
        lineIn(drawer).getByTestId('cart-item-configuration-row'),
      ).toHaveCount(rowsOf(line).length);

      // ---------- Edit from the cart page ----------
      await page.goto('/cart');
      await waitForHydration(page);
      const cartPage = page.getByTestId('cart-page');
      const reopened = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/configurations/reopen') &&
          response.request().method() === 'POST',
      );
      await lineIn(cartPage).getByTestId('cart-item-edit').click();
      const reopenResponse = await reopened;
      expect(reopenResponse.status()).toBe(200);
      const edit = editTarget((await reopenResponse.json()) as WireDocument);
      expect(edit, 'the reopened line has no choice to change').not.toBeNull();
      expect(rowsOf(line)).toContainEqual({
        label: edit!.groupName,
        value: edit!.current,
      });
      await expect(page.getByTestId('configurator-editing')).toBeVisible({
        timeout: 30_000,
      });

      await openSection(page, edit!.sectionId);
      await page
        .locator(
          `[data-testid="configurator-group"][data-group-id="${edit!.groupId}"]`,
        )
        .getByTestId('configurator-group-chooser')
        .click();
      const sheet = page.getByTestId('configurator-group-sheet');
      await expect(sheet).toBeInViewport({ ratio: 1 });
      const changed = changeResponse(page);
      await sheet.locator(`[data-option-id="${edit!.optionId}"]`).click();
      expect((await changed).status()).toBe(200);
      // The action sits behind the sheet, and is live again once the
      // re-evaluated document is in.
      if (await sheet.isVisible()) await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(commit).toHaveAttribute('aria-busy', 'false');
      await expect(commit).toBeEnabled();

      const swapped = page.waitForResponse(
        (response) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(response.url()) &&
          response.request().method() === 'PUT',
      );
      await commit.click();
      expect((await swapped).status()).toBe(200);
      await expect(drawer).toBeVisible();

      // One line, the same one, carrying the new choice.
      const afterEdit = await readLines(page, cartId!);
      expect(afterEdit.map((l) => l.id)).toEqual([itemId]);
      const edited = afterEdit[0];
      expect(edited?.configuration?.configurationId).not.toBe(
        line?.configuration?.configurationId,
      );
      expect(rowsOf(edited)).toContainEqual({
        label: edit!.groupName,
        value: edit!.next,
      });
      expect(rowsOf(edited)).not.toContainEqual({
        label: edit!.groupName,
        value: edit!.current,
      });

      // ---------- Quantity ----------
      const quantity = lineIn(drawer).getByTestId('quantity-input');
      const updated = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/cart/items' &&
          response.request().method() === 'PUT',
      );
      await quantity.getByRole('button', { name: 'Increase' }).click();
      expect((await updated).status()).toBe(200);
      await expect(quantity.locator('input')).toHaveValue('2');

      const afterQuantity = await readLines(page, cartId!);
      expect(afterQuantity.map((l) => [l.id, l.quantity])).toEqual([
        [itemId, 2],
      ]);
      // Through a reopen and a new commit at that quantity, with the choices
      // the line had.
      expect(afterQuantity[0]?.configuration?.configurationId).not.toBe(
        edited?.configuration?.configurationId,
      );
      expect(rowsOf(afterQuantity[0])).toEqual(rowsOf(edited));

      // ---------- Remove ----------
      const removed = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/cart/items' &&
          response.request().method() === 'DELETE',
      );
      await lineIn(drawer).getByTestId('cart-item-remove').click();
      expect((await removed).status()).toBe(200);
      await expect(drawer.getByTestId('cart-empty')).toBeVisible();
      expect(await readLines(page, cartId!)).toEqual([]);
    } finally {
      if (cartId) {
        for (const { id } of await readLines(page, cartId)) {
          await page.request.delete('/api/cart/items', {
            params: { cartId, itemId: id },
          });
        }
      }
    }
  });
});

/**
 * A guest on a configurable product. Configuring needs a signed-in buyer, so
 * the page offers no price and no plain add, only a way to sign in. Asked of
 * `/api/config` rather than the gate: the gate answers a guest 404 whether the
 * feature is on or not.
 */
test.describe('a guest on a configurable product', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    outOfScope(
      !(await isConfigurable(page, SEED_ALIAS)),
      'fixture-missing',
      `the configurator backend is off on this target, or ${SEED_ALIAS} is missing from the catalogue`,
    );
    const config = await (await page.request.get('/api/config')).json();
    outOfScope(
      config?.features?.configurator?.enabled !== true,
      'tenant-config',
      'the configurator feature is off for this tenant',
    );
  });

  test('is asked to sign in, and gets no price and no add', async ({
    page,
  }) => {
    await page.goto(`/p/${SEED_ALIAS}`);
    await waitForHydration(page);

    await expect(page.getByTestId('product-name')).toBeVisible();
    await expect(
      page.getByTestId('pdp-sign-in-to-configure-note'),
    ).toBeVisible();
    await expect(page.getByTestId('configurator-product')).toHaveCount(0);
    await expect(page.getByTestId('add-to-cart-button')).toHaveCount(0);
    await expect(page.getByTestId('pdp-price')).toHaveCount(0);

    // The link sits inside the sentence that says why.
    await page
      .getByTestId('pdp-sign-in-to-configure-note')
      .getByTestId('pdp-sign-in-to-configure')
      .click();
    await expect(page.getByTestId('auth-sheet')).toBeVisible();
  });
});

test.describe('Configurator refusals a second try cannot fix', () => {
  /** What the portal answers for a provider code, as its error body. */
  function refusal(status: number, code: string) {
    return {
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: status,
        message: 'x',
        data: { code },
      }),
    };
  }

  for (const [why, code] of [
    ['an account without a configurator', 'CONFIGURATOR_NOT_AVAILABLE'],
    ['a product the configurator does not know', 'NOT_FOUND'],
  ] as const) {
    test(`says the product cannot be configured for ${why}`, async ({
      page,
    }) => {
      const unavailable = await unavailableReason(page);
      outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

      await page.route('**/api/configurations', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill(refusal(404, code))
          : route.continue(),
      );
      await page.goto(`/p/${SEED_ALIAS}`);
      await waitForHydration(page);

      await expect(page.getByTestId('configurator-error')).toHaveText(
        await localeText(page, 'configurator.not_available'),
        { timeout: 20000 },
      );
      await expect(page.getByTestId('configurator-resume')).toHaveCount(0);
    });
  }

  test('adds nothing when the commit is priced in another currency, and resumes the choices in this market', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page);
    await openSection(page, COLOUR_SECTION);
    const changed = changeResponse(page);
    await (await openColourSheet(page))
      .locator(`[data-option-id="${PRICED_COLOUR}"]`)
      .click();
    await changed;
    await expect(action(page)).toBeEnabled();

    const adds: string[] = [];
    page.on('request', (request) => {
      if (/\/api\/configurations\/[^/]+\/cart$/.test(request.url())) {
        adds.push(request.url());
      }
    });
    await page.route('**/api/configurations/*/commit', (route) =>
      route.fulfill(refusal(409, 'CURRENCY_MISMATCH')),
    );
    await action(page).click();

    await expect(page.getByTestId('configurator-error')).toHaveText(
      await localeText(page, 'configurator.currency_mismatch'),
    );
    await expect(page.getByTestId('configurator-add-retry')).toHaveCount(0);
    expect(adds).toEqual([]);

    const restored = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/configurations/restore' &&
        response.request().method() === 'POST',
    );
    const resume = page.getByTestId('configurator-resume');
    await expect(resume).toHaveText(
      await localeText(page, 'configurator.panel.resume'),
    );
    await resume.click();
    expect((await restored).status()).toBe(200);

    await expect(action(page)).toBeVisible({ timeout: 20000 });
    await openSection(page, COLOUR_SECTION);
    await expect(
      colourGroup(page).locator(`[data-option-id="${PRICED_COLOUR}"]`),
    ).toHaveAttribute('data-selected', 'true');
    expect(adds).toEqual([]);
  });
});

test.describe('Configurator press straight after typing', () => {
  /** The cabinet seed's width: a number field on its first section. */
  const WIDTH = 'cab-width';

  test('commits once and adds once when the action is pressed while the typed value is sent', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page, CART_SEED_ALIAS);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page, CART_SEED_ALIAS);
    await openSection(page, 'cabinet');
    const commit = action(page);
    await expect(commit).toBeEnabled({ timeout: 30_000 });

    // The fixture answers before the mouse comes up, which would hide the
    // race; held, the batch is in flight for the whole press, as on the real
    // backend.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/configurations/*/changes', async (route) => {
      await held;
      await route.continue();
    });

    const sent = { changes: 0, commits: 0, adds: 0 };
    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      const url = request.url();
      if (/\/api\/configurations\/[^/]+\/changes$/.test(url)) sent.changes++;
      if (/\/api\/configurations\/[^/]+\/commit$/.test(url)) sent.commits++;
      if (/\/api\/configurations\/[^/]+\/cart$/.test(url)) sent.adds++;
    });

    const linesBefore = await cartLineIds(page);
    try {
      const input = page
        .locator(
          `[data-testid="configurator-variable"][data-variable-id="${WIDTH}"]`,
        )
        .locator('input');
      await input.fill('900');

      const changed = changeResponse(page);
      const added = page.waitForResponse(
        (response) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(response.url()) &&
          response.request().method() === 'POST',
      );
      // No Enter, no Tab: the press itself blurs the field.
      await commit.click();
      await expect(commit).toHaveAttribute('aria-busy', 'true');
      expect(sent).toEqual({ changes: 1, commits: 0, adds: 0 });

      release();
      expect((await changed).status()).toBe(200);
      await expect
        .poll(() => ({ ...sent }))
        .toEqual({ changes: 1, commits: 1, adds: 1 });
      expect((await added).status()).toBe(200);
      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      expect(sent).toEqual({ changes: 1, commits: 1, adds: 1 });
      expect((await cartLineIds(page)).length).toBe(linesBefore.length + 1);
    } finally {
      release();
      await removeCartLines(page, linesBefore);
    }
  });
});

test.describe('Configurator leaving the page', () => {
  /** Opens the configurator and answers the id of the session it created. */
  async function openedSession(page: Page): Promise<string> {
    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/configurations' &&
        response.request().method() === 'POST',
    );
    await openConfigurator(page);
    const { configurationId } = (await (await created).json()) as {
      configurationId: string;
    };
    await expect(action(page)).toHaveAttribute('aria-busy', 'false');
    return configurationId;
  }

  function deletesOf(page: Page): string[] {
    const urls: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'DELETE' &&
        /\/api\/configurations\/[^/]+$/.test(request.url())
      ) {
        urls.push(new URL(request.url()).pathname);
      }
    });
    return urls;
  }

  test('deletes the session when the buyer navigates away inside the app', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    const id = await openedSession(page);
    const deletes = deletesOf(page);
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname === `/api/configurations/${id}`,
    );

    await page.getByTestId('topbar-portal').click();
    await page.waitForURL(/\/portal/);

    expect((await deleted).status()).toBe(204);
    expect(deletes).toEqual([`/api/configurations/${id}`]);
  });

  test('deletes the session when the buyer loads another page', async ({
    page,
    browserName,
  }) => {
    // Whether WebKit delivers a keepalive request started on pagehide during a
    // full load is a race: macOS WebKit lost it 9 of 10 times, Linux WebKit
    // won it 6 to 10 of 10 (2026-10-08). Real Safari lost it by hand.
    outOfScope(
      browserName === 'webkit',
      'browser-engine',
      'Safari drops a keepalive request started on pagehide during a full load, and WebKit differs by platform; the same leave is proven on chromium and Mobile Chrome',
    );
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    const id = await openedSession(page);
    const session = async () =>
      (await page.request.get(`/api/configurations/${id}`)).status();
    expect(await session()).toBe(200);

    // A full load: the page is not unmounted, only hidden.
    await page.goto('/');

    // The server, not the request: Playwright does not report a keepalive
    // request sent during a full navigation in a production build.
    await expect.poll(session, { timeout: 5_000 }).toBe(410);
  });
});
