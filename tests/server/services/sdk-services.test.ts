import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// --- Shared mock SDK methods ---
const mockAuthLogin = vi.fn();
const mockAuthLogout = vi.fn();
const mockAuthRefresh = vi.fn();
const mockAuthGet = vi.fn();
const mockSetAuthTokens = vi.fn();

const mockUserGet = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserCreate = vi.fn();
const mockPasswordChange = vi.fn();

const mockMenuGet = vi.fn();
const mockPageGet = vi.fn();
const mockAreaGet = vi.fn();

const mockCartGet = vi.fn();
const mockCartCreate = vi.fn();
const mockCartItemsAdd = vi.fn();
const mockCartItemsUpdate = vi.fn();
const mockCartItemsRemove = vi.fn();
const mockCartItemsDelete = vi.fn();
const mockCartItemsClear = vi.fn();
const mockPromoApply = vi.fn();
const mockPromoRemove = vi.fn();

const mockCheckoutGet = vi.fn();
const mockCheckoutValidate = vi.fn();
const mockCheckoutCreateOrder = vi.fn();
const mockCheckoutSummary = vi.fn();
const mockCheckoutCreateToken = vi.fn();

const mockOrderGet = vi.fn();

// --- Mock getGeinsClient to return controlled mocks ---
const mockClient = {
  core: { geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' } },
  crm: {
    auth: {
      login: mockAuthLogin,
      logout: mockAuthLogout,
      refresh: mockAuthRefresh,
      get: mockAuthGet,
    },
    user: {
      get: mockUserGet,
      update: mockUserUpdate,
      create: mockUserCreate,
      password: { change: mockPasswordChange },
    },
    setAuthTokens: mockSetAuthTokens,
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
      items: {
        add: mockCartItemsAdd,
        update: mockCartItemsUpdate,
        remove: mockCartItemsRemove,
        delete: mockCartItemsDelete,
        clear: mockCartItemsClear,
      },
      promotionCode: {
        apply: mockPromoApply,
        remove: mockPromoRemove,
      },
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

vi.mock('../../../server/services/_client', () => ({
  getGeinsClient: vi.fn().mockResolvedValue(mockClient),
  getChannelVariables: vi.fn(),
}));

const event = {} as H3Event;

describe('SDK-backed services', () => {
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

    it('logout should set auth tokens and delegate to crm.auth.logout', async () => {
      mockAuthLogout.mockResolvedValue(undefined);

      await auth.logout('refresh-token-123', event);

      expect(mockSetAuthTokens).toHaveBeenCalledWith({
        refreshToken: 'refresh-token-123',
      });
      expect(mockAuthLogout).toHaveBeenCalled();
    });

    it('refresh should delegate to crm.auth.refresh with token', async () => {
      const expected = { succeeded: true, tokens: { token: 'new' } };
      mockAuthRefresh.mockResolvedValue(expected);

      const result = await auth.refresh('refresh-token', event);

      expect(mockAuthRefresh).toHaveBeenCalledWith('refresh-token');
      expect(result).toBe(expected);
    });

    it('getUser should delegate to crm.auth.get with tokens', async () => {
      const expected = { succeeded: true, user: { userId: '1' } };
      mockAuthGet.mockResolvedValue(expected);

      const result = await auth.getUser('refresh', 'user-token', event);

      expect(mockAuthGet).toHaveBeenCalledWith('refresh', 'user-token');
      expect(result).toBe(expected);
    });
  });

  describe('user service', () => {
    let user: typeof import('../../../server/services/user');

    beforeEach(async () => {
      user = await import('../../../server/services/user');
    });

    it('getUser should set tokens and delegate to crm.user.get', async () => {
      const expected = { email: 'user@test.com' };
      mockUserGet.mockResolvedValue(expected);

      const result = await user.getUser('refresh-token', event);

      expect(mockSetAuthTokens).toHaveBeenCalledWith({
        refreshToken: 'refresh-token',
      });
      expect(mockUserGet).toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it('updateUser should set tokens and delegate to crm.user.update', async () => {
      const userData = { address: { firstName: 'Test' } };
      const expected = { email: 'user@test.com' };
      mockUserUpdate.mockResolvedValue(expected);

      const result = await user.updateUser(
        userData as Parameters<typeof user.updateUser>[0],
        'refresh-token',
        event,
      );

      expect(mockSetAuthTokens).toHaveBeenCalledWith({
        refreshToken: 'refresh-token',
      });
      expect(mockUserUpdate).toHaveBeenCalledWith(userData);
      expect(result).toBe(expected);
    });

    it('changePassword should set tokens and delegate to crm.user.password.change', async () => {
      const creds = {
        username: 'user@test.com',
        password: 'old',
        newPassword: 'new',
      };
      const expected = { succeeded: true };
      mockPasswordChange.mockResolvedValue(expected);

      const result = await user.changePassword(creds, 'refresh-token', event);

      expect(mockSetAuthTokens).toHaveBeenCalledWith({
        refreshToken: 'refresh-token',
      });
      expect(mockPasswordChange).toHaveBeenCalledWith(creds);
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

  describe('cart service', () => {
    let cart: typeof import('../../../server/services/cart');

    beforeEach(async () => {
      cart = await import('../../../server/services/cart');
    });

    it('getCart should delegate to oms.cart.get', async () => {
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

    it('addItem should load cart and delegate to oms.cart.items.add', async () => {
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockCartItemsAdd.mockResolvedValue(true);

      const result = await cart.addItem(
        { cartId: 'cart-1', skuId: 123, quantity: 2 },
        event,
      );

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockCartItemsAdd).toHaveBeenCalledWith({
        skuId: 123,
        quantity: 2,
      });
      expect(result).toBe(true);
    });

    it('addItem without cartId should skip cart load', async () => {
      mockCartItemsAdd.mockResolvedValue(true);

      const result = await cart.addItem({ skuId: 123, quantity: 2 }, event);

      expect(mockCartGet).not.toHaveBeenCalled();
      expect(mockCartItemsAdd).toHaveBeenCalledWith({
        skuId: 123,
        quantity: 2,
      });
      expect(result).toBe(true);
    });

    it('updateItem should load cart and delegate to oms.cart.items.update', async () => {
      const item = { skuId: 123, quantity: 5 };
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockCartItemsUpdate.mockResolvedValue(true);

      const result = await cart.updateItem(
        { cartId: 'cart-1', item } as Parameters<typeof cart.updateItem>[0],
        event,
      );

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockCartItemsUpdate).toHaveBeenCalledWith({ item });
      expect(result).toBe(true);
    });

    it('removeItem should load cart and delegate to oms.cart.items.remove', async () => {
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockCartItemsRemove.mockResolvedValue(true);

      const result = await cart.removeItem(
        { cartId: 'cart-1', skuId: 123, quantity: 1 },
        event,
      );

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockCartItemsRemove).toHaveBeenCalledWith({
        skuId: 123,
        quantity: 1,
      });
      expect(result).toBe(true);
    });

    it('deleteItem should load cart and delegate to oms.cart.items.delete', async () => {
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockCartItemsDelete.mockResolvedValue(true);

      const result = await cart.deleteItem(
        { cartId: 'cart-1', id: 'item-1' },
        event,
      );

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockCartItemsDelete).toHaveBeenCalledWith({
        id: 'item-1',
        skuId: undefined,
      });
      expect(result).toBe(true);
    });

    it('clearCart should load cart and delegate to oms.cart.items.clear', async () => {
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockCartItemsClear.mockResolvedValue(true);

      const result = await cart.clearCart('cart-1', event);

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockCartItemsClear).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('applyPromoCode should load cart and delegate to oms.cart.promotionCode.apply', async () => {
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockPromoApply.mockResolvedValue(true);

      const result = await cart.applyPromoCode(
        { cartId: 'cart-1', promoCode: 'SAVE10' },
        event,
      );

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockPromoApply).toHaveBeenCalledWith('SAVE10');
      expect(result).toBe(true);
    });

    it('removePromoCode should load cart and delegate to oms.cart.promotionCode.remove', async () => {
      mockCartGet.mockResolvedValue({ id: 'cart-1' });
      mockPromoRemove.mockResolvedValue(true);

      const result = await cart.removePromoCode('cart-1', event);

      expect(mockCartGet).toHaveBeenCalledWith('cart-1');
      expect(mockPromoRemove).toHaveBeenCalled();
      expect(result).toBe(true);
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
