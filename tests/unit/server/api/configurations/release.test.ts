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

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
  } = {},
) {
  return makeEvent({ ...init, id: ID });
}

describe('DELETE /api/configurations/:id', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/[id].delete')
    ).default;
  });

  it('returns null so h3 answers 204 with no body', async () => {
    backend.release.mockResolvedValue(undefined);
    const event = validEvent();

    const result = await handler(event);

    expect(result).toBeNull();
    expect(backend.release).toHaveBeenCalledWith(ID, CTX);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('reads no body', async () => {
    backend.release.mockResolvedValue(undefined);

    await handler(validEvent());

    expect(bodyReads).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'release',
    event: validEvent,
    operation: 'configurator.release',
    result: undefined,
  });
});
