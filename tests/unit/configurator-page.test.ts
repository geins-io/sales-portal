import { describe, it, expect } from 'vitest';
import {
  canCommit,
  configuratorStage,
  headerError,
  type ConfiguratorPageState,
} from '../../app/utils/configurator-page';
import type { CommittedConfiguration } from '../../shared/types/configurator';
import {
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../fixtures/configurator';

const COMMITTED: CommittedConfiguration = {
  committedConfigurationId: 'committed-1',
  configurationId: 'session-1',
  productId: '1101',
  quantity: 1,
  unitPrice: { net: 3200, currency: 'SEK' },
  summary: [],
};

function state(
  over: Partial<ConfiguratorPageState> = {},
): ConfiguratorPageState {
  return {
    status: 'active',
    configuration: makeValidConfiguration(),
    committed: null,
    error: null,
    ...over,
  };
}

describe('configuratorStage', () => {
  it('shows the committed summary once a result exists', () => {
    expect(
      configuratorStage(state({ status: 'closed', committed: COMMITTED })),
    ).toBe('committed');
  });

  it('prefers the committed summary over every other state', () => {
    // A commit that raced an expiry still ended in a result the buyer owns.
    expect(
      configuratorStage(
        state({
          status: 'expired',
          committed: COMMITTED,
          error: { status: 410, message: 'gone' },
        }),
      ),
    ).toBe('committed');
  });

  it('shows the expired state when the session is gone', () => {
    expect(configuratorStage(state({ status: 'expired' }))).toBe('expired');
  });

  it('shows the form for an active session with a document', () => {
    expect(configuratorStage(state())).toBe('form');
  });

  it('keeps the form when a change batch failed', () => {
    expect(
      configuratorStage(state({ error: { status: 500, message: 'boom' } })),
    ).toBe('form');
  });

  it('is loading while the session is being created', () => {
    expect(
      configuratorStage(state({ status: 'idle', configuration: null })),
    ).toBe('loading');
  });

  it('is loading between the release and the start of a restart', () => {
    expect(
      configuratorStage(state({ status: 'closed', committed: null })),
    ).toBe('loading');
  });

  it('reports an error when the session could not be created at all', () => {
    expect(
      configuratorStage(
        state({
          status: 'idle',
          configuration: null,
          error: { status: 503, message: 'the request failed' },
        }),
      ),
    ).toBe('error');
  });
});

describe('canCommit', () => {
  it('allows a commit on a complete configuration', () => {
    expect(canCommit({ ...state(), busy: false })).toBe(true);
  });

  it('refuses an incomplete configuration', () => {
    expect(
      canCommit({
        ...state({ configuration: makeInvalidConfiguration() }),
        busy: false,
      }),
    ).toBe(false);
  });

  it('refuses while a batch is in flight', () => {
    expect(canCommit({ ...state(), busy: true })).toBe(false);
  });

  it('refuses when the session is no longer active', () => {
    expect(canCommit({ ...state({ status: 'expired' }), busy: false })).toBe(
      false,
    );
    expect(canCommit({ ...state({ status: 'closed' }), busy: false })).toBe(
      false,
    );
  });

  it('refuses before a document has arrived', () => {
    expect(canCommit({ ...state({ configuration: null }), busy: false })).toBe(
      false,
    );
  });
});

describe('headerError', () => {
  const FAILURE = { status: 500, message: 'boom' };

  it('hands a failed renew to the header', () => {
    expect(headerError('renew', FAILURE)).toEqual(FAILURE);
  });

  it('keeps every other failure away from the header', () => {
    // The header's message names renew; a failed change batch must not claim
    // the session could not be extended.
    expect(headerError('change', FAILURE)).toBeNull();
    expect(headerError('commit', FAILURE)).toBeNull();
    expect(headerError('start', FAILURE)).toBeNull();
  });

  it('passes nothing on when nothing failed', () => {
    expect(headerError('renew', null)).toBeNull();
  });
});
