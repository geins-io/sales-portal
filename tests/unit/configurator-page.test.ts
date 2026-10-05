import { describe, it, expect } from 'vitest';
import {
  addError,
  addFailureKey,
  canCommit,
  replaceFailureKey,
  replaceRetryable,
  canRetryAdd,
  configuratorStage,
  showsAddRetry,
  configuredSkuId,
  failureKey,
  formError,
  headerError,
  refusedChange,
  stickyBoxMaxHeight,
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

  it('refuses when there is no SKU to add the line as', () => {
    expect(canCommit({ ...state(), busy: false, skuId: null })).toBe(false);
  });

  it('allows a commit with a SKU to add the line as', () => {
    expect(canCommit({ ...state(), busy: false, skuId: 1652 })).toBe(true);
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

describe('stickyBoxMaxHeight', () => {
  // The box sticks at top-48 (192 px) and keeps 16 px of air below.
  it('sets no height below lg, where the box does not stick', () => {
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1023,
        viewportHeight: 900,
        leftBottom: 2000,
      }),
    ).toBeUndefined();
  });

  it('fills the viewport under the sticky offset on a long page', () => {
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1024,
        viewportHeight: 900,
        leftBottom: 2000,
      }),
    ).toBe('692px');
  });

  it('stops at the left column, so the box is never pushed up at the end', () => {
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1440,
        viewportHeight: 900,
        leftBottom: 700,
      }),
    ).toBe('508px');
  });

  it('takes whichever ends first when the two meet', () => {
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1440,
        viewportHeight: 900,
        leftBottom: 884,
      }),
    ).toBe('692px');
  });

  it('never shrinks below 240 px', () => {
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1440,
        viewportHeight: 900,
        leftBottom: 300,
      }),
    ).toBe('240px');
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1440,
        viewportHeight: 900,
        leftBottom: 432,
      }),
    ).toBe('240px');
    expect(
      stickyBoxMaxHeight({
        viewportWidth: 1440,
        viewportHeight: 900,
        leftBottom: 433,
      }),
    ).toBe('241px');
  });
});

describe('configuredSkuId', () => {
  it("is the product's one SKU", () => {
    expect(configuredSkuId([{ skuId: 1652 }])).toBe(1652);
  });

  it('is nothing for a product without a SKU', () => {
    expect(configuredSkuId([])).toBeNull();
  });

  it('is nothing for a product with more than one, rather than a guess', () => {
    expect(configuredSkuId([{ skuId: 1 }, { skuId: 2 }])).toBeNull();
  });
});

describe('canRetryAdd', () => {
  it('offers a retry for a committed configuration that did not reach the cart', () => {
    expect(canRetryAdd({ committed: COMMITTED, busy: false })).toBe(true);
  });

  it('offers none while a request is in flight', () => {
    expect(canRetryAdd({ committed: COMMITTED, busy: true })).toBe(false);
  });

  it('offers none when nothing is held', () => {
    expect(canRetryAdd({ committed: null, busy: false })).toBe(false);
  });
});

describe('addError', () => {
  const FAILURE = { status: 502, message: 'x' };

  it('shows a failed add on the committed summary', () => {
    expect(addError('committed', FAILURE)).toBe(FAILURE);
  });

  it('leaves a failure on the form to the form', () => {
    expect(addError('form', FAILURE)).toBeNull();
  });

  it('shows nothing when nothing failed', () => {
    expect(addError('committed', null)).toBeNull();
  });
});

describe('addFailureKey', () => {
  it('asks a buyer the cart wants signed in to sign in with a company account', () => {
    expect(
      addFailureKey({ status: 401, message: 'x', code: 'UNAUTHORIZED' }),
    ).toBe('configurator.sign_in_required');
  });

  it('does not ask a signed-in buyer whose company may not use the cart to sign in', () => {
    expect(
      addFailureKey({ status: 403, message: 'x', code: 'FORBIDDEN' }),
    ).toBe('configurator.add_failed');
  });

  it('says the line was not added when the cart dropped it', () => {
    expect(addFailureKey({ status: 409, message: 'x' })).toBe(
      'configurator.add_not_added',
    );
  });

  it.each([0, 404, 410, 422, 500, 502])(
    'says the add failed for %i',
    (status) => {
      expect(addFailureKey({ status, message: 'x' })).toBe(
        'configurator.add_failed',
      );
    },
  );

  it('says the add failed when nothing more is known', () => {
    expect(addFailureKey(null)).toBe('configurator.add_failed');
  });
});

describe('showsAddRetry', () => {
  const FAILURE = { status: 502, message: 'x' };
  const base = {
    stage: 'committed' as const,
    error: FAILURE,
    busy: false,
  };

  it('shows the retry once the add has failed', () => {
    expect(showsAddRetry(base)).toBe(true);
  });

  it('keeps it on screen while the retry is under way', () => {
    expect(showsAddRetry({ ...base, error: null, busy: true })).toBe(true);
  });

  it('does not show it off the committed summary', () => {
    expect(showsAddRetry({ ...base, stage: 'form' })).toBe(false);
    expect(showsAddRetry({ ...base, stage: 'loading' })).toBe(false);
  });

  it('does not show it when nothing failed and nothing is running', () => {
    expect(showsAddRetry({ ...base, error: null })).toBe(false);
  });
});

describe('replaceRetryable', () => {
  it.each([
    [409, true],
    [502, true],
    [0, true],
  ])('sends the record again after a %i', (status, retryable) => {
    expect(replaceRetryable({ status, message: 'x' })).toBe(retryable);
  });

  it('does not after a 404: the record or the line is gone, and would be again', () => {
    expect(replaceRetryable({ status: 404, message: 'x' })).toBe(false);
  });

  it('does with no failure held, which is a retry under way', () => {
    expect(replaceRetryable(null)).toBe(true);
  });
});

describe('replaceFailureKey', () => {
  it('says the line kept its choices with no failure held', () => {
    expect(replaceFailureKey(null)).toBe('configurator.edit.update_failed');
  });

  it('says the line is gone when the cart says so, by its code', () => {
    expect(
      replaceFailureKey({ status: 404, message: 'x', code: 'CART_LINE_GONE' }),
    ).toBe('configurator.edit.line_gone');
  });

  it.each([
    ['a committed id that is gone', { status: 404, code: 'NOT_FOUND' }],
    ['a line not updated', { status: 409, code: 'CONFLICT' }],
    ['an upstream failure', { status: 502, code: 'EXTERNAL_API_ERROR' }],
    ['a failure with no code', { status: 0 }],
  ])('says the line kept its choices for %s', (_case, error) => {
    expect(replaceFailureKey({ message: 'x', ...error })).toBe(
      'configurator.edit.update_failed',
    );
  });
});
