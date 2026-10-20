import { test, expect, type Page, type Request } from './fixtures';
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

interface ShownImage {
  currentSrc: string;
  fit: string;
  box: { width: number; height: number };
  natural: { width: number; height: number };
  dpr: number;
  /** Whether a box within three levels up has a ratio set by the layout. */
  fixedRatio: boolean;
}

/** Every visible library image on the page, with its box and what it shows. */
async function shownLibraryImages(page: Page): Promise<ShownImage[]> {
  const images = await page.locator('img').evaluateAll((els) =>
    (els as HTMLImageElement[])
      .filter((img) => img.getBoundingClientRect().width > 0)
      .map((img) => {
        let fixedRatio = false;
        let el: HTMLElement | null = img.parentElement;
        for (let i = 0; el && i < 3; i++, el = el.parentElement)
          if (getComputedStyle(el).aspectRatio !== 'auto') fixedRatio = true;
        const rect = img.getBoundingClientRect();
        return {
          currentSrc: img.currentSrc,
          fit: getComputedStyle(img).objectFit,
          box: { width: rect.width, height: rect.height },
          natural: { width: img.naturalWidth, height: img.naturalHeight },
          dpr: window.devicePixelRatio,
          fixedRatio,
        };
      }),
  );
  return images.filter((img) =>
    new URL(img.currentSrc || 'about:blank').searchParams.has('width'),
  );
}

