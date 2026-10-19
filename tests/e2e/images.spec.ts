import { test, expect, type Page, type Request } from '@playwright/test';
import {
  addToCart,
  discoverCategory,
  discoverPurchasableProduct,
  isConfigurable,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';

/**
 * Images from the asset library: sized by its CDN, served in a format the
 * browser accepts, and the page's largest image fetched first.
 *
 * Only images the API gives a library `url` are asserted on. A tenant whose
 * catalogue is not in the library has none, and every test here declares
 * that out of scope rather than passing on nothing.
 */

const LADDER = [160, 320, 480, 640, 800, 1200, 1600, 2000, 2560];
const THUMBNAIL_LADDER = [80, 160, 240];

interface ListedProduct {
  alias: string;
  configurable?: boolean;
  productImages?: { fileName: string; url?: string | null }[];
}

/** The first ordinary product whose images are all in the library, with at least `images` of them. */
async function libraryProduct(
  page: Page,
  images = 1,
): Promise<ListedProduct | undefined> {
  const response = await page.request.get('/api/product-lists/products', {
    params: { take: '20', filter: JSON.stringify({ sort: 'ALPHABETICAL' }) },
  });
  expect(response.ok()).toBe(true);
  const products: ListedProduct[] = (await response.json()).products ?? [];
  for (const product of products) {
    const list = product.productImages ?? [];
    if (list.length < images || !list.every((i) => i.url)) continue;
    if (product.configurable || (await isConfigurable(page, product.alias)))
      continue;
    return product;
  }
  return undefined;
}

/** `width` asked of the CDN, from an image URL. */
function widthOf(url: string): number {
  return Number(new URL(url).searchParams.get('width'));
}

/** The smallest ladder width that covers `needed` device pixels. */
function coveringStep(needed: number): number {
  return LADDER.find((w) => w >= needed) ?? LADDER.at(-1)!;
}

/**
 * Library image requests, recorded from the start of the page load. Matched
 * on `format=auto` alone: a preload can be typed 'other' rather than 'image',
 * and a double fetch must count twice.
 */
function recordLibraryRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).searchParams.get('format') === 'auto')
      requests.push(request);
  });
  return requests;
}

/**
 * A library image that has loaded, asked of the CDN at a width from `ladder`
 * in a format the browser picks.
 */
async function expectLibraryImage(
  image: ReturnType<Page['locator']>,
  ladder: number[],
) {
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const url = new URL(
    await image.evaluate((img: HTMLImageElement) => img.currentSrc),
  );
  expect(url.searchParams.get('format')).toBe('auto');
  expect(ladder).toContain(Number(url.searchParams.get('width')));
}

async function cartIdOf(page: Page): Promise<string | undefined> {
  return (await page.context().cookies(page.url())).find(
    (c) => c.name === 'cart_id',
  )?.value;
}

/** The lines of the page's cart, none when there is no cart yet. */
async function cartLines(page: Page): Promise<{ id: string }[]> {
  const cartId = await cartIdOf(page);
  if (!cartId) return [];
  const cart = await page.request.get('/api/cart', { params: { cartId } });
  if (!cart.ok()) return [];
  return ((await cart.json()) as { items?: { id: string }[] }).items ?? [];
}

const decode = (value: string | undefined) =>
  (value ?? '').replaceAll('&amp;', '&');

