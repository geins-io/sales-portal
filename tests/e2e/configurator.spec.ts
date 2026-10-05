import { test, expect, type Page } from '@playwright/test';
import {
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  readPrice,
  STORAGE_STATE,
  waitForHydration,
} from './helpers';

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
test.use({ storageState: STORAGE_STATE });

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
