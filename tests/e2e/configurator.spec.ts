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
 * commit freezes it. A green run says route, service, fixture and form agree;
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

function changeResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      /\/api\/configurations\/[^/]+\/changes$/.test(response.url()) &&
      response.request().method() === 'POST',
  );
}

test.describe('Configurator', () => {
  test('configures the seeded product to valid and commits it', async ({
    page,
  }) => {
    const unavailable = await unavailableReason(page);
    outOfScope(!!unavailable, 'tenant-config', unavailable ?? '');

    await openConfigurator(page);

    // A fresh document is invalid on the colour group alone; every other
    // required group arrives preselected.
    const validity = page.getByTestId('configurator-panel-validity');
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
    await expect(page.getByTestId('configurator-panel-busy')).toBeHidden();

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

    const committed = page.waitForResponse(
      (response) =>
        /\/api\/configurations\/[^/]+\/commit$/.test(response.url()) &&
        response.request().method() === 'POST',
    );
    await commit.click();
    await committed;

    await expect(page.getByTestId('configurator-committed')).toBeVisible();
    // Quantity is one, so the unit price the commit froze is the price the
    // panel showed before it.
    expect(
      await readPrice(page.getByTestId('configurator-committed-price')),
    ).toBe(priceBefore + PRICED_COLOUR_NET);
    // The specification card stands down behind the committed summary.
    await expect(page.getByTestId('configurator-panel-price')).toBeHidden();
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
    await expect(page.getByTestId('configurator-panel-busy')).toBeVisible();

    // The sheet closed behind the first choice and opens again while the batch
    // is in flight. `force` because the row is disabled until it comes back,
    // and Playwright would otherwise wait for it rather than click.
    const sheet = await openColourSheet(page);
    await sheet
      .locator(`[data-option-id="${OTHER_COLOUR}"]`)
      .click({ force: true });

    release();
    await changed;
    await expect(page.getByTestId('configurator-panel-busy')).toBeHidden();

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
    await expect(page.getByTestId('configurator-panel-busy')).toBeHidden();

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
