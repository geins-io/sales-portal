import { test, expect, type Page } from '@playwright/test';
import {
  hasE2ECredentials,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { localeText } from './locale-text';

/**
 * The configurator page's action against the stock, on a real CPQ backend.
 *
 * Past the stock of a SKU the cart does not refuse a configured line: it
 * replaces the line already holding that stock with the new one, and answers
 * 200. So the page shuts its action once the stock is in the cart, as the
 * ordinary product page does, and a second press must never reach the cart.
 *
 * The product is a configured product on the monitor account with one unit in
 * stock. Where it is not configurable, or its stock has moved, the file is out
 * of scope rather than failing. The test removes what it put in the cart and
 * places no order.
 *
 * Runs with `--workers=1`: the engines share buyer C's one cart, and with one
 * unit in stock a parallel engine's line shuts the action before this add.
 */

const ALIAS = 'super-car';

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'adding a configured line needs a signed-in buyer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

interface Line {
  id: string;
  skuId?: number;
  configuration?: { configurationId: string };
}

/** This host's cart only: the stored session may hold other tenants' cookies. */
async function cartIdOf(page: Page): Promise<string | undefined> {
  return (await page.context().cookies(page.url())).find(
    (c) => c.name === 'cart_id',
  )?.value;
}

async function lines(page: Page, cartId: string): Promise<Line[]> {
  const response = await page.request.get('/api/cart', { params: { cartId } });
  if (!response.ok()) return [];
  return ((await response.json()) as { items?: Line[] }).items ?? [];
}

/** The product's one SKU, when it is configurable and has exactly one unit. */
async function skuWithOneUnit(page: Page): Promise<number | null> {
  const response = await page.request.get(`/api/products/${ALIAS}`);
  if (!response.ok()) return null;
  const product = (await response.json()) as {
    configurable?: boolean;
    skus?: {
      skuId: number;
      stock?: { totalStock: number; oversellable: number; static: number };
    }[];
  };
  const sku = product.skus?.length === 1 ? product.skus[0] : undefined;
  const stock = sku?.stock;
  if (!product.configurable || !sku || !stock) return null;
  const limited = stock.oversellable === 0 && stock.static === 0;
  return limited && stock.totalStock === 1 ? sku.skuId : null;
}

test.describe('Configurator and the stock', () => {
  test.describe.configure({ timeout: 120_000 });

  test('shuts the action once the stock is in the cart, so a second press cannot replace the line', async ({
    page,
  }) => {
    await page.goto('/');
    const skuId = await skuWithOneUnit(page);
    outOfScope(
      skuId === null,
      'tenant-config',
      `${ALIAS} is not a configurable product with one unit in stock on this target (it is on the monitor account with the merchant-api or composite backend)`,
    );

    const sent = { commits: 0, adds: 0 };
    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      const url = request.url();
      if (/\/api\/configurations\/[^/]+\/commit$/.test(url)) sent.commits++;
      if (/\/api\/configurations\/[^/]+\/cart$/.test(url)) sent.adds++;
    });

    let added: string | null = null;
    try {
      await page.goto(`/se/sv/p/${ALIAS}`);
      await waitForHydration(page);
      const commit = page.getByTestId('configurator-commit');
      await expect(commit).toBeEnabled({ timeout: 30_000 });

      const addResponse = page.waitForResponse(
        (r) =>
          /\/api\/configurations\/[^/]+\/cart$/.test(r.url()) &&
          r.request().method() === 'POST',
      );
      await commit.click();
      const response = await addResponse;
      expect(response.status()).toBe(200);
      added = ((await response.json()) as { itemId: string }).itemId;

      const drawer = page.getByTestId('cart-drawer');
      await expect(drawer).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();

      // The page carries on from the line, with its one unit in the cart.
      await expect(commit).toHaveAttribute('aria-busy', 'false', {
        timeout: 30_000,
      });
      await expect(commit).toBeDisabled();
      await expect(commit).toHaveText(
        await localeText(page, 'product.max_in_cart'),
      );
      await expect(
        page.getByTestId('configurator-max-quantity-info'),
      ).toHaveText(await localeText(page, 'product.max_quantity_info'));

      // The press the stock used to let through, which swapped the line.
      await commit.click({ force: true });
      await expect(commit).toHaveAttribute('aria-busy', 'false');
      expect(sent).toEqual({ commits: 1, adds: 1 });

      const cartId = await cartIdOf(page);
      expect(cartId, 'the add left no cart').toBeTruthy();
      const ofSku = (await lines(page, cartId!)).filter(
        (l) => l.skuId === skuId,
      );
      expect(ofSku.map((l) => l.id)).toEqual([added]);
    } finally {
      const cartId = await cartIdOf(page);
      if (cartId) {
        for (const line of await lines(page, cartId)) {
          if (line.skuId !== skuId || !line.configuration) continue;
          await page.request.delete('/api/cart/items', {
            params: { cartId, itemId: line.id },
          });
        }
      }
    }
  });
});
