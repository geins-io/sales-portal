import { describe, it, expect } from 'vitest';
import {
  canCommit,
  configuratorStage,
  failureKey,
  formError,
  headerError,
  refusedChange,
  type ConfiguratorPageState,
} from '../../app/utils/configurator-page';
import type {
  CommittedConfiguration,
  ConfigurationChange,
} from '../../shared/types/configurator';
import {
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../fixtures/configurator';

const COMMITTED: CommittedConfiguration = {
  committedConfigurationId: 'committed-1',
  configurationId: 'session-1',
  articleNumber: '1101',
  quantity: 1,
  unitPrice: { sellingPriceExVat: 3200, currency: { code: 'SEK' } },
  discountPercent: 0,
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

describe('failureKey', () => {
  it('asks a buyer without a company account to sign in with one', () => {
    // MissingCustomerNumber: signed out, or a company with no customer number.
    expect(failureKey({ status: 403, message: 'x' })).toBe(
      'configurator.sign_in_required',
    );
  });

  it.each([0, 404, 410, 422, 500, 502])(
    'keeps the general copy for %i',
    (status) => {
      expect(failureKey({ status, message: 'x' })).toBe('configurator.failed');
    },
  );

  it('keeps the general copy when nothing failed', () => {
    expect(failureKey(null)).toBe('configurator.failed');
  });
});

const REFUSAL = { status: 422, message: 'x', code: 'VALIDATION_ERROR' };
const WIDTH: ConfigurationChange = {
  type: 'variable',
  variableId: 'width',
  value: 0,
};

describe('refusedChange', () => {
  it('names the change a refused batch carried', () => {
    expect(refusedChange('change', REFUSAL, WIDTH)).toEqual(WIDTH);
  });

  it('names an option change as well', () => {
    const pick: ConfigurationChange = {
      type: 'option',
      optionId: 'oak',
      instanceId: '1',
      selected: true,
      quantity: 1,
      lock: 'none',
    };
    expect(refusedChange('change', REFUSAL, pick)).toEqual(pick);
  });

  it('is nothing when the change failed for another reason', () => {
    expect(
      refusedChange('change', { status: 500, message: 'x' }, WIDTH),
    ).toBeNull();
    // The status alone is not the refusal: the code says the provider said no.
    expect(
      refusedChange('change', { status: 422, message: 'x' }, WIDTH),
    ).toBeNull();
    expect(
      refusedChange(
        'change',
        { status: 400, message: 'x', code: 'VALIDATION_ERROR' },
        WIDTH,
      ),
    ).toBeNull();
  });

  it('is nothing when the refused verb was not a change', () => {
    expect(refusedChange('commit', REFUSAL, WIDTH)).toBeNull();
    expect(refusedChange('start', REFUSAL, WIDTH)).toBeNull();
  });

  it('is nothing when nothing failed or nothing was sent', () => {
    expect(refusedChange('change', null, WIDTH)).toBeNull();
    expect(refusedChange('change', REFUSAL, null)).toBeNull();
  });

  it('is nothing for a quantity change, which no node on the form owns', () => {
    expect(
      refusedChange('change', REFUSAL, { type: 'quantity', quantity: 0 }),
    ).toBeNull();
  });
});

describe('formError', () => {
  const FAILURE = { status: 500, message: 'x' };

  it('shows a failure on the form', () => {
    expect(formError('change', 'form', FAILURE, null)).toEqual(FAILURE);
    expect(formError('commit', 'form', FAILURE, null)).toEqual(FAILURE);
  });

  it('leaves a refused change to the node it was aimed at', () => {
    expect(formError('change', 'form', REFUSAL, WIDTH)).toBeNull();
  });

  it('leaves a failed renew to the header', () => {
    expect(formError('renew', 'form', FAILURE, null)).toBeNull();
  });

  it('shows nothing off the form', () => {
    expect(formError('start', 'error', FAILURE, null)).toBeNull();
    expect(formError('change', 'expired', FAILURE, null)).toBeNull();
  });

  it('shows nothing when nothing failed', () => {
    expect(formError('change', 'form', null, null)).toBeNull();
  });
});
