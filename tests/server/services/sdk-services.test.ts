import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// --- Shared mock SDK methods (0.6.0 stateless API) ---
const mockAuthLogin = vi.fn();
const mockAuthLogout = vi.fn();
const mockAuthRefresh = vi.fn();
const mockAuthGetUser = vi.fn();

const mockUserGet = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserCreate = vi.fn();
const mockPasswordChange = vi.fn();

const mockMenuGet = vi.fn();
const mockPageGet = vi.fn();
const mockAreaGet = vi.fn();

const mockCartGet = vi.fn();
const mockCartCreate = vi.fn();
const mockCartAddItem = vi.fn();
const mockCartUpdateItem = vi.fn();
const mockCartDeleteItem = vi.fn();
const mockCartSetPromotionCode = vi.fn();
const mockCartRemovePromotionCode = vi.fn();

const mockCheckoutGet = vi.fn();
const mockCheckoutValidate = vi.fn();
const mockCheckoutCreateOrder = vi.fn();
const mockCheckoutSummary = vi.fn();
const mockCheckoutCreateToken = vi.fn();

const mockOrderGet = vi.fn();

// --- Mock getTenantSDK to return controlled mocks ---
const mockSDK = {
  core: { geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' } },
  crm: {
    auth: {
      login: mockAuthLogin,
      logout: mockAuthLogout,
      refresh: mockAuthRefresh,
      getUser: mockAuthGetUser,
    },
    user: {
      get: mockUserGet,
      update: mockUserUpdate,
      create: mockUserCreate,
      password: { change: mockPasswordChange },
    },
  },
  cms: {
    menu: { get: mockMenuGet },
    page: { get: mockPageGet },
    area: { get: mockAreaGet },
  },
  oms: {
    cart: {
      get: mockCartGet,
      create: mockCartCreate,
      addItem: mockCartAddItem,
      updateItem: mockCartUpdateItem,
      deleteItem: mockCartDeleteItem,
      setPromotionCode: mockCartSetPromotionCode,
      removePromotionCode: mockCartRemovePromotionCode,
    },
    checkout: {
      get: mockCheckoutGet,
      validate: mockCheckoutValidate,
      createOrder: mockCheckoutCreateOrder,
      summary: mockCheckoutSummary,
      createToken: mockCheckoutCreateToken,
    },
    order: {
      get: mockOrderGet,
    },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi.fn(),
}));

