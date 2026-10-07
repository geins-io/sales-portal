import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { H3Event } from 'h3';
import type { CartLineConfiguration } from '#shared/types/commerce';
import { CartError } from '@geins/core';
import { logger } from '../../../../server/utils/logger';

// ---------------------------------------------------------------------------
// The cart service: the SDK's cart, with each configured line's configuration
// merged in by item id from the configurator backend's own read.
// ---------------------------------------------------------------------------

const oms = {
  cart: {
    get: vi.fn(),
    create: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    setPromotionCode: vi.fn(),
    removePromotionCode: vi.fn(),
  },
};
const cartLineConfigurations = vi.fn();
const addToCart = vi.fn();
const canConfigureServer = vi.fn();
const sessionToken = vi.fn();

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: async () => ({ oms }),
  buildRequestContext: () => ({ requestContext: true }),
}));

vi.mock('../../../../server/services/configurator', () => ({
  getConfiguratorBackend: () => ({ cartLineConfigurations, addToCart }),
  buildConfiguratorRequestContext: async () => ({ configuratorContext: true }),
}));

vi.mock('../../../../server/utils/feature-access', () => ({
  canConfigureServer: (...args: unknown[]) => canConfigureServer(...args),
}));

const wrapServiceCall = vi.fn((call: () => unknown) => call());
vi.stubGlobal('wrapServiceCall', wrapServiceCall);
vi.stubGlobal('getSessionToken', () => sessionToken());

const EVENT = {} as H3Event;

/** A cart read refused because the cart needs the buyer signed in, as the SDK throws it. */
function loginRequiredRead() {
  return Object.assign(new Error('Error getting cart'), {
    name: 'CartError',
    code: 'CART_OPERATION_FAILED',
    cause: {
      name: 'ApolloError',
      graphQLErrors: [{ extensions: { code: 'LoginRequired' } }],
    },
  });
}

const CONFIGURATION: CartLineConfiguration = {
  configurationId: 'committed-1',
  summary: [
    { label: 'Adapter', value: 'S45' },
    { label: 'Finish', value: '' },
  ],
};

