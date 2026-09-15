import { describe, it, expect, beforeEach } from 'vitest';
import type { CommittedConfiguration } from '../../../../../shared/types/configurator';
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

const COMMITTED: CommittedConfiguration = {
  committedConfigurationId: '9c5b94b1-35ad-49bb-b118-8e8fc24abf80',
  configurationId: ID,
  productId: 'arbetsbord-pro',
  quantity: 2,
  unitPrice: { net: 3200, currency: 'SEK' },
  summary: [{ label: 'Bredd', value: '1600 mm' }],
};

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
  } = {},
) {
  return makeEvent({ ...init, id: ID });
}

describe('POST /api/configurations/:id/commit', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/[id]/commit.post')
    ).default;
  });

  it('returns the committed configuration', async () => {
    backend.commit.mockResolvedValue(COMMITTED);
    const event = validEvent();

    const result = await handler(event);

    expect(result).toBe(COMMITTED);
    expect(backend.commit).toHaveBeenCalledWith(ID, CTX);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('reads no body', async () => {
    backend.commit.mockResolvedValue(COMMITTED);

    await handler(validEvent());

    expect(bodyReads).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'commit',
    event: validEvent,
    operation: 'configurator.commit',
    result: COMMITTED,
  });
});
