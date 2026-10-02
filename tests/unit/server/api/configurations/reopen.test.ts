import { describe, it, expect, beforeEach } from 'vitest';
import type { Configuration } from '../../../../../shared/types/configurator';
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

const BODY = { cartId: 'cart-1', itemId: 'item-1' };
const REOPENED = {
  configurationId: 'reopened-1',
  isValid: true,
} as Configuration;

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
    withoutTenant?: boolean;
    body?: unknown;
  } = {},
) {
  return makeEvent({ body: BODY, ...init });
}

describe('POST /api/configurations/reopen', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/reopen.post')
    ).default;
  });

  it('opens a session from the cart line and answers its document', async () => {
    backend.reopen.mockResolvedValue(REOPENED);
    const event = validEvent();

    const result = await handler(event);

    expect(backend.reopen).toHaveBeenCalledWith('cart-1', 'item-1', CTX);
    expect(result).toBe(REOPENED);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it.each([
    ['no cart id', { itemId: 'item-1' }],
    ['an empty cart id', { cartId: '', itemId: 'item-1' }],
    ['no item id', { cartId: 'cart-1' }],
    ['an empty item id', { cartId: 'cart-1', itemId: '' }],
  ])('answers 400 for %s, opening nothing', async (_case, body) => {
    await expect(handler(validEvent({ body }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(bodyReads).toHaveBeenCalled();
    expect(backend.reopen).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'reopen',
    event: validEvent,
    operation: 'configurator.reopen',
    result: REOPENED,
  });
});
