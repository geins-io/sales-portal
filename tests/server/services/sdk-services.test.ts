import { describe, it, expect, vi } from 'vitest';

/**
 * Smoke tests for the service layer exports.
 *
 * Verifies that every public service function exists and is callable.
 * Behavioral coverage is provided by the API route tests (which mock at the
 * SDK boundary and let services execute for real) and by
 * integration.test.ts (which runs against the real Geins API).
 */

// Mock the SDK boundary so service modules can be imported
const mockGraphqlQuery = vi.fn().mockResolvedValue({ data: {} });
const mockGraphqlMutation = vi.fn().mockResolvedValue({ data: {} });
const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
    graphql: { query: mockGraphqlQuery, mutation: mockGraphqlMutation },
  },
  crm: {
    auth: {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      getUser: vi.fn(),
    },
    user: {
      get: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      password: {
        change: vi.fn(),
        requestReset: vi.fn(),
        commitReset: vi.fn(),
      },
      orders: { get: vi.fn() },
    },
  },
  cms: {
    menu: { get: vi.fn() },
    page: { get: vi.fn() },
    area: { get: vi.fn() },
  },
  oms: {
    cart: {
      get: vi.fn(),
      create: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      setPromotionCode: vi.fn(),
      removePromotionCode: vi.fn(),
    },
    checkout: {
      get: vi.fn(),
      validate: vi.fn(),
      createOrder: vi.fn(),
      summary: vi.fn(),
      createToken: vi.fn(),
    },
    order: { get: vi.fn() },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));
vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((r: unknown) => r),
}));

vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('createAppError', vi.fn());
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
});

describe('Service layer exports', () => {
  it('auth service exports all expected functions', async () => {
    const auth = await import('../../../server/services/auth');
    expect(auth.login).toBeTypeOf('function');
    expect(auth.logout).toBeTypeOf('function');
    expect(auth.refresh).toBeTypeOf('function');
    expect(auth.getUser).toBeTypeOf('function');
  });

  it('user service exports all expected functions', async () => {
    const user = await import('../../../server/services/user');
    expect(user.getUser).toBeTypeOf('function');
    expect(user.updateUser).toBeTypeOf('function');
    expect(user.changePassword).toBeTypeOf('function');
    expect(user.register).toBeTypeOf('function');
    expect(user.requestPasswordReset).toBeTypeOf('function');
    expect(user.commitPasswordReset).toBeTypeOf('function');
    expect(user.getUserOrders).toBeTypeOf('function');
  });

  it('cms service exports all expected functions', async () => {
    const cms = await import('../../../server/services/cms');
    expect(cms.getMenu).toBeTypeOf('function');
    expect(cms.getPage).toBeTypeOf('function');
    expect(cms.getContentArea).toBeTypeOf('function');
  });

  it('cart service exports all expected functions', async () => {
    const cart = await import('../../../server/services/cart');
    expect(cart.getCart).toBeTypeOf('function');
    expect(cart.createCart).toBeTypeOf('function');
    expect(cart.addItem).toBeTypeOf('function');
    expect(cart.updateItem).toBeTypeOf('function');
    expect(cart.deleteItem).toBeTypeOf('function');
    expect(cart.applyPromoCode).toBeTypeOf('function');
    expect(cart.removePromoCode).toBeTypeOf('function');
  });

  it('checkout service exports all expected functions', async () => {
    const checkout = await import('../../../server/services/checkout');
    expect(checkout.getCheckout).toBeTypeOf('function');
    expect(checkout.validateOrder).toBeTypeOf('function');
    expect(checkout.createOrder).toBeTypeOf('function');
    expect(checkout.getSummary).toBeTypeOf('function');
    expect(checkout.createToken).toBeTypeOf('function');
  });

  it('orders service exports getOrder', async () => {
    const orders = await import('../../../server/services/orders');
    expect(orders.getOrder).toBeTypeOf('function');
  });

  it('products service exports all expected functions', async () => {
    const products = await import('../../../server/services/products');
    expect(products.getProduct).toBeTypeOf('function');
    expect(products.getRelatedProducts).toBeTypeOf('function');
    expect(products.getReviews).toBeTypeOf('function');
    expect(products.getPriceHistory).toBeTypeOf('function');
    expect(products.postReview).toBeTypeOf('function');
    expect(products.monitorAvailability).toBeTypeOf('function');
  });

  it('product-lists service exports all expected functions', async () => {
    const pl = await import('../../../server/services/product-lists');
    expect(pl.getProducts).toBeTypeOf('function');
    expect(pl.getFilters).toBeTypeOf('function');
    expect(pl.getCategoryPage).toBeTypeOf('function');
    expect(pl.getBrandPage).toBeTypeOf('function');
  });

  it('search service exports searchProducts', async () => {
    const search = await import('../../../server/services/search');
    expect(search.searchProducts).toBeTypeOf('function');
  });
});
