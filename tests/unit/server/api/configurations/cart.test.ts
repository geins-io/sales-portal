import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAppError, ErrorCode } from '../../../../../server/utils/errors';
import {
  CTX,
  backend,
  bodyReads,
  headersOf,
  lifecycleCases,
  makeEvent,
  resetHarness,
  type RouteHandler,
} from './harness';

const getCart = vi.fn();
const addItem = vi.fn();

vi.mock('../../../../../server/services/cart', () => ({
  getCart: (...args: unknown[]) => getCart(...args),
  addItem: (...args: unknown[]) => addItem(...args),
}));

const COMMITTED_ID = '9c5b94b1-35ad-49bb-b118-8e8fc24abf80';
const BODY = { cartId: 'cart-1', skuId: 1652, quantity: 2 };
const CART = { id: 'cart-1', items: [{ id: 'item-1', skuId: 1652 }] };

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
    withoutTenant?: boolean;
    body?: unknown;
  } = {},
) {
  return makeEvent({ body: BODY, ...init, id: COMMITTED_ID });
}

describe('POST /api/configurations/:id/cart', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    getCart.mockReset().mockResolvedValue(CART);
    addItem.mockReset().mockResolvedValue(CART);
    handler = (
      await import('../../../../../server/api/configurations/[id]/cart.post')
    ).default;
  });

  it('adds the committed configuration and answers the cart as the portal reads it', async () => {
    backend.addToCart.mockResolvedValue({ itemId: 'item-1' });
    const event = validEvent();

    const result = await handler(event);

    expect(backend.addToCart).toHaveBeenCalledWith(
      'cart-1',
      { committedConfigurationId: COMMITTED_ID, skuId: 1652, quantity: 2 },
      expect.objectContaining(CTX),
    );
    expect(getCart).toHaveBeenCalledWith('cart-1', event);
    expect(result).toEqual({ cart: CART, itemId: 'item-1' });
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it("hands the backend the portal's plain add, for a backend with no configured cart", async () => {
    backend.addToCart.mockResolvedValue({ itemId: 'item-1' });
    const event = validEvent();

    await handler(event);

    const ctx = backend.addToCart.mock.calls[0]![2] as {
      cart: {
        addPlainItem: (
          cartId: string,
          item: { skuId: number; quantity: number },
        ) => Promise<unknown>;
      };
    };
    await ctx.cart.addPlainItem('cart-1', { skuId: 7, quantity: 3 });
    expect(addItem).toHaveBeenCalledWith(
      'cart-1',
      { skuId: 7, quantity: 3 },
      event,
    );
  });

  it('answers success without a cart when the add went through but the read failed', async () => {
    // A failure here would offer a retry, and the retry would add the same
    // committed id a second time: two lines.
    backend.addToCart.mockResolvedValue({ itemId: 'item-1' });
    getCart.mockRejectedValue(
      createAppError(ErrorCode.EXTERNAL_API_ERROR, 'cart read failed'),
    );

    await expect(handler(validEvent())).resolves.toEqual({
      cart: null,
      itemId: 'item-1',
    });
  });

  it('reads no cart when the add fails', async () => {
    backend.addToCart.mockRejectedValue(
      createAppError(ErrorCode.CONFLICT, 'The configured line was not added'),
    );

    await expect(handler(validEvent())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(getCart).not.toHaveBeenCalled();
  });

  it.each([
    ['no cart id', { skuId: 1652, quantity: 1 }],
    ['an empty cart id', { cartId: '', skuId: 1652, quantity: 1 }],
    [
      'a SKU id that is not a number',
      { cartId: 'c', skuId: '1652', quantity: 1 },
    ],
    ['a quantity of zero', { cartId: 'c', skuId: 1652, quantity: 0 }],
    [
      'a quantity over the cart limit',
      { cartId: 'c', skuId: 1652, quantity: 1000 },
    ],
  ])('answers 400 for %s, adding nothing', async (_case, body) => {
    await expect(handler(validEvent({ body }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(bodyReads).toHaveBeenCalled();
    expect(backend.addToCart).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'addToCart',
    event: validEvent,
    operation: 'configurator.addToCart',
    result: { itemId: 'item-1' },
  });
});
