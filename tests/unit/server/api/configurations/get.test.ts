import { describe, it, expect, beforeEach } from 'vitest';
import { makeInitialConfiguration } from '../../../../fixtures/configurator';
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

const CONFIGURATION = makeInitialConfiguration();
const ID = CONFIGURATION.configurationId;

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
  } = {},
) {
  return makeEvent({ ...init, id: ID });
}

describe('GET /api/configurations/:id', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/[id].get')
    ).default;
  });

  it('returns the document for the id in the path', async () => {
    backend.get.mockResolvedValue(CONFIGURATION);
    const event = validEvent();

    const result = await handler(event);

    expect(result).toBe(CONFIGURATION);
    expect(backend.get).toHaveBeenCalledWith(ID, CTX);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('reads no body', async () => {
    backend.get.mockResolvedValue(CONFIGURATION);

    await handler(validEvent());

    expect(bodyReads).not.toHaveBeenCalled();
  });

  it('asks the backend for an empty id when the path has none', async () => {
    // Nitro cannot route a request here without an id, so this only pins that
    // the route hands the miss to the backend — which answers 404 — instead of
    // inventing an id or a second error path of its own.
    backend.get.mockRejectedValue(new Error('unreachable'));

    await expect(handler(makeEvent())).rejects.toThrow();
    expect(backend.get).toHaveBeenCalledWith('', CTX);
  });

  lifecycleCases({
    handler: () => handler,
    method: 'get',
    event: validEvent,
    operation: 'configurator.get',
    result: CONFIGURATION,
  });
});
