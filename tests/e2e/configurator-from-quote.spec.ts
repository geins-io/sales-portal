import { test, expect, type Page } from './fixtures';
import {
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';

/**
 * Opening a configured line of a quotation draft in the configurator, end to
 * end on a real CPQ backend, and leaving it without saving. The server replays
 * the line's choices into a new session; leaving releases that session and
 * leaves the draft as it was. Nothing is written to the draft: a save would
 * reach the account's external system on every run, so the save is covered by
 * the server and component tests.
 *
 * The draft is a standing test draft of the monitor account's buyer, with one
 * configured line whose Steel Quality is off its default. Where it is not
 * there — another tenant, another buyer — the file is out of scope rather
 * than failing.
 */

const DRAFT_NUMBER = '2611-3-0021-00';
const GROUP_NAME = 'Steel Quality';
const LINE_OPTION = 'Wear resistant steel';

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'opening a draft line needs a signed-in buyer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

interface DraftLine {
  id: string;
  alias?: string | null;
  quantity: number;
  configuration?: { configurationId: string };
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

/** The standing draft's id, or null where this buyer has no such draft. */
async function draftId(page: Page): Promise<string | null> {
  const response = await page.request.get('/api/quotes');
  if (!response.ok()) return null;
  const { quotes } = (await response.json()) as {
    quotes: { id: string; quoteNumber: string; status: string }[];
  };
  const draft = quotes.find((q) => q.quoteNumber === DRAFT_NUMBER);
  return draft?.status === 'request_draft' ? draft.id : null;
}

async function configuredLine(page: Page, id: string): Promise<DraftLine> {
  const response = await page.request.get(`/api/quotes/${id}`);
  expect(response.ok(), `draft ${DRAFT_NUMBER} could not be read`).toBe(true);
  const { quote } = (await response.json()) as {
    quote: { lineItems: DraftLine[] };
  };
  const line = quote.lineItems.find((l) => l.configuration);
  expect(line, `draft ${DRAFT_NUMBER} has no configured line`).toBeDefined();
  return line!;
}

/** Where the group sits in a document, by the provider's own ids. */
function locate(sections: WireSection[]): {
  sectionId: string;
  group: WireGroup;
  optionId: string;
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
  const option = found!.group.options.find((o) => o.name === LINE_OPTION);
  expect(option, `${LINE_OPTION} is not in ${GROUP_NAME}`).toBeDefined();
  return { ...found!, optionId: option!.id };
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

test.describe('Opening a configured draft line', () => {
  test.describe.configure({ timeout: 120_000 });

  let id: string;
  let line: DraftLine;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const found = await draftId(page);
    outOfScope(
      !found,
      'tenant-config',
      `draft ${DRAFT_NUMBER} is not a draft of this buyer on this target (it is the monitor account's buyer's)`,
    );
    id = found!;
    line = await configuredLine(page, id);
    outOfScope(
      !line.alias || !(await isConfigurable(page, line.alias)),
      'tenant-config',
      "the draft line's product is not configurable on this target (it is on the monitor account with the merchant-api backend)",
    );
  });

  test("opens the configurator holding the line's choices, and leaving it leaves the draft as it was", async ({
    page,
  }) => {
    await page.goto(`/se/sv/portal/quotations/${id}`);
    await waitForHydration(page);

    const change = page
      .getByTestId('quote-item-edit-configuration')
      .filter({ visible: true })
      .first();
    await expect(change).toHaveAttribute(
      'href',
      new RegExp(`\\?quote=${id}&quoteLine=${line.id}$`),
    );

    const replayed = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/configurations/from-quote') &&
        r.request().method() === 'POST',
    );
    await change.click();
    const response = await replayed;

    expect(response.status()).toBe(200);
    expect(JSON.parse(response.request().postData() ?? '{}')).toEqual({
      productId: expect.any(String),
      quoteId: id,
      lineId: line.id,
    });
    const body = (await response.json()) as {
      replayed: boolean;
      configuration: {
        configurationId: string;
        quantity: number;
        sections: WireSection[];
      };
    };
    expect(body.replayed).toBe(true);
    expect(body.configuration.quantity).toBe(line.quantity);
    await expect(page.getByTestId('configurator-not-replayed')).toHaveCount(0);
    await expect(page.getByTestId('configurator-quote-marker')).toBeVisible();

    // Off the default, so a fresh start would show something else here.
    const where = locate(body.configuration.sections);
    await openSection(page, where.sectionId);
    const chooser = page
      .locator(
        `[data-testid="configurator-group"][data-group-id="${where.group.id}"]`,
      )
      .getByTestId('configurator-group-chooser');
    await expect(chooser).toHaveAttribute('data-option-id', where.optionId);
    await expect(chooser).toHaveAttribute('data-selected', 'true');

    const released = page.waitForRequest(
      (r) =>
        r
          .url()
          .endsWith(
            `/api/configurations/${body.configuration.configurationId}`,
          ) && r.method() === 'DELETE',
    );
    await page.getByTestId('configurator-edit-cancel').click();
    await released;
    await expect(page).toHaveURL(new RegExp(`/portal/quotations/${id}$`));

    const after = await configuredLine(page, id);
    expect(after.id).toBe(line.id);
    expect(after.quantity).toBe(line.quantity);
    expect(after.configuration?.configurationId).toBe(
      line.configuration?.configurationId,
    );
  });
});
