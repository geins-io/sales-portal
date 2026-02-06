/**
 * Integration tests for the sales portal service layer.
 *
 * These tests call our actual service functions (products, search, cart, etc.)
 * against the real Geins API (monitor account). They validate that our GraphQL
 * queries return the right shape, our service wiring is correct, and commerce
 * flows work end-to-end.
 *
 * The H3Event + getTenant are stubbed so service functions resolve to the
 * monitor account's Geins settings — same as a real request from a configured tenant.
 *
 * Requires GEINS_* env vars (loaded from .env).
 * Skipped automatically when credentials are not available.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { H3Event } from 'h3';
import {
  geinsSettings,
  userCredentials,
  omsSettings,
  hasGeinsCredentials,
  hasCrmCredentials,
} from './geins-settings';

// Stub Nitro auto-imports so getGeinsClient(event) resolves to monitor settings
vi.stubGlobal(
  'getTenant',
  vi.fn().mockResolvedValue({
    hostname: 'test-integration.local',
    geinsSettings,
  }),
);
vi.stubGlobal('createAppError', (_code: string, message: string) => {
  throw new Error(message);
});
vi.stubGlobal('ErrorCode', { BAD_REQUEST: 'BAD_REQUEST' });

const runIntegration = hasGeinsCredentials();
const runCrm = hasCrmCredentials();

/** Fake H3Event with tenant context — enough for getGeinsClient to work. */
const event = {
  context: { tenant: { hostname: 'test-integration.local' } },
} as unknown as H3Event;

