import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { H3Event } from 'h3';
import type { CartLineConfiguration } from '#shared/types/commerce';
import { CartError } from '@geins/core';
import { logger } from '../../../../server/utils/logger';

// ---------------------------------------------------------------------------
// The cart service: the SDK's cart, each configured line's configuration read
// from the line itself, or for the fixture, whose lines are plain Geins lines,
// merged in by item id from the backend's own read.
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
/** The fixture reads its lines itself; the merchant-api backend has no hook. */
const FIXTURE = { cartLineConfigurations, addToCart };
const MERCHANT_API = { addToCart };
let backend: typeof FIXTURE | typeof MERCHANT_API = FIXTURE;
const changeConfiguredQuantity = vi.fn();
const canConfigureServer = vi.fn();
const sessionToken = vi.fn();

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: async () => ({ oms }),
  buildRequestContext: () => ({ requestContext: true }),
}));

vi.mock('../../../../server/services/configurator', () => ({
  getConfiguratorBackend: () => backend,
  buildConfiguratorRequestContext: async () => ({ configuratorContext: true }),
}));

vi.mock('../../../../server/services/configured-line-quantity', () => ({
  changeConfiguredQuantity: (...args: unknown[]) =>
    changeConfiguredQuantity(...args),
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

/**
 * Every service call that answers a cart with lines, and the SDK call behind it.
 * `updateItem` reads the lines first as well, so it has its own block.
 */
const CALLS = [
  ['getCart', 'get', (s: Service) => s.getCart('cart-1', EVENT)],
  [
    'addItem',
    'addItem',
    (s: Service) => s.addItem('cart-1', { skuId: 1, quantity: 1 }, EVENT),
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
    backend = FIXTURE;
    changeConfiguredQuantity.mockReset().mockResolvedValue(undefined);
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

    expect(wrapServiceCall).toHaveBeenCalledWith(
      expect.any(Function),
      'cart',
      CartError,
    );

    expect(cartLineConfigurations).not.toHaveBeenCalled();
    expect(canConfigureServer).not.toHaveBeenCalled();
  });

  describe('updateItem', () => {
    const update = (id: string, quantity: number) =>
      service.updateItem('cart-1', { id, quantity }, EVENT);

    it('changes an ordinary line with a plain update and answers the cart with its configurations', async () => {
      const cart = await update('item-2', 3);

      expect(oms.cart.updateItem).toHaveBeenCalledWith(
        'cart-1',
        { id: 'item-2', quantity: 3 },
        { requestContext: true },
      );
      expect(changeConfiguredQuantity).not.toHaveBeenCalled();
      expect(cart.items[0]).toHaveProperty('configuration', CONFIGURATION);
    });

    it('changes a configured line through its configuration, never with a plain update', async () => {
      const cart = await update('item-1', 4);

      expect(oms.cart.updateItem).not.toHaveBeenCalled();
      expect(changeConfiguredQuantity).toHaveBeenCalledTimes(1);
      expect(changeConfiguredQuantity).toHaveBeenCalledWith(
        expect.objectContaining({ cartLineConfigurations }),
        'cart-1',
        'item-1',
        4,
        {
          configuratorContext: true,
          cart: {
            addPlainItem: expect.any(Function),
            updatePlainItem: expect.any(Function),
          },
        },
      );
      // Read back after the swap, so the answer carries the new line.
      expect(oms.cart.get).toHaveBeenCalledWith('cart-1', false, {
        requestContext: true,
      });
      expect(changeConfiguredQuantity.mock.invocationCallOrder[0]).toBeLessThan(
        oms.cart.get.mock.invocationCallOrder.at(-1)!,
      );
      expect(cart.items[0]).toHaveProperty('configuration', CONFIGURATION);
    });

    it("gives the backend the portal's plain cart writes, for a backend with no configured cart behind it", async () => {
      changeConfiguredQuantity.mockImplementation(
        async (
          _backend: unknown,
          cartId: string,
          itemId: string,
          quantity: number,
          ctx: {
            cart: {
              updatePlainItem(
                id: string,
                item: { id: string; quantity: number },
              ): Promise<unknown>;
              addPlainItem(
                id: string,
                item: { skuId: number; quantity: number },
              ): Promise<unknown>;
            };
          },
        ) => {
          await ctx.cart.updatePlainItem(cartId, { id: itemId, quantity });
          await ctx.cart.addPlainItem(cartId, { skuId: 9, quantity: 1 });
        },
      );

      await update('item-1', 4);

      expect(oms.cart.updateItem).toHaveBeenCalledWith(
        'cart-1',
        { id: 'item-1', quantity: 4 },
        { requestContext: true },
      );
      expect(oms.cart.addItem).toHaveBeenCalledWith(
        'cart-1',
        { skuId: 9, quantity: 1 },
        { requestContext: true },
      );
    });

    it('passes a failed configured change on, with the line untouched', async () => {
      const refused = new Error('refused');
      changeConfiguredQuantity.mockRejectedValue(refused);

      await expect(update('item-1', 4)).rejects.toBe(refused);
      expect(oms.cart.updateItem).not.toHaveBeenCalled();
    });

    it('refuses the change, sending nothing, when the lines cannot be read', async () => {
      const failed = new Error('timed out');
      cartLineConfigurations.mockRejectedValue(failed);

      await expect(update('item-2', 3)).rejects.toBe(failed);
      expect(oms.cart.updateItem).not.toHaveBeenCalled();
      expect(changeConfiguredQuantity).not.toHaveBeenCalled();
    });

    it('changes the line with a plain update, and reads no lines first, when the request may not have the configurator', async () => {
      canConfigureServer.mockResolvedValue(false);

      await expect(update('item-1', 4)).resolves.toEqual(sdkCart());
      expect(oms.cart.updateItem).toHaveBeenCalledTimes(1);
      expect(cartLineConfigurations).not.toHaveBeenCalled();
      expect(changeConfiguredQuantity).not.toHaveBeenCalled();
    });

    it('sends a quantity of 0, which removes the line, as a plain update without reading the lines first', async () => {
      await update('item-1', 0);

      expect(oms.cart.updateItem).toHaveBeenCalledWith(
        'cart-1',
        { id: 'item-1', quantity: 0 },
        { requestContext: true },
      );
      expect(changeConfiguredQuantity).not.toHaveBeenCalled();
      // Only the read of the answer.
      expect(cartLineConfigurations).toHaveBeenCalledTimes(1);
    });
  });

  describe('on a backend whose cart carries each configuration', () => {
    /** Lines as the SDK parses them: a null field reads as undefined. */
    function cpqCart() {
      return {
        id: 'cart-1',
        items: [
          {
            id: 'item-1',
            skuId: 1652,
            quantity: 1,
            configurationId: 'committed-1',
            configuration: {
              summary: [
                { label: 'Adapter', value: 'S45' },
                { label: 'Finish', value: null },
              ],
            },
          },
          {
            id: 'item-2',
            skuId: 100,
            quantity: 2,
            configurationId: undefined,
            configuration: undefined,
          },
          // Added before the configuration was copied onto cart items.
          {
            id: 'item-3',
            skuId: 1653,
            quantity: 1,
            configurationId: 'committed-3',
            configuration: undefined,
          },
        ],
      };
    }
    const ANSWERED = [
      { id: 'item-1', skuId: 1652, quantity: 1, configuration: CONFIGURATION },
      { id: 'item-2', skuId: 100, quantity: 2 },
      {
        id: 'item-3',
        skuId: 1653,
        quantity: 1,
        configuration: { configurationId: 'committed-3', summary: [] },
      },
    ];
    const sdkCalls = () =>
      Object.values(oms.cart).reduce(
        (calls, call) => calls + call.mock.calls.length,
        0,
      );

    beforeEach(() => {
      backend = MERCHANT_API;
      for (const call of Object.values(oms.cart)) {
        call.mockReset().mockImplementation(async () => cpqCart());
      }
    });

    describe.each(CALLS)('%s', (_name, sdkCall, call) => {
      it('reads each configuration from its line, with the one SDK call and no read of the lines', async () => {
        const cart = await call(service);

        expect(cart.items).toStrictEqual(ANSWERED);
        expect(oms.cart[sdkCall]).toHaveBeenCalledTimes(1);
        expect(sdkCalls()).toBe(1);
        expect(cartLineConfigurations).not.toHaveBeenCalled();
      });
    });

    it('answers what the SDK answered when it finds no cart', async () => {
      oms.cart.get.mockResolvedValue(undefined);

      await expect(service.getCart('cart-1', EVENT)).resolves.toBeUndefined();
    });

    describe('updateItem', () => {
      const update = (id: string, quantity: number) =>
        service.updateItem('cart-1', { id, quantity }, EVENT);

      it('changes an ordinary line after one read of the cart, and reads nothing after it', async () => {
        const cart = await update('item-2', 3);

        expect(oms.cart.get).toHaveBeenCalledTimes(1);
        expect(oms.cart.get).toHaveBeenCalledWith('cart-1', false, {
          requestContext: true,
        });
        expect(oms.cart.updateItem).toHaveBeenCalledWith(
          'cart-1',
          { id: 'item-2', quantity: 3 },
          { requestContext: true },
        );
        expect(oms.cart.get.mock.invocationCallOrder[0]).toBeLessThan(
          oms.cart.updateItem.mock.invocationCallOrder[0]!,
        );
        expect(sdkCalls()).toBe(2);
        expect(changeConfiguredQuantity).not.toHaveBeenCalled();
        expect(cart.items).toStrictEqual(ANSWERED);
        expect(wrapServiceCall).toHaveBeenCalledTimes(2);
        expect(wrapServiceCall).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          'cart',
          CartError,
        );
      });

      it.each([
        ['a line the cart does not hold', () => cpqCart()],
        ['a cart the SDK cannot find', () => undefined],
      ])('sends %s to the SDK as a plain update', async (_case, read) => {
        oms.cart.get.mockResolvedValue(read());

        await update('item-9', 3);

        expect(oms.cart.updateItem).toHaveBeenCalledWith(
          'cart-1',
          { id: 'item-9', quantity: 3 },
          { requestContext: true },
        );
        expect(changeConfiguredQuantity).not.toHaveBeenCalled();
      });

      it.each([
        ['with its summary', 'item-1'],
        ['with no configuration on the line', 'item-3'],
      ])(
        'changes a configured line %s through its configuration, never with a plain update',
        async (_case, id) => {
          await update(id, 4);

          expect(oms.cart.updateItem).not.toHaveBeenCalled();
          expect(changeConfiguredQuantity).toHaveBeenCalledWith(
            MERCHANT_API,
            'cart-1',
            id,
            4,
            expect.objectContaining({ configuratorContext: true }),
          );
        },
      );

      it('refuses the change, sending nothing, when the cart cannot be read', async () => {
        const failed = new Error('fetch failed');
        oms.cart.get.mockRejectedValue(failed);

        await expect(update('item-2', 3)).rejects.toBe(failed);
        expect(oms.cart.updateItem).not.toHaveBeenCalled();
        expect(changeConfiguredQuantity).not.toHaveBeenCalled();
      });

      it('changes a line with a plain update, reading nothing, at quantity 0 or without the configurator', async () => {
        await update('item-1', 0);
        canConfigureServer.mockResolvedValue(false);
        await update('item-1', 4);

        expect(oms.cart.get).not.toHaveBeenCalled();
        expect(oms.cart.updateItem).toHaveBeenCalledTimes(2);
        expect(changeConfiguredQuantity).not.toHaveBeenCalled();
      });
    });

    describe('copyCart, at sign-in', () => {
      const NEW_CART = { id: 'new-cart', items: [] };

      beforeEach(() => {
        oms.cart.get
          .mockReset()
          .mockResolvedValueOnce(cpqCart())
          .mockResolvedValueOnce(NEW_CART);
        oms.cart.create.mockReset().mockResolvedValue(NEW_CART);
        oms.cart.addItem.mockReset().mockResolvedValue(NEW_CART);
        sessionToken.mockReturnValue(undefined);
      });

      it('carries every line with an id by its committed id, with or without a configuration, and re-adds the rest by SKU', async () => {
        await service.copyCart('cart-1', EVENT, 'new-token');

        expect(addToCart.mock.calls.map(([id, line]) => [id, line])).toEqual([
          [
            'new-cart',
            {
              committedConfigurationId: 'committed-1',
              skuId: 1652,
              quantity: 1,
            },
          ],
          [
            'new-cart',
            {
              committedConfigurationId: 'committed-3',
              skuId: 1653,
              quantity: 1,
            },
          ],
        ]);
        expect(
          oms.cart.addItem.mock.calls.map(([id, item]) => [id, item]),
        ).toEqual([['new-cart', { skuId: 100, quantity: 2 }]]);
        expect(cartLineConfigurations).not.toHaveBeenCalled();
      });
    });
  });

  // The SDK's cart on a tenant without cpq, as it answered before the cart
  // documents selected the configuration fields: the answer must not change.
  describe('a cart with no configured line', () => {
    const PRICE = {
      sellingPriceIncVat: 125,
      sellingPriceExVat: 100,
      sellingPriceIncVatFormatted: '125 kr',
      isDiscounted: false,
    };
    function line(id: string, skuId: number, extra: object = {}) {
      return {
        id,
        type: 'PRODUCT',
        title: `Product ${skuId}`,
        product: { productId: skuId, name: `Product ${skuId}` },
        skuId,
        quantity: 2,
        unitPrice: PRICE,
        totalPrice: PRICE,
        ...extra,
      };
    }
    function today() {
      return {
        id: 'cart-1',
        promoCode: 'SAVE',
        freeShipping: false,
        appliedCampaigns: [],
        summary: { total: PRICE, subTotal: PRICE },
        items: [
          line('plain-1', 100),
          line('package-1', 200, {
            groupKey: '7',
            productPackage: {
              packageId: 3,
              packageName: 'Kit',
              groupId: 1,
              optionId: 1,
            },
          }),
          line('package-2', 201, {
            groupKey: '7',
            productPackage: {
              packageId: 3,
              packageName: 'Kit',
              groupId: 2,
              optionId: 4,
            },
          }),
        ],
      };
    }
    /** The same cart from an SDK whose cart documents select the fields. */
    function now() {
      const cart = today();
      return {
        ...cart,
        items: cart.items.map((item) => ({
          ...item,
          configurationId: undefined,
          configuration: undefined,
        })),
      };
    }

    it.each([
      ['without the configurator', FIXTURE, false],
      ['on the merchant-api backend', MERCHANT_API, true],
    ] as const)(
      'answers it exactly as before, %s',
      async (_case, on, configures) => {
        backend = on;
        canConfigureServer.mockResolvedValue(configures);
        oms.cart.get.mockResolvedValue(now());

        await expect(service.getCart('cart-1', EVENT)).resolves.toStrictEqual(
          today(),
        );
      },
    );
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

    it('carries no line without a SKU or a quantity', async () => {
      oms.cart.get.mockReset().mockResolvedValueOnce({
        id: 'cart-1',
        items: [
          { id: 'item-1', quantity: 1 },
          { id: 'item-2', skuId: 100, quantity: 0 },
        ],
      });

      await copy();

      expect(addToCart).not.toHaveBeenCalled();
      expect(oms.cart.addItem).not.toHaveBeenCalled();
    });

    it('wraps the copy as a cart call', async () => {
      await copy();

      expect(wrapServiceCall).toHaveBeenCalledWith(
        expect.any(Function),
        'cart',
        CartError,
      );
    });

    it('still skips a plain line that fails to re-add', async () => {
      oms.cart.addItem.mockRejectedValueOnce(new Error('SKU unavailable'));

      await expect(copy()).resolves.toEqual(COPIED);
      expect(oms.cart.addItem).toHaveBeenCalledTimes(2);
    });
  });
});