// Mock Nitro auto-imports for error handling
vi.stubGlobal(
  'createAppError',
  vi.fn((_code: string, message: string) => {
    const err = new Error(message);
    (err as Error & { statusCode: number }).statusCode = 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
});

const event = {} as H3Event;

describe('SDK-backed services (0.6.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auth service', () => {
    let auth: typeof import('../../../server/services/auth');

    beforeEach(async () => {
      auth = await import('../../../server/services/auth');
    });

    it('login should delegate to crm.auth.login', async () => {
      const creds = { username: 'user@test.com', password: 'pass' };
      const expected = { succeeded: true };
      mockAuthLogin.mockResolvedValue(expected);

      const result = await auth.login(creds, event);

      expect(mockAuthLogin).toHaveBeenCalledWith(creds);
      expect(result).toBe(expected);
    });

    it('logout should delegate to crm.auth.logout (no params)', async () => {
      mockAuthLogout.mockResolvedValue(undefined);

      await auth.logout(event);

      expect(mockAuthLogout).toHaveBeenCalledWith();
    });

    it('refresh should delegate to crm.auth.refresh with token', async () => {
      const expected = { succeeded: true, tokens: { token: 'new' } };
      mockAuthRefresh.mockResolvedValue(expected);

      const result = await auth.refresh('refresh-token', event);

      expect(mockAuthRefresh).toHaveBeenCalledWith('refresh-token');
      expect(result).toBe(expected);
    });

    it('getUser should delegate to crm.auth.getUser with tokens', async () => {
      const expected = { succeeded: true, user: { userId: '1' } };
      mockAuthGetUser.mockResolvedValue(expected);

      const result = await auth.getUser('refresh', 'user-token', event);

      expect(mockAuthGetUser).toHaveBeenCalledWith('refresh', 'user-token');
      expect(result).toBe(expected);
    });
  });

  describe('user service', () => {
    let user: typeof import('../../../server/services/user');

    beforeEach(async () => {
      user = await import('../../../server/services/user');
    });

    it('getUser should pass userToken to crm.user.get', async () => {
      const expected = { email: 'user@test.com' };
      mockUserGet.mockResolvedValue(expected);

      const result = await user.getUser('user-token-123', event);

      expect(mockUserGet).toHaveBeenCalledWith('user-token-123');
      expect(result).toBe(expected);
    });

    it('updateUser should pass data and userToken to crm.user.update', async () => {
      const userData = { address: { firstName: 'Test' } };
      const expected = { email: 'user@test.com' };
      mockUserUpdate.mockResolvedValue(expected);

      const result = await user.updateUser(
        userData as Parameters<typeof user.updateUser>[0],
        'user-token-123',
        event,
      );

      expect(mockUserUpdate).toHaveBeenCalledWith(userData, 'user-token-123');
      expect(result).toBe(expected);
    });

    it('changePassword should pass credentials and refreshToken', async () => {
      const creds = {
        username: 'user@test.com',
        password: 'old',
        newPassword: 'new',
      };
      const expected = { succeeded: true };
      mockPasswordChange.mockResolvedValue(expected);

      const result = await user.changePassword(creds, 'refresh-token', event);

      expect(mockPasswordChange).toHaveBeenCalledWith(creds, 'refresh-token');
      expect(result).toBe(expected);
    });

    it('register should delegate to crm.user.create', async () => {
      const creds = { username: 'new@test.com', password: 'pass' };
      const expected = { succeeded: true };
      mockUserCreate.mockResolvedValue(expected);

      const result = await user.register(creds, undefined, event);

      expect(mockUserCreate).toHaveBeenCalledWith(creds, undefined);
      expect(result).toBe(expected);
    });
  });

  describe('cms service', () => {
    let cms: typeof import('../../../server/services/cms');

    beforeEach(async () => {
      cms = await import('../../../server/services/cms');
    });

    it('getMenu should delegate to cms.menu.get', async () => {
      const args = { menuLocationId: 'header' };
      const expected = { id: '1', title: 'Main Menu', menuItems: [] };
      mockMenuGet.mockResolvedValue(expected);

      const result = await cms.getMenu(args, event);

      expect(mockMenuGet).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });

    it('getPage should delegate to cms.page.get', async () => {
      const args = { alias: 'about-us' };
      const expected = { title: 'About Us' };
      mockPageGet.mockResolvedValue(expected);

      const result = await cms.getPage(args, event);

      expect(mockPageGet).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });

    it('getContentArea should delegate to cms.area.get', async () => {
      const args = { family: 'StartPage', areaName: 'Hero' };
      const expected = { containers: [] };
      mockAreaGet.mockResolvedValue(expected);

      const result = await cms.getContentArea(args, event);

      expect(mockAreaGet).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });
  });

  describe('cart service (flat API)', () => {
    let cart: typeof import('../../../server/services/cart');

    beforeEach(async () => {
      cart = await import('../../../server/services/cart');
    });

    it('getCart should delegate to oms.cart.get with cartId', async () => {
      const expected = { id: 'cart-1', items: [] };
      mockCartGet.mockResolvedValue(expected);

      const result = await cart.getCart('cart-1', event);

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(result).toBe(expected);
    });

    it('createCart should delegate to oms.cart.create', async () => {
      const expected = { id: 'new-cart', items: [] };
      mockCartCreate.mockResolvedValue(expected);

      const result = await cart.createCart(event);

      expect(mockCartCreate).toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it('addItem should call oms.cart.addItem with cartId and input', async () => {
      const expected = { id: 'cart-1', items: [{ skuId: 123, quantity: 2 }] };
      mockCartAddItem.mockResolvedValue(expected);

      const result = await cart.addItem(
        'cart-1',
        { skuId: 123, quantity: 2 },
        event,
      );

      expect(mockCartAddItem).toHaveBeenCalledWith('cart-1', {
        skuId: 123,
        quantity: 2,
      });
      expect(result).toBe(expected);
    });

    it('updateItem should call oms.cart.updateItem with cartId and input', async () => {
      const expected = { id: 'cart-1', items: [{ skuId: 123, quantity: 5 }] };
      mockCartUpdateItem.mockResolvedValue(expected);

      const result = await cart.updateItem(
        'cart-1',
        { id: 'item-1', quantity: 5 },
        event,
      );

      expect(mockCartUpdateItem).toHaveBeenCalledWith('cart-1', {
        id: 'item-1',
        quantity: 5,
      });
      expect(result).toBe(expected);
    });

    it('deleteItem should call oms.cart.deleteItem with cartId and itemId', async () => {
      const expected = { id: 'cart-1', items: [] };
      mockCartDeleteItem.mockResolvedValue(expected);

      const result = await cart.deleteItem('cart-1', 'item-1', event);

      expect(mockCartDeleteItem).toHaveBeenCalledWith('cart-1', 'item-1');
      expect(result).toBe(expected);
    });

    it('applyPromoCode should call oms.cart.setPromotionCode', async () => {
      const expected = { id: 'cart-1', promoCode: 'SAVE10' };
      mockCartSetPromotionCode.mockResolvedValue(expected);

      const result = await cart.applyPromoCode('cart-1', 'SAVE10', event);

      expect(mockCartSetPromotionCode).toHaveBeenCalledWith('cart-1', 'SAVE10');
      expect(result).toBe(expected);
    });

    it('removePromoCode should call oms.cart.removePromotionCode', async () => {
      const expected = { id: 'cart-1', promoCode: undefined };
      mockCartRemovePromotionCode.mockResolvedValue(expected);

      const result = await cart.removePromoCode('cart-1', event);

      expect(mockCartRemovePromotionCode).toHaveBeenCalledWith('cart-1');
      expect(result).toBe(expected);
    });
  });

  describe('checkout service', () => {
    let checkout: typeof import('../../../server/services/checkout');

    beforeEach(async () => {
      checkout = await import('../../../server/services/checkout');
    });

    it('getCheckout should delegate to oms.checkout.get', async () => {
      const args = { cartId: 'cart-1', paymentMethodId: 1 };
      const expected = { email: 'test@test.com', cart: { id: 'cart-1' } };
      mockCheckoutGet.mockResolvedValue(expected);

      const result = await checkout.getCheckout(
        args as Parameters<typeof checkout.getCheckout>[0],
        event,
      );

      expect(mockCheckoutGet).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });

    it('validateOrder should delegate to oms.checkout.validate', async () => {
      const args = {
        cartId: 'cart-1',
        checkoutOptions: { paymentId: 1 },
      };
      const expected = { isValid: true };
      mockCheckoutValidate.mockResolvedValue(expected);

      const result = await checkout.validateOrder(
        args as Parameters<typeof checkout.validateOrder>[0],
        event,
      );

      expect(mockCheckoutValidate).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });

    it('createOrder should delegate to oms.checkout.createOrder', async () => {
      const args = {
        cartId: 'cart-1',
        checkoutOptions: { paymentId: 1 },
      };
      const expected = { created: true, orderId: 'order-1' };
      mockCheckoutCreateOrder.mockResolvedValue(expected);

      const result = await checkout.createOrder(
        args as Parameters<typeof checkout.createOrder>[0],
        event,
      );

      expect(mockCheckoutCreateOrder).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });

    it('getSummary should delegate to oms.checkout.summary', async () => {
      const args = { orderId: 'order-1', paymentMethod: 'klarna' };
      const expected = { id: 'order-1' };
      mockCheckoutSummary.mockResolvedValue(expected);

      const result = await checkout.getSummary(args, event);

      expect(mockCheckoutSummary).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });

    it('createToken should delegate to oms.checkout.createToken', async () => {
      const args = { cartId: 'cart-1' };
      mockCheckoutCreateToken.mockResolvedValue('token-abc');

      const result = await checkout.createToken(
        args as Parameters<typeof checkout.createToken>[0],
        event,
      );

      expect(mockCheckoutCreateToken).toHaveBeenCalledWith(args);
      expect(result).toBe('token-abc');
    });
  });

  describe('orders service', () => {
    let orders: typeof import('../../../server/services/orders');

    beforeEach(async () => {
      orders = await import('../../../server/services/orders');
    });

    it('getOrder should delegate to oms.order.get', async () => {
      const args = { publicOrderId: 'pub-123' };
      const expected = { id: 'order-1', publicId: 'pub-123' };
      mockOrderGet.mockResolvedValue(expected);

      const result = await orders.getOrder(args, event);

      expect(mockOrderGet).toHaveBeenCalledWith(args);
      expect(result).toBe(expected);
    });
  });
});
