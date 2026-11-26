import { expect, type Page } from './fixtures';
import { isE2EData, readPrice } from './helpers';
import { apiGet } from './api-call';

/** What more than one portal-*.spec.ts file reads the portal with. */

export const PAGE_TIMEOUT = 20000;

/**
 * The account's quotations, newest first as `/api/quotes` returns them, less
 * those another spec created for itself.
 */
export async function fetchListedQuotes(
  page: Page,
): Promise<{ id: string; status: string }[]> {
  // Every tab at once; the account holds fewer than Geins' 100 a read.
  const response = await apiGet(page.request, '/api/quotes?take=100');
  expect(response.ok(), '/api/quotes did not answer 200').toBe(true);
  return (
    (await response.json()) as {
      quotes: { id: string; status: string; name?: string }[];
    }
  ).quotes.filter((quote) => !isE2EData(quote.name));
}

/** Ids of the account's pending quotations, in list order. */
export async function fetchPendingQuoteIds(page: Page): Promise<string[]> {
  return (await fetchListedQuotes(page))
    .filter((quote) => quote.status === 'pending')
    .map((quote) => quote.id);
}

/** One rendered order or quotation line: the three numbers a line shows. */
export interface ScreenLine {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * An order's or a quotation's lines as the running project can see them; both
 * pages use the same parts. Above `lg` they are the
 * desktop table; below it that table is hidden and the rows live in the
 * sheet behind `view-rows-trigger`. Both carry the same three numbers per
 * line, so no project has to leave the line assertions off.
 */
export async function readItemLines(page: Page): Promise<ScreenLine[]> {
  const onDesktop = await page
    .locator('[data-testid="order-items-table"]')
    .isVisible()
    .catch(() => false);

  if (!onDesktop) {
    await page.locator('[data-testid="view-rows-trigger"]').click();
    await expect(page.locator('[data-testid="item-rows-sheet"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  }

  const prefix = onDesktop ? 'order-item' : 'item-rows';
  const rows = page.locator(
    onDesktop
      ? '[data-testid="order-item-row"]'
      : '[data-testid="item-rows-row"]',
  );

  const lines: ScreenLine[] = [];
  for (let index = 0; index < (await rows.count()); index++) {
    const row = rows.nth(index);
    const quantity = (
      await row.locator(`[data-testid="${prefix}-quantity"]`).innerText()
    ).trim();
    lines.push({
      quantity: Number(quantity),
      unitPrice: await readPrice(
        row.locator(`[data-testid="${prefix}-unit-price"]`),
      ),
      totalPrice: await readPrice(
        row.locator(`[data-testid="${prefix}-total-price"]`),
      ),
    });
    expect(
      Number.isFinite(lines[index]!.quantity),
      `line ${index} shows no quantity: ${JSON.stringify(quantity)}`,
    ).toBe(true);
  }
  return lines;
}

/**
 * An order or quotation amount as the order page writes it: two decimals,
 * whatever the decimal separator and wherever the currency stands
 * ("4,00 kr", "SEK 10,039.00", "$12.34").
 */
export const TWO_DECIMALS = /\d[.,]\d{2}(?:\s*[^\d\s.,]+)?$/;
