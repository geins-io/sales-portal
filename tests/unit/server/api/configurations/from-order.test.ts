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

const ORDER_ID = '6f1c2a9e-0b8d-4e3f-9a51-2c7d8e4b1f03';
const BODY = { productId: '1359', publicOrderId: ORDER_ID, row: 1 };
const CREATED = {
  configurationId: 'fresh-1',
  isValid: false,
  sections: [],
} as Partial<Configuration> as Configuration;

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

describe('POST /api/configurations/from-order', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/from-order.post')
    ).default;
  });

  it('replays the order row into a new session and answers it with whether the choices came back', async () => {
    backend.create.mockResolvedValue(CREATED);
    backend.orderLineChoices.mockResolvedValue({
      productId: 1359,
      variables: [],
      options: [],
    });
    const event = validEvent();

    const result = await handler(event);

    expect(backend.create).toHaveBeenCalledWith(
      { productId: '1359', quantity: 1 },
      CTX,
    );
    expect(backend.orderLineChoices).toHaveBeenCalledWith(ORDER_ID, 1, CTX);
    expect(result).toEqual({ configuration: CREATED, replayed: true });
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('answers the fresh session, not replayed, for a row with nothing to replay', async () => {
    backend.create.mockResolvedValue(CREATED);
    backend.orderLineChoices.mockResolvedValue(null);

    await expect(handler(validEvent())).resolves.toEqual({
      configuration: CREATED,
      replayed: false,
    });
    expect(backend.applyChanges).not.toHaveBeenCalled();
  });

  it.each([
    ['no product id', { publicOrderId: ORDER_ID, row: 0 }],
    ['an empty product id', { productId: '', publicOrderId: ORDER_ID, row: 0 }],
    ['no order id', { productId: '1359', row: 0 }],
    [
      'an order id that is not a GUID',
      { productId: '1359', publicOrderId: 'order-1', row: 0 },
    ],
    ['no row', { productId: '1359', publicOrderId: ORDER_ID }],
    ['a negative row', { productId: '1359', publicOrderId: ORDER_ID, row: -1 }],
    [
      'a fractional row',
      { productId: '1359', publicOrderId: ORDER_ID, row: 1.5 },
    ],
    ['a row as text', { productId: '1359', publicOrderId: ORDER_ID, row: '1' }],
  ])('answers 400 for %s, creating nothing', async (_case, body) => {
    await expect(handler(validEvent({ body }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(bodyReads).toHaveBeenCalled();
    expect(backend.create).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'create',
    event: validEvent,
    operation: 'configurator.fromOrder',
    result: CREATED,
  });
});
