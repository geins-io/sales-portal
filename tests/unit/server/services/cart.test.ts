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
const canAccessFeatureServer = vi.fn();
const sessionToken = vi.fn();

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: async () => ({ oms }),
  buildRequestContext: () => ({ requestContext: true }),
}));

vi.mock('../../../../server/services/configurator', () => ({
  getConfiguratorBackend: () => ({ cartLineConfigurations }),
  buildConfiguratorRequestContext: async () => ({ configuratorContext: true }),
}));

vi.mock('../../../../server/utils/feature-access', () => ({
  canAccessFeatureServer: (...args: unknown[]) =>
    canAccessFeatureServer(...args),
}));

const wrapServiceCall = vi.fn((call: () => unknown) => call());
vi.stubGlobal('wrapServiceCall', wrapServiceCall);
vi.stubGlobal('getSessionToken', () => sessionToken());

const EVENT = {} as H3Event;

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

  beforeEach(async () => {
    wrapServiceCall.mockClear();
    for (const call of Object.values(oms.cart)) {
      call.mockReset().mockImplementation(async () => sdkCart());
    }
    cartLineConfigurations
      .mockReset()
      .mockResolvedValue(new Map([['item-1', CONFIGURATION]]));
    canAccessFeatureServer.mockReset().mockResolvedValue(true);
    sessionToken.mockReset().mockReturnValue('user-token-1');
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    service = await import('../../../../server/services/cart');
  });

  afterEach(() => {
    warn.mockRestore();
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
      canAccessFeatureServer.mockResolvedValue(false);

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

  it('asks the gate with the buyer signed in or not', async () => {
    await service.getCart('cart-1', EVENT);
    sessionToken.mockReturnValue(undefined);
    await service.getCart('cart-1', EVENT);

    expect(canAccessFeatureServer.mock.calls).toEqual([
      [EVENT, 'configurator', { authenticated: true }],
      [EVENT, 'configurator', { authenticated: false }],
    ]);
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
    expect(canAccessFeatureServer).not.toHaveBeenCalled();
  });
});
