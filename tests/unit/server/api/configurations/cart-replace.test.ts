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

vi.mock('../../../../../server/services/cart', () => ({
  getCart: (...args: unknown[]) => getCart(...args),
}));

const COMMITTED_ID = '85f20db3-b4bf-428b-a12f-57afa3be761d';
const BODY = { cartId: 'cart-1', itemId: 'item-1' };
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

describe('PUT /api/configurations/:id/cart', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    getCart.mockReset().mockResolvedValue(CART);
    handler = (
      await import('../../../../../server/api/configurations/[id]/cart.put')
    ).default;
  });

  it('swaps the line onto the committed configuration and answers the cart as the portal reads it', async () => {
    backend.replaceLine.mockResolvedValue({ itemId: 'item-1' });
    const event = validEvent();

    const result = await handler(event);

    expect(backend.replaceLine).toHaveBeenCalledWith(
      'cart-1',
      'item-1',
      COMMITTED_ID,
      CTX,
    );
    expect(getCart).toHaveBeenCalledWith('cart-1', event);
    expect(result).toEqual({ cart: CART, itemId: 'item-1' });
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('answers success without a cart when the swap went through but the read failed', async () => {
    backend.replaceLine.mockResolvedValue({ itemId: 'item-1' });
    getCart.mockRejectedValue(
      createAppError(ErrorCode.EXTERNAL_API_ERROR, 'cart read failed'),
    );

    await expect(handler(validEvent())).resolves.toEqual({
      cart: null,
      itemId: 'item-1',
    });
  });

  it('reads no cart when the swap fails', async () => {
    backend.replaceLine.mockRejectedValue(
      createAppError(ErrorCode.CONFLICT, 'The line was not updated'),
    );

    await expect(handler(validEvent())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(getCart).not.toHaveBeenCalled();
  });

  it.each([
    ['no cart id', { itemId: 'item-1' }],
    ['an empty cart id', { cartId: '', itemId: 'item-1' }],
    ['no item id', { cartId: 'cart-1' }],
    ['an empty item id', { cartId: 'cart-1', itemId: '' }],
  ])('answers 400 for %s, swapping nothing', async (_case, body) => {
    await expect(handler(validEvent({ body }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(bodyReads).toHaveBeenCalled();
    expect(backend.replaceLine).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'replaceLine',
    event: validEvent,
    operation: 'configurator.replaceLine',
    result: { itemId: 'item-1' },
  });
});