/** Scrolls the page through once, so lazy images load, and waits for them. */
async function loadEveryImage(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });
  await expect
    .poll(() =>
      page
        .locator('img[srcset]')
        .evaluateAll((els) =>
          (els as HTMLImageElement[]).every(
            (img) => img.getBoundingClientRect().width === 0 || img.complete,
          ),
        ),
    )
    .toBe(true);
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

  test('the data sheet button prints the extra images, loaded when it prints', async ({
    page,
  }) => {
    const product = await libraryProduct(page, 2);
    outOfScope(
      !product,
      'tenant-config',
      'no ordinary product with two or more library images',
    );

    // Records the print-only tiles at the moment the button prints, which is
    // what the browser lays out; the stub keeps the print dialog away.
    await page.addInitScript(() => {
      window.print = () => {
        const tiles = [
          ...document.querySelectorAll<HTMLImageElement>(
            '[data-testid="pdp-print-extra-images"] img',
          ),
        ];
        document.body.dataset.tilesAtPrint = JSON.stringify(
          tiles.map((img) => img.complete && img.naturalWidth > 0),
        );
      };
    });
    await page.goto(`/p/${product!.alias}`);
    await waitForHydration(page);
    await page.waitForLoadState('load');

    await page.getByTestId('pdp-print').click();

    const printed = JSON.parse(
      (await page.locator('body').getAttribute('data-tiles-at-print')) ?? '[]',
    ) as boolean[];
    expect(printed.length).toBeGreaterThan(0);
    expect(printed).toEqual(printed.map(() => true));
  });

  test('the data sheet prints the primary image on top after the gallery moved on', async ({
    page,
  }) => {
    const product = await libraryProduct(page, 2);
    outOfScope(
      !product,
      'tenant-config',
      'no ordinary product with two or more library images',
    );
    const pathOf = (url: string) => new URL(url).pathname;
    const primary = pathOf(product!.productImages![0]!.url!);

    // Records the print-only top image and the extra tiles at the moment the
    // button prints, which is what the browser lays out; the stub keeps the
    // print dialog away.
    await page.addInitScript(() => {
      window.print = () => {
        const shot = (selector: string) =>
          [...document.querySelectorAll<HTMLImageElement>(selector)].map(
            (img) => ({
              path: new URL(img.currentSrc || img.src).pathname,
              loaded: img.complete && img.naturalWidth > 0,
            }),
          );
        document.body.dataset.printed = JSON.stringify({
          top: shot('[data-testid="gallery-print-primary"] img'),
          tiles: shot('[data-testid="pdp-print-extra-images"] img'),
        });
      };
    });
    await page.goto(`/p/${product!.alias}`);
    await waitForHydration(page);
    await page.waitForLoadState('load');

    await page.getByTestId('gallery-next').click();
    const shown = page.getByTestId('gallery-main').locator('img');
    await expect
      .poll(async () =>
        pathOf(await shown.evaluate((img: HTMLImageElement) => img.src)),
      )
      .not.toBe(primary);

    await page.getByTestId('pdp-print').click();

    const printed = JSON.parse(
      (await page.locator('body').getAttribute('data-printed')) ?? '{}',
    ) as {
      top: { path: string; loaded: boolean }[];
      tiles: { path: string; loaded: boolean }[];
    };
    expect(printed.top).toEqual([{ path: primary, loaded: true }]);
    expect(printed.tiles.length).toBeGreaterThan(0);
    expect(printed.tiles.map((t) => t.path)).not.toContain(primary);

    // The print layout shows that image, not the one the gallery moved to.
    await page.emulateMedia({ media: 'print' });
    const top = page.getByTestId('product-gallery').locator('img:visible');
    await expect(top).toHaveCount(1);
    expect(
      pathOf(await top.evaluate((img: HTMLImageElement) => img.currentSrc)),
    ).toBe(primary);
  });

  test('a start-page widget image is fetched from the library', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);

    // A full-width banner's <picture> has its own test below.
    const images = page.locator(
      '[data-testid="cms-widget"] img[srcset]:not(picture > img)',
    );
    outOfScope(
      (await images.count()) === 0,
      'tenant-config',
      'no start-page widget image is in the asset library',
    );
    // Without the banner the first may sit below the fold, loading lazily.
    await images.first().scrollIntoViewIfNeeded();
    await expectLibraryImage(images.first(), LADDER);
  });

  test('an image cropped into a box of fixed ratio is asked of the CDN in that shape', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    const cropped: ShownImage[] = [];
    for (const path of ['/', `/${category.alias}`]) {
      await page.goto(path);
      await waitForHydration(page);
      await loadEveryImage(page);
      cropped.push(
        ...(await shownLibraryImages(page)).filter(
          (img) => img.fit === 'cover' && img.fixedRatio,
        ),
      );
    }
    outOfScope(
      cropped.length === 0,
      'tenant-config',
      'no library image in a box of fixed ratio on the start page or the first category',
    );

    for (const img of cropped) {
      const url = new URL(img.currentSrc);
      const width = Number(url.searchParams.get('width'));
      const height = Number(url.searchParams.get('height'));
      const boxRatio = img.box.width / img.box.height;
      // Without fit=crop the CDN stretches the image to both sizes.
      expect(url.searchParams.get('fit'), img.currentSrc).toBe('crop');
      expect(width / height, img.currentSrc).toBeCloseTo(boxRatio, 1);
      // The width is the covering step or the one below it, and the height
      // follows from the box, so the crop is never short of the box.
      const step = coveringStep(Math.ceil(img.box.width * img.dpr));
      expect(width).toBeLessThanOrEqual(step);
      expect(width).toBeGreaterThanOrEqual(
        LADDER[Math.max(0, LADDER.indexOf(step) - 1)]!,
      );
      expect(height).toBeCloseTo(width / boxRatio, -1);
      // What arrived has the box's shape: the CDN cropped, it did not letterbox.
      expect(
        img.natural.width / img.natural.height,
        img.currentSrc,
      ).toBeCloseTo(boxRatio, 1);
    }
  });

  test('a full-width banner is asked to cover its box, and fetched once', async ({
    page,
  }) => {
    const requests = recordLibraryRequests(page);
    await page.goto('/');
    await waitForHydration(page);
    await page.waitForLoadState('load');

    // Full width, and cropped: an image whose box follows its own shape, such
    // as an image widget, is not a banner of fixed height.
    const viewport = page.viewportSize()!;
    const banner = (await shownLibraryImages(page)).find(
      (img) =>
        img.fit === 'cover' &&
        img.box.width >= viewport.width * 0.95 &&
        img.natural.height > 0 &&
        Math.abs(
          img.box.width /
            img.box.height /
            (img.natural.width / img.natural.height) -
            1,
        ) > 0.03,
    );
    outOfScope(
      !banner,
      'tenant-config',
      'no full-width library banner on the start page',
    );

    const url = new URL(banner!.currentSrc);
    // fit=cover returns the whole image, scaled to cover both sizes; the
    // img's object-cover then crops it as before.
    expect(url.searchParams.get('fit')).toBe('cover');
    expect(Number(url.searchParams.get('width'))).toBeGreaterThanOrEqual(
      banner!.box.width * banner!.dpr,
    );
    expect(Number(url.searchParams.get('height'))).toBeGreaterThanOrEqual(
      banner!.box.height * banner!.dpr,
    );
    expect(requests.filter((r) => r.url() === banner!.currentSrc)).toHaveLength(
      1,
    );
  });

  test('an image that keeps its own shape is asked for by width only', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);
    await loadEveryImage(page);

    const ownShape = (await shownLibraryImages(page)).filter(
      (img) => img.fit === 'fill' || img.fit === 'contain',
    );
    outOfScope(
      ownShape.length === 0,
      'tenant-config',
      'no start-page library image that keeps its own shape',
    );
    for (const img of ownShape) {
      const url = new URL(img.currentSrc);
      expect(url.searchParams.has('height'), img.currentSrc).toBe(false);
      expect(url.searchParams.has('fit'), img.currentSrc).toBe(false);
    }
  });

  test.describe('signed in', () => {
    test.use({ storageState: signedInState });

    test('the start-page banner is fetched from the library', async ({
      page,
    }) => {
      await page.goto('/');
      await waitForHydration(page);

      const images = page.locator(
        '[data-testid="cms-widget"] img[srcset]:not(picture > img)',
      );
      outOfScope(
        (await images.count()) === 0,
        'tenant-config',
        'no signed-in start-page widget image is in the asset library',
      );
      await images.first().scrollIntoViewIfNeeded();
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
