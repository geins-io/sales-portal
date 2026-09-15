import { describe, it, expect, beforeEach } from 'vitest';
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

const ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const RENEWED = { expiresAt: '2030-01-01T00:20:00.000Z' };

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
  } = {},
) {
  return makeEvent({ ...init, id: ID });
}

describe('POST /api/configurations/:id/renew', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/[id]/renew.post')
    ).default;
  });

  it('returns the new expiry', async () => {
    backend.renew.mockResolvedValue(RENEWED);
    const event = validEvent();

    const result = await handler(event);

    expect(result).toEqual(RENEWED);
    expect(backend.renew).toHaveBeenCalledWith(ID, CTX);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('reads no body: renewing takes nothing but the id', async () => {
    backend.renew.mockResolvedValue(RENEWED);

    await handler(validEvent());

    expect(bodyReads).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'renew',
    event: validEvent,
    operation: 'configurator.renew',
    result: RENEWED,
  });
});