function sdkCart() {
  return {
    id: 'cart-1',
    items: [
      { id: 'item-1', skuId: 1652, quantity: 1 },
      { id: 'item-2', skuId: 100, quantity: 2 },
      { skuId: 7, quantity: 1 },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const flush = () => new Promise((done) => setTimeout(done, 0));

/** Every service call that answers a cart with lines, and the SDK call behind it. */
const CALLS = [
  ['getCart', 'get', (s: Service) => s.getCart('cart-1', EVENT)],
  [
    'addItem',
    'addItem',
    (s: Service) => s.addItem('cart-1', { skuId: 1, quantity: 1 }, EVENT),
  ],
  [
    'updateItem',
    'updateItem',
    (s: Service) =>
      s.updateItem('cart-1', { id: 'item-1', quantity: 3 }, EVENT),
  ],
  [
    'deleteItem',
    'deleteItem',
    (s: Service) => s.deleteItem('cart-1', 'item-2', EVENT),
  ],
  [
    'applyPromoCode',
    'setPromotionCode',
    (s: Service) => s.applyPromoCode('cart-1', 'SAVE', EVENT),
  ],
  [
    'removePromoCode',
    'removePromotionCode',
    (s: Service) => s.removePromoCode('cart-1', EVENT),
  ],
] as const;

type Service = typeof import('../../../../server/services/cart');

describe('the cart service', () => {
  let service: Service;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    wrapServiceCall.mockClear();
    for (const call of Object.values(oms.cart)) {
      call.mockReset().mockImplementation(async () => sdkCart());
    }
    cartLineConfigurations
      .mockReset()
      .mockResolvedValue(new Map([['item-1', CONFIGURATION]]));
    addToCart.mockReset().mockResolvedValue({ itemId: 'carried-1' });
    canConfigureServer.mockReset().mockResolvedValue(true);
    sessionToken.mockReset().mockReturnValue('user-token-1');
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    service = await import('../../../../server/services/cart');
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  describe.each(CALLS)('%s', (_name, sdkCall, call) => {
    it('puts the configuration on the line it belongs to, and leaves every other line as the SDK sent it', async () => {
      const cart = await call(service);

      expect(oms.cart[sdkCall]).toHaveBeenCalledTimes(1);
      expect(cartLineConfigurations).toHaveBeenCalledWith('cart-1', {
        configuratorContext: true,
      });
      expect(cart.items).toEqual([
        {
          id: 'item-1',
          skuId: 1652,
          quantity: 1,
          configuration: CONFIGURATION,
        },
        { id: 'item-2', skuId: 100, quantity: 2 },
        { skuId: 7, quantity: 1 },
      ]);
      expect(cart.id).toBe('cart-1');
    });

    it('answers the SDK cart unchanged, with one warning, when the read fails', async () => {
      cartLineConfigurations.mockRejectedValue(new Error('timed out'));

      const cart = await call(service);

      expect(cart).toEqual(sdkCart());
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[configurator] cart line configurations unavailable',
      );
    });

    it('does not read when the request may not have the configurator', async () => {
      canConfigureServer.mockResolvedValue(false);

      const cart = await call(service);

      expect(cartLineConfigurations).not.toHaveBeenCalled();
      expect(cart).toEqual(sdkCart());
      expect(warn).not.toHaveBeenCalled();
    });

    it('wraps the SDK call as a cart call', async () => {
      await call(service);

      expect(wrapServiceCall).toHaveBeenCalledWith(
        expect.any(Function),
        'cart',
        CartError,
      );
    });
  });

  it("asks the configurator's gate for this request", async () => {
    await service.getCart('cart-1', EVENT);

    expect(canConfigureServer.mock.calls).toEqual([[EVENT]]);
  });

  it('answers the SDK cart as it is when no line is configured', async () => {
    cartLineConfigurations.mockResolvedValue(new Map());

    await expect(service.getCart('cart-1', EVENT)).resolves.toEqual(sdkCart());
  });

  it('answers what the SDK answered when it finds no cart', async () => {
    oms.cart.get.mockResolvedValue(null);

    await expect(service.getCart('cart-1', EVENT)).resolves.toBeNull();
  });

  it('starts both reads of getCart before either answers', async () => {
    const sdk = deferred<ReturnType<typeof sdkCart>>();
    oms.cart.get.mockReturnValue(sdk.promise);

    const answer = service.getCart('cart-1', EVENT);
    await flush();

    expect(cartLineConfigurations).toHaveBeenCalledTimes(1);
    sdk.resolve(sdkCart());
    expect((await answer).items[0]).toHaveProperty(
      'configuration',
      CONFIGURATION,
    );
  });

  it('reads the lines after a change has answered, so it sees the change', async () => {
    const sdk = deferred<ReturnType<typeof sdkCart>>();
    oms.cart.addItem.mockReturnValue(sdk.promise);

    const answer = service.addItem('cart-1', { skuId: 1, quantity: 1 }, EVENT);
    await flush();

    expect(cartLineConfigurations).not.toHaveBeenCalled();
    sdk.resolve(sdkCart());
    await answer;
    expect(cartLineConfigurations).toHaveBeenCalledTimes(1);
  });

  it('reads no lines for a new cart, which has none', async () => {
    await service.createCart(EVENT);

    expect(cartLineConfigurations).not.toHaveBeenCalled();
    expect(canConfigureServer).not.toHaveBeenCalled();
  });

  describe('a read refused until the buyer signs in', () => {
    it('answers 401 CART_LOGIN_REQUIRED to a buyer signed out, logged as a client error', async () => {
      sessionToken.mockReturnValue(undefined);
      oms.cart.get.mockRejectedValue(loginRequiredRead());

      await expect(service.getCart('cart-1', EVENT)).rejects.toMatchObject({
        statusCode: 401,
        data: { code: 'CART_LOGIN_REQUIRED' },
      });
      expect(error).not.toHaveBeenCalled();
    });

    it("passes it on as thrown to a buyer signed in, for whom it is another buyer's cart", async () => {
      const failure = loginRequiredRead();
      oms.cart.get.mockRejectedValue(failure);

      await expect(service.getCart('cart-1', EVENT)).rejects.toBe(failure);
    });

    it('passes every other failed read on as it was thrown', async () => {
      const failure = new Error('fetch failed');
      oms.cart.get.mockRejectedValue(failure);

      await expect(service.getCart('cart-1', EVENT)).rejects.toBe(failure);
    });

    it('leaves a write as it was thrown', async () => {
      const failure = loginRequiredRead();
      oms.cart.addItem.mockRejectedValue(failure);

      await expect(
        service.addItem('cart-1', { skuId: 1, quantity: 1 }, EVENT),
      ).rejects.toBe(failure);
    });
  });

  describe('copyCart, at sign-in', () => {
    const NEW_CART = { id: 'new-cart', items: [] };
    const COPIED = { id: 'new-cart', items: [{ id: 'copied' }] };
    const CONFIGURATOR_CTX = {
      configuratorContext: true,
      userToken: 'new-token',
    };
    const CARRY_CTX = {
      ...CONFIGURATOR_CTX,
      cart: { addPlainItem: expect.any(Function) },
    };

    beforeEach(() => {
      oms.cart.get
        .mockReset()
        .mockResolvedValueOnce(sdkCart())
        .mockResolvedValueOnce(COPIED);
      oms.cart.create.mockReset().mockResolvedValue(NEW_CART);
      oms.cart.addItem.mockReset().mockResolvedValue(NEW_CART);
      // The login request carries no session yet.
      sessionToken.mockReturnValue(undefined);
    });

    const copy = () => service.copyCart('cart-1', EVENT, 'new-token');

    it('re-adds a plain line by its SKU and carries a configured line by its committed id', async () => {
      await expect(copy()).resolves.toEqual(COPIED);

      expect(addToCart).toHaveBeenCalledTimes(1);
      expect(addToCart).toHaveBeenCalledWith(
        'new-cart',
        { committedConfigurationId: 'committed-1', skuId: 1652, quantity: 1 },
        CARRY_CTX,
      );
      expect(
        oms.cart.addItem.mock.calls.map(([id, item]) => [id, item]),
      ).toEqual([
        ['new-cart', { skuId: 100, quantity: 2 }],
        ['new-cart', { skuId: 7, quantity: 1 }],
      ]);
      expect(oms.cart.get).toHaveBeenNthCalledWith(
        1,
        'cart-1',
        false,
        expect.objectContaining({ userToken: 'new-token' }),
      );
      expect(oms.cart.get).toHaveBeenLastCalledWith(
        'new-cart',
        false,
        expect.objectContaining({ userToken: 'new-token' }),
      );
    });

    // The fixture adds a configured line as a plain one through `ctx.cart`.
    it("carries a line through a backend that adds it to the cart as a plain one, with the buyer's new token", async () => {
      addToCart.mockImplementation(
        async (
          cartId: string,
          line: { skuId: number; quantity: number },
          ctx: {
            cart?: {
              addPlainItem(
                id: string,
                item: { skuId: number; quantity: number },
              ): Promise<unknown>;
            };
          },
        ) => {
          await ctx.cart!.addPlainItem(cartId, {
            skuId: line.skuId,
            quantity: line.quantity,
          });
          return { itemId: 'carried' };
        },
      );

      await expect(copy()).resolves.toEqual(COPIED);

      expect(oms.cart.addItem).toHaveBeenCalledWith(
        'new-cart',
        { skuId: 1652, quantity: 1 },
        expect.objectContaining({ userToken: 'new-token' }),
      );
    });

    it("reads the lines with the buyer's new token, whatever the configurator gate says", async () => {
      canConfigureServer.mockResolvedValue(false);

      await copy();

      expect(cartLineConfigurations).toHaveBeenCalledWith(
        'cart-1',
        CONFIGURATOR_CTX,
      );
    });

    it('carries a configured line at the quantity the line has', async () => {
      oms.cart.get.mockReset().mockResolvedValueOnce({
        id: 'cart-1',
        items: [{ id: 'item-1', skuId: 1652, quantity: 3 }],
      });

      await copy();

      expect(addToCart).toHaveBeenCalledWith(
        'new-cart',
        expect.objectContaining({ quantity: 3 }),
        CARRY_CTX,
      );
    });

    it('copies as before when no line is configured', async () => {
      cartLineConfigurations.mockResolvedValue(new Map());

      await copy();

      expect(addToCart).not.toHaveBeenCalled();
      expect(oms.cart.addItem).toHaveBeenCalledTimes(3);
    });

    it('gives up before a new cart when the lines cannot be read', async () => {
      cartLineConfigurations.mockRejectedValue(new Error('timed out'));

      await expect(copy()).rejects.toThrow('timed out');
      expect(oms.cart.create).not.toHaveBeenCalled();
      expect(oms.cart.addItem).not.toHaveBeenCalled();
    });

    it('gives up when a configured line cannot be carried, and never adds it by its SKU', async () => {
      addToCart.mockRejectedValue(new Error('carry refused'));

      await expect(copy()).rejects.toThrow('carry refused');
      expect(oms.cart.addItem).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skuId: 1652 }),
        expect.anything(),
      );
    });

    it('still skips a plain line that fails to re-add', async () => {
      oms.cart.addItem.mockRejectedValueOnce(new Error('SKU unavailable'));

      await expect(copy()).resolves.toEqual(COPIED);
      expect(oms.cart.addItem).toHaveBeenCalledTimes(2);
    });
  });
});
