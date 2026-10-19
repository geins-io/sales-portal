import { stat } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { outOfScope, waitForHydration } from './helpers';

/**
 * Product files in the PDP's Documents tab: listed, viewed in a new tab,
 * downloaded under their own name.
 *
 * The product is named rather than discovered: nothing in a product list says
 * which products carry files, and reading every candidate's detail to find one
 * costs a request per product. This one has a PDF and a zip among its files.
 */
const DOCUMENTS_ALIAS = 'momentnyckel-40-200-nm-1-2';

interface FileAsset {
  name: string;
  url: string;
  sizeBytes: number;
}

async function productFiles(page: Page): Promise<FileAsset[]> {
  const response = await page.request.get(`/api/products/${DOCUMENTS_ALIAS}`);
  if (!response.ok()) return [];
  const product = await response.json();
  return (product?.assets ?? []).filter(
    (asset: { linkType?: string }) => asset.linkType === 'productfile',
  );
}

/** The visible documents list: the tab on desktop, the accordion below md. */
async function openDocuments(page: Page) {
  await page.goto(`/p/${DOCUMENTS_ALIAS}`);
  await waitForHydration(page);

  const tabs = page.locator('[data-testid="product-tabs"]');
  const tab = tabs.locator('[role="tab"]', { hasText: /\(\d+\)/ });
  if (await tab.isVisible()) {
    await tab.click();
    return tabs.locator('[role="tabpanel"] [data-testid="product-documents"]');
  }
  // Below md the tab row is hidden but still in the DOM. The accordion
  // trigger carries the same label as the tab, without the count.
  const label = (await tab.textContent())!.replace(/\(\d+\)/, '').trim();
  await tabs
    .locator('button[aria-expanded]', { hasText: new RegExp(`^${label}$`) })
    .click();
  return tabs.locator('[data-testid="product-documents"]:visible');
}

test.describe('product documents', () => {
  let files: FileAsset[] = [];

  test.beforeEach(async ({ page }) => {
    files = await productFiles(page);
    outOfScope(
      files.length === 0,
      'fixture-missing',
      `${DOCUMENTS_ALIAS} is missing from the catalogue or has no files`,
    );
  });

  test('lists every file of the product', async ({ page }) => {
    const list = await openDocuments(page);
    await expect(list).toBeVisible();
    await expect(list.locator('[data-testid="product-document"]')).toHaveCount(
      files.length,
    );
    await expect(
      list.locator('[data-testid="product-document-download"]'),
    ).toHaveCount(files.length);
  });

  test('View opens a PDF in a new tab', async ({ page, context }) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    outOfScope(!pdf, 'fixture-missing', `${DOCUMENTS_ALIAS} has no PDF`);

    const list = await openDocuments(page);
    const view = list.locator(
      `[data-testid="product-document-view"][href="${pdf!.url}"]`,
    );
    await expect(view).toHaveAttribute('target', '_blank');

    // Asserted on the request, not on the new tab's URL: a headless browser
    // may save a PDF instead of showing it, and the tab then stays blank.
    const [opened, request] = await Promise.all([
      context.waitForEvent('page'),
      context.waitForEvent('request', (r) => r.url() === pdf!.url),
      view.click(),
    ]);
    expect(opened).not.toBe(page);
    expect(request.frame().page()).toBe(opened);
  });

  // A PDF, because a browser shows it rather than saving it: only the CDN's
  // attachment answer turns it into a download, where a zip would download
  // either way.
  test('Download saves a PDF under its own name', async ({ page, context }) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    outOfScope(!pdf, 'fixture-missing', `${DOCUMENTS_ALIAS} has no PDF`);

    const list = await openDocuments(page);
    const download = list.locator(
      `[data-testid="product-document-download"][href="${pdf!.url}?download=1"]`,
    );

    const tabsBefore = context.pages().length;
    const [saved] = await Promise.all([
      page.waitForEvent('download'),
      download.click(),
    ]);
    expect(saved.suggestedFilename()).toBe(pdf!.name);
    // The bytes, not just the name: a saved error page would pass the above.
    expect((await stat(await saved.path())).size).toBe(pdf!.sizeBytes);
    expect(context.pages()).toHaveLength(tabsBefore);
  });
});
