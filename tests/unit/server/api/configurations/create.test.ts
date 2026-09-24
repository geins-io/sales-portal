import { describe, it, expect, beforeEach } from 'vitest';
import { makeInitialConfiguration } from '../../../../fixtures/configurator';
import {
  CTX,
  backend,
  bodyReads,
  buildConfiguratorRequestContext,
  headersOf,
  lifecycleCases,
  makeEvent,
  resetHarness,
  type RouteHandler,
} from './harness';

const CONFIGURATION = makeInitialConfiguration();

const VALID = { productId: 'arbetsbord-pro', quantity: 2 };

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
  } = {},
) {
  return makeEvent({ ...init, body: { ...VALID } });
}

describe('POST /api/configurations', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/index.post')
    ).default;
  });

  it('returns the document the backend created', async () => {
    backend.create.mockResolvedValue(CONFIGURATION);
    const event = validEvent();

    const result = await handler(event);

    expect(result).toBe(CONFIGURATION);
    expect(backend.create).toHaveBeenCalledWith(VALID, CTX);
    expect(buildConfiguratorRequestContext).toHaveBeenCalledWith(event);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  describe('the body it refuses with 400', () => {
    const refused: [string, unknown][] = [
      ['no body at all', undefined],
      ['a body that is not an object', 'arbetsbord-pro'],
      ['no productId', { quantity: 1 }],
      ['an empty productId', { productId: '', quantity: 1 }],
      ['no quantity', { productId: 'arbetsbord-pro' }],
      ['a quantity of zero', { productId: 'arbetsbord-pro', quantity: 0 }],
      ['a negative quantity', { productId: 'arbetsbord-pro', quantity: -1 }],
      ['a fractional quantity', { productId: 'arbetsbord-pro', quantity: 1.5 }],
      [
        'a quantity over the cap',
        { productId: 'arbetsbord-pro', quantity: 1000 },
      ],
      [
        'a quantity that is a string',
        { productId: 'arbetsbord-pro', quantity: '2' },
      ],
    ];

    it.each(refused)('answers 400 on %s', async (_case, body) => {
      await expect(handler(makeEvent({ body }))).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(bodyReads).toHaveBeenCalled();
      expect(backend.create).not.toHaveBeenCalled();
    });

    it('accepts the largest quantity the cap allows', async () => {
      backend.create.mockResolvedValue(CONFIGURATION);

      await handler(makeEvent({ body: { productId: 'p1', quantity: 999 } }));

      expect(backend.create).toHaveBeenCalledWith(
        { productId: 'p1', quantity: 999 },
        CTX,
      );
    });
  });

  lifecycleCases({
    handler: () => handler,
    method: 'create',
    event: validEvent,
    operation: 'configurator.create',
    result: CONFIGURATION,
  });
});