describe.skipIf(!runIntegration)('Sales portal service integration', () => {
  // ── Storefront config ────────────────────────────────────────────────

  describe('storefront config', () => {
    let channels: typeof import('../../../server/services/channels');

    beforeAll(async () => {
      channels = await import('../../../server/services/channels');
    });

    it('should load channel with markets, languages, and currencies', async () => {
      const result = await channels.getChannel(event);

      const data = result as { channel: Record<string, unknown> };
      expect(data.channel).toBeDefined();
      expect(data.channel.defaultMarketId).toBeDefined();

      const markets = data.channel.markets as Array<Record<string, unknown>>;
      expect(markets.length).toBeGreaterThan(0);
      expect(markets[0]).toHaveProperty('currency');
      expect(markets[0]).toHaveProperty('country');
      expect(markets[0]).toHaveProperty('allowedLanguages');
    }, 10_000);
  });

  // ── Product listing & filtering ──────────────────────────────────────

  describe('product listing', () => {
    let productLists: typeof import('../../../server/services/product-lists');

    beforeAll(async () => {
      productLists = await import('../../../server/services/product-lists');
    });

    it('should list products with pagination', async () => {
      const result = await productLists.getProducts({ take: 3 }, event);

      const data = result as {
        products: { products: Array<Record<string, unknown>>; count: number };
      };
      expect(data.products.count).toBeGreaterThan(0);
      expect(data.products.products).toHaveLength(3);

      const product = data.products.products[0];
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('alias');
      expect(product).toHaveProperty('unitPrice');
      expect(product).toHaveProperty('totalStock');
      expect(product).toHaveProperty('skus');
    });

    it('should filter products by category', async () => {
      const result = await productLists.getProducts(
        { categoryAlias: 'elektronik', take: 5 },
        event,
      );

      const data = result as {
        products: { products: Array<Record<string, unknown>>; count: number };
      };
      expect(data.products.count).toBeGreaterThan(0);
      expect(data.products.products.length).toBeLessThanOrEqual(5);
    });

    it('should filter products by brand', async () => {
      const result = await productLists.getProducts(
        { brandAlias: 'nike', take: 5 },
        event,
      );

      const data = result as {
        products: { products: Array<Record<string, unknown>>; count: number };
      };
      expect(data.products.count).toBeGreaterThan(0);
    });

    it('should return filters for a product list', async () => {
      const result = await productLists.getFilters({}, event);

      const data = result as {
        products: { count: number; filters: Array<Record<string, unknown>> };
      };
      expect(data.products.count).toBeGreaterThan(0);
      expect(data.products.filters).toBeDefined();
    });

    it('should load category page with subcategories', async () => {
      const result = await productLists.getCategoryPage(
        { alias: 'elektronik' },
        event,
      );

      const data = result as {
        listPageInfo: { id: number; name: string; subCategories: unknown[] };
      };
      expect(data.listPageInfo).toBeDefined();
      expect(data.listPageInfo.name).toBe('Elektronik');
      expect(data.listPageInfo.subCategories).toBeDefined();
    });

    it('should load brand page', async () => {
      const result = await productLists.getBrandPage({ alias: 'nike' }, event);

      const data = result as { listPageInfo: { id: number; name: string } };
      expect(data.listPageInfo).toBeDefined();
      expect(data.listPageInfo.name).toBe('Nike');
    });
  });

  // ── Product detail ───────────────────────────────────────────────────

  describe('product detail', () => {
    let products: typeof import('../../../server/services/products');
    let productLists: typeof import('../../../server/services/product-lists');
    let productAlias: string;

    beforeAll(async () => {
      products = await import('../../../server/services/products');
      productLists = await import('../../../server/services/product-lists');

      // Get a real product alias
      const list = await productLists.getProducts({ take: 1 }, event);
      const data = list as { products: { products: Array<{ alias: string }> } };
      productAlias = data.products.products[0].alias;
    });

    it('should load full product with price, stock, SKUs, and meta', async () => {
      const result = await products.getProduct({ alias: productAlias }, event);

      const data = result as { product: Record<string, unknown> };
      expect(data.product).toBeDefined();
      expect(data.product.name).toBeDefined();
      expect(data.product.unitPrice).toBeDefined();
      expect(data.product.totalStock).toBeDefined();
      expect(data.product.skus).toBeDefined();
      expect(data.product.meta).toBeDefined();
    });

    it('should load related products', async () => {
      const result = await products.getRelatedProducts(
        { alias: productAlias },
        event,
      );

      // May be empty if no relations, but query should not error
      expect(result).toHaveProperty('relatedProducts');
    });

    it('should load price history', async () => {
      const result = await products.getPriceHistory(
        { alias: productAlias },
        event,
      );

      expect(result).toHaveProperty('product');
    });
  });

  // ── Search ───────────────────────────────────────────────────────────

  describe('search', () => {
    let search: typeof import('../../../server/services/search');

    beforeAll(async () => {
      search = await import('../../../server/services/search');
    });

    it('should find products by text query', async () => {
      const result = await search.searchProducts(
        { filter: { searchText: 'skrivbord' } },
        event,
      );

      const data = result as {
        products: { products: Array<Record<string, unknown>>; count: number };
      };
      expect(data.products.count).toBeGreaterThan(0);

      const product = data.products.products[0];
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('unitPrice');
    });

    it('should return empty results for nonsense query', async () => {
      const result = await search.searchProducts(
        { filter: { searchText: 'xyznonexistent99999' } },
        event,
      );

      const data = result as { products: { count: number } };
      expect(data.products.count).toBe(0);
    });
  });

  // ── Navigation data ──────────────────────────────────────────────────

  describe('navigation', () => {
    let categories: typeof import('../../../server/services/categories');
    let brands: typeof import('../../../server/services/brands');

    beforeAll(async () => {
      categories = await import('../../../server/services/categories');
      brands = await import('../../../server/services/brands');
    });

    it('should load all categories', async () => {
      const result = await categories.getCategories(event);

      const data = result as {
        categories: Array<{ name: string; alias: string; categoryId: number }>;
      };
      expect(data.categories.length).toBeGreaterThan(0);
      expect(data.categories[0]).toHaveProperty('name');
      expect(data.categories[0]).toHaveProperty('alias');
      expect(data.categories[0]).toHaveProperty('categoryId');
    });

    it('should load all brands', async () => {
      const result = await brands.getBrands(event);

      const data = result as {
        brands: Array<{ name: string; alias: string; brandId: number }>;
      };
      expect(data.brands.length).toBeGreaterThan(0);
      expect(data.brands[0]).toHaveProperty('name');
      expect(data.brands[0]).toHaveProperty('alias');
      expect(data.brands[0]).toHaveProperty('brandId');
    });
  });

  // ── Cart ──────────────────────────────────────────────────────────────
  // Each service call creates a fresh SDK client (cart ID will come from
  // cookies in production). These tests verify individual operations work.

  describe('cart', () => {
    let cart: typeof import('../../../server/services/cart');

    beforeAll(async () => {
      cart = await import('../../../server/services/cart');
    });

    it('should add an item and auto-create a cart', async () => {
      const added = await cart.addItem(
        { skuId: omsSettings.skus.skuId1, quantity: 1 },
        event,
      );
      expect(added).toBe(true);
    });

    it('should create an empty cart', async () => {
      const newCart = await cart.createCart(event);
      expect(newCart).toBeDefined();
    });

    // Promo code apply/remove requires a cart with items (cart ID is stateful).
    // Each service call creates a fresh SDK client, so promo code integration
    // testing will be done when API routes manage cart ID via cookies.
    // Campaign TEST10 (10% off) is configured on the monitor account for that.
  });

  // ── Auth flow ────────────────────────────────────────────────────────

  describe.skipIf(!runCrm)('auth flow', () => {
    let auth: typeof import('../../../server/services/auth');

    beforeAll(async () => {
      auth = await import('../../../server/services/auth');
    });

    it('should login and retrieve authenticated user', async () => {
      const loginResult = await auth.login(
        {
          username: userCredentials.username,
          password: userCredentials.password,
        },
        event,
      );
      expect(loginResult!.succeeded).toBe(true);
      expect(loginResult!.tokens!.refreshToken).toBeTruthy();
      expect(loginResult!.user).toBeDefined();

      // Get user via auth.getUser (uses refresh + user token)
      const authResult = await auth.getUser(
        loginResult!.tokens!.refreshToken!,
        loginResult!.tokens!.token,
        event,
      );
      expect(authResult!.succeeded).toBe(true);
      expect(authResult!.user).toBeDefined();
    }, 15_000);

    it('should refresh tokens', async () => {
      const loginResult = await auth.login(
        {
          username: userCredentials.username,
          password: userCredentials.password,
        },
        event,
      );
      expect(loginResult!.succeeded).toBe(true);

      const refreshResult = await auth.refresh(
        loginResult!.tokens!.refreshToken!,
        event,
      );
      expect(refreshResult!.succeeded).toBe(true);
      expect(refreshResult!.tokens).toBeDefined();
    }, 15_000);

    it('should reject invalid credentials', async () => {
      const result = await auth.login(
        { username: userCredentials.username, password: 'wrong-password' },
        event,
      );
      expect(result!.succeeded).toBe(false);
    });
  });
});
