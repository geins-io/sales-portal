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

const BODY = {
  productId: '1359',
  quantity: 2,
  variables: [{ id: 'width', value: 1200 }],
  options: [{ id: 'adapter', instanceId: '0', quantity: 1 }],
};
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

describe('POST /api/configurations/restore', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/restore.post')
    ).default;
  });

  it('creates a session at the given quantity and answers it with whether the choices came back', async () => {
    backend.create.mockResolvedValue(CREATED);
    const event = validEvent();

    const result = await handler(event);

    expect(backend.create).toHaveBeenCalledWith(
      { productId: '1359', quantity: 2 },
      CTX,
    );
    // The fresh session has no node the choices name: the template moved.
    expect(result).toEqual({ configuration: CREATED, replayed: false });
    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('answers the fresh session as replayed when there is nothing to replay', async () => {
    backend.create.mockResolvedValue(CREATED);

    await expect(
      handler(validEvent({ body: { ...BODY, variables: [], options: [] } })),
    ).resolves.toEqual({ configuration: CREATED, replayed: true });
  });

  it('takes the fractional and zero quantities a document holds on its rows', async () => {
    backend.create.mockResolvedValue(CREATED);
    const options = [
      { id: 'plate', instanceId: '0', quantity: 0.073125 },
      { id: 'warranty', instanceId: '1', quantity: 0 },
    ];

    await handler(validEvent({ body: { ...BODY, options } }));

    expect(backend.create).toHaveBeenCalled();
  });

  it('takes an option with an empty instance id, which the fresh session does not hold, and answers the defaults', async () => {
    backend.create.mockResolvedValue(CREATED);
    const options = [{ id: 'adapter', instanceId: '', quantity: 1 }];

    await expect(
      handler(validEvent({ body: { ...BODY, variables: [], options } })),
    ).resolves.toEqual({ configuration: CREATED, replayed: false });
    expect(backend.applyChanges).not.toHaveBeenCalled();
  });

  it.each([
    ['no product id', { ...BODY, productId: undefined }],
    ['an empty product id', { ...BODY, productId: '' }],
    ['no quantity', { ...BODY, quantity: undefined }],
    ['a quantity of 0', { ...BODY, quantity: 0 }],
    ['a fractional quantity', { ...BODY, quantity: 1.5 }],
    ['no variables', { ...BODY, variables: undefined }],
    ['no options', { ...BODY, options: undefined }],
    ['a variable without an id', { ...BODY, variables: [{ value: 1 }] }],
    [
      'a variable value that is an object',
      { ...BODY, variables: [{ id: 'width', value: { a: 1 } }] },
    ],
    [
      'an option without an instance id',
      { ...BODY, options: [{ id: 'adapter', quantity: 1 }] },
    ],
    [
      'an option with a negative quantity',
      { ...BODY, options: [{ id: 'adapter', instanceId: '0', quantity: -1 }] },
    ],
    [
      'an option quantity as text',
      { ...BODY, options: [{ id: 'adapter', instanceId: '0', quantity: '1' }] },
    ],
    [
      'more options than a document holds',
      {
        ...BODY,
        options: Array.from({ length: 501 }, (_, i) => ({
          id: `o${i}`,
          instanceId: '0',
          quantity: 1,
        })),
      },
    ],
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
    operation: 'configurator.restore',
    result: CREATED,
  });
});