test.describe('Images from the asset library', () => {
  test('product cards are fetched at their rendered size in a format the browser accepts', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    const requests = recordLibraryRequests(page);
    await page.goto(`/${category.alias}`);
    await waitForHydration(page);

    const cards = page.locator('[data-testid="product-card"] img[srcset]');
    outOfScope(
      (await cards.count()) === 0,
      'tenant-config',
      'no product card image is in the asset library',
    );
    const first = cards.first();
    await expect
      .poll(() => first.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    const { currentSrc, cssWidth, dpr } = await first.evaluate(
      (img: HTMLImageElement) => ({
        currentSrc: img.currentSrc,
        cssWidth: img.getBoundingClientRect().width,
        dpr: window.devicePixelRatio,
      }),
    );
    const step = coveringStep(Math.ceil(cssWidth * dpr));
    const asked = widthOf(currentSrc);
    // The covering step, or the one below it: engines may settle for a
    // slightly lower density than the screen's.
    expect(asked).toBeLessThanOrEqual(step);
    expect(asked).toBeGreaterThanOrEqual(
      LADDER[Math.max(0, LADDER.indexOf(step) - 1)]!,
    );

    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      const url = new URL(request.url());
      expect(url.searchParams.get('width')).toMatch(/^\d+$/);
      expect(url.searchParams.get('format')).toBe('auto');
      const response = await request.response();
      if (!response) continue;
      const accept = (await request.allHeaders()).accept ?? '';
      const served = response.headers()['content-type'] ?? '';
      const modern = ['image/avif', 'image/webp', 'image/jxl'].filter((type) =>
        accept.includes(type),
      );
      // Only where the browser said it accepts a modern format can one be
      // expected back; otherwise the parameters are the whole assertion.
      if (modern.length) expect(modern).toContain(served);
    }
  });

  test('a card image below the fold shows once scrolled into view', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);
    await waitForHydration(page);

    const cards = page.locator('[data-testid="product-card"]');
    outOfScope(
      (await cards.count()) < 6,
      'tenant-config',
      'the first category has too few products for a lazy card',
    );
    const card = cards.nth(5);
    const img = card.locator('img');
    await expect(img).toHaveAttribute('loading', 'lazy');

    await card.scrollIntoViewIfNeeded();

    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    await expect(img).toBeVisible();
    await expect(card.locator('.animate-pulse')).toHaveCount(0);
  });

  test('the product list gives its first card priority and loads the rest by place', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    const html = await (await page.request.get(`/${category.alias}`)).text();
    // Each card's own image: the first img after its data-testid, so a
    // library image in the header or a CMS area above the grid never counts.
    const imgs = html
      .split('data-testid="product-card"')
      .slice(1)
      .map((card) => card.match(/<img[^>]*>/)?.[0] ?? '')
      .filter((tag) => tag.includes('srcset='));
    outOfScope(
      imgs.length < 6,
      'tenant-config',
      'fewer than six library card images in the first category',
    );

    expect(imgs[0]).toContain('fetchpriority="high"');
    expect(imgs[0]).toContain('loading="eager"');
    expect(imgs[1]).toContain('loading="eager"');
    expect(imgs[1]).not.toContain('fetchpriority');
    expect(imgs[5]).toContain('loading="lazy"');
    expect(html).toMatch(/<link[^>]+rel="preconnect"[^>]+image-cdn-preconnect/);
  });

  test('the product page’s largest image is preloaded, prioritised and fetched once', async ({
    page,
  }) => {
    const product = await libraryProduct(page);
    outOfScope(
      !product,
      'tenant-config',
      'no ordinary product with its images in the asset library',
    );
    const path = `/p/${product!.alias}`;

    const html = await (await page.request.get(path)).text();
    const head = html.slice(0, html.indexOf('</head>'));
    const preload = head.match(
      /<link[^>]+rel="preload"[^>]+as="image"[^>]*>/,
    )?.[0];
    expect(
      preload,
      'no image preload in the server-rendered head',
    ).toBeTruthy();
    expect(head).toMatch(/<link[^>]+rel="preconnect"[^>]+image-cdn-preconnect/);
    // Crawlers get the primary image from the library at 1200 px, in its own
    // format: no `format=auto`, which could hand them AVIF.
    const ogImage = decode(
      head.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/)?.[1],
    );
    expect(ogImage, 'no og:image in the server-rendered head').toBeTruthy();
    const og = new URL(ogImage);
    const library = product!.productImages!.map((i) => new URL(i.url!));
    expect(og.origin).toBe(library[0]!.origin);
    expect(library.map((u) => u.pathname)).toContain(og.pathname);
    expect(og.searchParams.get('width')).toBe('1200');
    expect(og.searchParams.has('format')).toBe(false);

    const requests = recordLibraryRequests(page);
    await page.goto(path);
    await waitForHydration(page);
    const img = page.locator('[data-testid="product-gallery"] img').first();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    await expect(img).toHaveAttribute('fetchpriority', 'high');
    await expect(img).toHaveAttribute('loading', 'eager');
    expect(await img.getAttribute('decoding')).toBeNull();

    const attr = (name: string) =>
      decode(preload!.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]);
    expect(attr('imagesrcset')).toBe(await img.getAttribute('srcset'));
    expect(attr('imagesizes')).toBe(await img.getAttribute('sizes'));

    const currentSrc = await img.evaluate(
      (el: HTMLImageElement) => el.currentSrc,
    );
    expect(requests.filter((r) => r.url() === currentSrc)).toHaveLength(1);
  });

  test('print-only images are not fetched on screen, and load in print', async ({
    page,
  }) => {
    const product = await libraryProduct(page, 2);
    outOfScope(
      !product,
      'tenant-config',
      'no ordinary product with two or more library images',
    );

    const requests = recordLibraryRequests(page);
    await page.goto(`/p/${product!.alias}`);
    await waitForHydration(page);
    const tiles = page.locator('[data-testid="pdp-print-extra-images"] img');
    await expect(tiles.first()).toBeAttached();
    const tileUrls = await tiles.evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).src.split('?')[0]),
    );
    expect(
      requests.filter((r) => tileUrls.includes(r.url().split('?')[0])),
    ).toHaveLength(0);

    await page.emulateMedia({ media: 'print' });

    await expect
      .poll(() =>
        tiles.evaluateAll((els) =>
          els.every(
            (el) =>
              (el as HTMLImageElement).complete &&
              (el as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
  });

  test('a start-page widget image is fetched from the library', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);

    const images = page.locator('[data-testid="cms-widget"] img[srcset]');
    outOfScope(
      (await images.count()) === 0,
      'tenant-config',
      'no start-page widget image is in the asset library',
    );
    await expectLibraryImage(images.first(), LADDER);
  });

  test.describe('signed in', () => {
    test.use({ storageState: signedInState });

    test('the start-page banner is fetched from the library', async ({
      page,
    }) => {
      await page.goto('/');
      await waitForHydration(page);

      const images = page.locator('[data-testid="cms-widget"] img[srcset]');
      outOfScope(
        (await images.count()) === 0,
        'tenant-config',
        'no signed-in start-page widget image is in the asset library',
      );
      await expectLibraryImage(images.first(), LADDER);
    });

    test('a cart line’s thumbnail is fetched from the library at thumbnail size', async ({
      page,
    }) => {
      const product = await discoverPurchasableProduct(page);
      const before = new Set((await cartLines(page)).map((line) => line.id));
      try {
        await addToCart(page, product.alias);
        await page.goto('/cart');
        await waitForHydration(page);

        const thumbnail = page
          .locator('[data-testid="cart-item-image"] img')
          .first();
        await expect(thumbnail).toBeAttached();
        outOfScope(
          !(await thumbnail.getAttribute('srcset')),
          'tenant-config',
          'the cart line’s image is not in the asset library',
        );
        await expectLibraryImage(thumbnail, THUMBNAIL_LADDER);
      } finally {
        // The signed-in account's cart persists: remove the line added here.
        const cartId = await cartIdOf(page);
        for (const line of await cartLines(page)) {
          if (cartId && !before.has(line.id)) {
            await page.request.delete('/api/cart/items', {
              params: { cartId, itemId: line.id },
            });
          }
        }
      }
    });
  });
});
