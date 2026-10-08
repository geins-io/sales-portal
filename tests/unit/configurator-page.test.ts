import { describe, it, expect } from 'vitest';
import {
  addError,
  addFailureKey,
  addRetryable,
  canCommit,
  editOpenFailureKey,
  editOpenRetryable,
  restartsInMarket,
  startFailureKey,
  canPress,
  quantityToFollow,
  pageQuantity,
  lineToRaise,
  replaceFailureKey,
  replaceRetryable,
  canRetryAdd,
  configuratorStage,
  showsAddRetry,
  configuredSkuId,
  failureKey,
  formError,
  refusedChange,
  RENEW_LEAD_MS,
  renewDue,
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

  it('refuses when the stock is all in the cart or there is none', () => {
    for (const stockBlock of ['max_in_cart', 'out_of_stock'] as const) {
      expect(canCommit({ ...state(), busy: false, stockBlock })).toBe(false);
    }
  });

  it('allows a commit while stock is left', () => {
    expect(canCommit({ ...state(), busy: false, stockBlock: null })).toBe(true);
  });
});

describe('canPress', () => {
  it('passes a press on a complete configuration on', () => {
    expect(canPress({ ...state(), busy: false, skuId: 1652 })).toBe(true);
  });

  it('drops a press on an incomplete configuration with nothing in flight', () => {
    expect(
      canPress({
        ...state({ configuration: makeInvalidConfiguration() }),
        busy: false,
      }),
    ).toBe(false);
  });

  // The batch that the blur sent may be what completes it; its answer decides.
  it('passes a press on while a request is in flight, whatever the document says', () => {
    expect(
      canPress({
        ...state({ configuration: makeInvalidConfiguration() }),
        busy: true,
      }),
    ).toBe(true);
    expect(canPress({ ...state(), busy: true })).toBe(true);
  });

  it('drops a press when there is no SKU to add the line as', () => {
    expect(canPress({ ...state(), busy: false, skuId: null })).toBe(false);
    expect(canPress({ ...state(), busy: true, skuId: null })).toBe(false);
  });

  it('drops a press when the session is no longer active', () => {
    for (const status of ['expired', 'closed', 'idle'] as const) {
      expect(canPress({ ...state({ status }), busy: true })).toBe(false);
      expect(canPress({ ...state({ status }), busy: false })).toBe(false);
    }
  });

  it('drops a press before a document has arrived', () => {
    expect(canPress({ ...state({ configuration: null }), busy: false })).toBe(
      false,
    );
  });

  // A press held for a batch would add past the stock once the batch answers.
  it('drops a press when the stock is all in the cart or there is none, in flight too', () => {
    for (const stockBlock of ['max_in_cart', 'out_of_stock'] as const) {
      expect(canPress({ ...state(), busy: false, stockBlock })).toBe(false);
      expect(canPress({ ...state(), busy: true, stockBlock })).toBe(false);
    }
  });

  it('passes a press on while stock is left', () => {
    expect(canPress({ ...state(), busy: false, stockBlock: null })).toBe(true);
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

const NOT_AVAILABLE = {
  status: 404,
  message: 'x',
  code: 'CONFIGURATOR_NOT_AVAILABLE',
};
const CURRENCY = { status: 409, message: 'x', code: 'CURRENCY_MISMATCH' };

describe('startFailureKey', () => {
  it('says the product cannot be configured when the account has no configurator', () => {
    expect(startFailureKey(NOT_AVAILABLE)).toBe('configurator.not_available');
  });

  it('says the same for a product the configurator does not know', () => {
    expect(
      startFailureKey({ status: 404, message: 'x', code: 'NOT_FOUND' }),
    ).toBe('configurator.not_available');
  });

  it('asks the buyer to resume in this market after a currency mismatch', () => {
    expect(startFailureKey(CURRENCY)).toBe('configurator.currency_mismatch');
  });

  it('still asks a buyer without a company account to sign in', () => {
    expect(startFailureKey({ status: 403, message: 'x' })).toBe(
      'configurator.sign_in_required',
    );
  });

  it.each([0, 409, 410, 422, 500, 502])(
    'keeps the general copy for %i',
    (status) => {
      expect(startFailureKey({ status, message: 'x' })).toBe(
        'configurator.failed',
      );
    },
  );

  it('keeps the general copy when nothing failed', () => {
    expect(startFailureKey(null)).toBe('configurator.failed');
  });
});

describe('editOpenFailureKey', () => {
  it('says the product in the cart cannot be changed in this market', () => {
    expect(editOpenFailureKey(CURRENCY)).toBe(
      'configurator.edit.currency_mismatch',
    );
  });

  it('says the product cannot be configured when the account has no configurator', () => {
    expect(editOpenFailureKey(NOT_AVAILABLE)).toBe(
      'configurator.not_available',
    );
  });

  it.each([
    ['an unknown configuration', { status: 404, code: 'NOT_FOUND' }],
    ['a 409 of another kind', { status: 409, code: 'CONFLICT' }],
    ['an upstream failure', { status: 502, code: 'EXTERNAL_API_ERROR' }],
  ])('says the line could not be opened for %s', (_case, error) => {
    expect(editOpenFailureKey({ message: 'x', ...error })).toBe(
      'configurator.edit.open_failed',
    );
  });

  it('says the line could not be opened when nothing failed', () => {
    expect(editOpenFailureKey(null)).toBe('configurator.edit.open_failed');
  });
});

describe('editOpenRetryable', () => {
  it.each([
    ['a currency mismatch', CURRENCY],
    ['an account without a configurator', NOT_AVAILABLE],
  ])(
    'offers no second try after %s, which would answer the same',
    (_case, error) => {
      expect(editOpenRetryable(error)).toBe(false);
    },
  );

  it.each([
    [
      'an unknown configuration',
      { status: 404, message: 'x', code: 'NOT_FOUND' },
    ],
    ['an upstream failure', { status: 502, message: 'x' }],
    ['no failure held', null],
  ])('offers one after %s', (_case, error) => {
    expect(editOpenRetryable(error)).toBe(true);
  });
});

describe('addRetryable', () => {
  it('offers no second add of a record priced in another currency', () => {
    expect(addRetryable(CURRENCY)).toBe(false);
  });

  it.each([
    ['a dropped line', { status: 409, message: 'x', code: 'CONFLICT' }],
    ['an upstream failure', { status: 502, message: 'x' }],
    ['no failure held', null],
  ])('offers one after %s', (_case, error) => {
    expect(addRetryable(error)).toBe(true);
  });
});

describe('restartsInMarket', () => {
  it('offers to resume in this market after a currency mismatch', () => {
    expect(restartsInMarket({ error: CURRENCY, editing: false })).toBe(true);
  });

  it('does not while a cart line is edited: the line is in the other currency', () => {
    expect(restartsInMarket({ error: CURRENCY, editing: true })).toBe(false);
  });

  it.each([
    ['an account without a configurator', NOT_AVAILABLE],
    ['a dropped line', { status: 409, message: 'x', code: 'CONFLICT' }],
    ['no failure held', null],
  ])('does not after %s', (_case, error) => {
    expect(restartsInMarket({ error, editing: false })).toBe(false);
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
    expect(formError('form', FAILURE, null)).toEqual(FAILURE);
  });

  it('leaves a refused change to the node it was aimed at', () => {
    expect(formError('form', REFUSAL, WIDTH)).toBeNull();
  });

  it('shows nothing off the form', () => {
    expect(formError('error', FAILURE, null)).toBeNull();
    expect(formError('expired', FAILURE, null)).toBeNull();
  });

  it('shows nothing when nothing failed', () => {
    expect(formError('form', null, null)).toBeNull();
  });
});

describe('renewDue', () => {
  const EXPIRES = Date.parse('2026-01-01T13:00:00.000Z');
  const CONTACT = EXPIRES - 60 * 60_000;

  function due(over: { now?: number; lastActive?: number } = {}): boolean {
    return renewDue({
      expiresAt: new Date(EXPIRES).toISOString(),
      now: over.now ?? EXPIRES - 60_000,
      lastActive: over.lastActive ?? CONTACT + 1,
      lastContact: CONTACT,
    });
  }

  it('renews five minutes before expiry', () => {
    expect(RENEW_LEAD_MS).toBe(5 * 60_000);
  });

  it('renews a session close to expiry for a buyer active since its last answer', () => {
    expect(due()).toBe(true);
    expect(due({ now: EXPIRES - RENEW_LEAD_MS })).toBe(true);
    expect(due({ now: EXPIRES - 1 })).toBe(true);
  });

  it('waits while expiry is further away', () => {
    expect(due({ now: EXPIRES - RENEW_LEAD_MS - 1 })).toBe(false);
  });

  it('renews nothing for a buyer idle since the last answer', () => {
    expect(due({ lastActive: CONTACT })).toBe(false);
    expect(due({ lastActive: CONTACT - 1 })).toBe(false);
  });

  it('asks once the session has run out on this clock, active or idle: the answer says whether it has', () => {
    expect(due({ now: EXPIRES })).toBe(true);
    expect(due({ now: EXPIRES + 1 })).toBe(true);
    expect(due({ now: EXPIRES, lastActive: CONTACT })).toBe(true);
    expect(due({ now: EXPIRES + 60_000, lastActive: CONTACT - 1 })).toBe(true);
  });

  it('waits for the boundary on an idle page', () => {
    expect(due({ now: EXPIRES - 1, lastActive: CONTACT })).toBe(false);
  });

  it('renews nothing for an expiry it cannot read', () => {
    expect(
      renewDue({
        expiresAt: 'not a date',
        now: EXPIRES - 60_000,
        lastActive: CONTACT + 1,
        lastContact: CONTACT,
      }),
    ).toBe(false);
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

  it('asks the buyer to resume in this market after a currency mismatch, before the 409 row', () => {
    expect(addFailureKey(CURRENCY)).toBe('configurator.currency_mismatch');
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

  it('does not after a currency mismatch: the line is in the other currency', () => {
    expect(replaceRetryable(CURRENCY)).toBe(false);
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

  it('says the line cannot be changed in this market after a currency mismatch', () => {
    expect(replaceFailureKey(CURRENCY)).toBe(
      'configurator.edit.currency_mismatch',
    );
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

describe('pageQuantity', () => {
  const LINE = { cartId: 'cart-1', itemId: 'line-1' };
  const items = [
    { id: 'other', quantity: 7 },
    { id: 'line-1', quantity: 3 },
  ];

  it('is one outside an edit, whatever line the session came from', () => {
    expect(pageQuantity(null, 'cart-1', items)).toBe(1);
    expect(pageQuantity(null, 'cart-1', null)).toBe(1);
  });

  it("is the edited line's quantity while the cart holds it", () => {
    expect(pageQuantity(LINE, 'cart-1', items)).toBe(3);
  });

  // Not read yet, or the read failed: nothing says the line is gone.
  it('is nothing to follow in an edit before the cart has been read', () => {
    expect(pageQuantity(LINE, 'cart-1', null)).toBeNull();
    expect(pageQuantity(LINE, 'cart-1', undefined)).toBeNull();
  });

  it('goes back to one once the edited line is deleted', () => {
    expect(pageQuantity(LINE, 'cart-1', [{ id: 'other', quantity: 7 }])).toBe(
      1,
    );
  });

  it('goes back to one once the cart is emptied', () => {
    expect(pageQuantity(LINE, 'cart-1', [])).toBe(1);
  });

  it('goes back to one when the cart read is another cart', () => {
    expect(pageQuantity(LINE, 'cart-9', items)).toBe(1);
    expect(pageQuantity(LINE, null, items)).toBe(1);
  });
});

describe('lineToRaise', () => {
  const LINE = { cartId: 'cart-1', itemId: 'line-1' };
  function raise(over: Partial<Parameters<typeof lineToRaise>[0]> = {}) {
    return lineToRaise({
      editing: false,
      changed: false,
      source: LINE,
      cartId: 'cart-1',
      items: [
        { id: 'other', quantity: 7 },
        { id: 'line-1', quantity: 2 },
      ],
      ...over,
    });
  }

  it('raises the line the session came from by one while the choices are unchanged', () => {
    expect(raise()).toEqual({ itemId: 'line-1', quantity: 3 });
  });

  it('adds a new line once a choice has changed', () => {
    expect(raise({ changed: true })).toBeNull();
  });

  it('never raises in an edit, which updates the line instead', () => {
    expect(raise({ editing: true })).toBeNull();
  });

  it('adds a new line for a session no line is behind', () => {
    expect(raise({ source: null })).toBeNull();
  });

  it('adds a new line once the line has left the cart', () => {
    expect(raise({ items: [{ id: 'other', quantity: 7 }] })).toBeNull();
    expect(raise({ items: [] })).toBeNull();
    expect(raise({ items: null })).toBeNull();
  });

  it('adds a new line when the cart read is another cart', () => {
    expect(raise({ cartId: 'cart-9' })).toBeNull();
  });
});

describe('quantityToFollow', () => {
  function at(quantity: number, configurationId = 'session-1') {
    return {
      ...makeValidConfiguration(),
      configurationId,
      quantity,
    };
  }

  function follow(over: Partial<Parameters<typeof quantityToFollow>[0]> = {}) {
    return quantityToFollow({
      status: 'active',
      busy: false,
      configuration: at(1),
      lineQuantity: 3,
      followed: null,
      ...over,
    });
  }

  it("answers the line's quantity when the session is at another", () => {
    expect(follow()).toBe(3);
  });

  it('answers nothing when the session is at the line’s quantity', () => {
    expect(follow({ lineQuantity: 1 })).toBeNull();
  });

  it('answers nothing when no line is behind the session', () => {
    expect(follow({ lineQuantity: null })).toBeNull();
  });

  it('answers nothing while a request is in flight', () => {
    expect(follow({ busy: true })).toBeNull();
  });

  it('answers nothing for a session that is not active', () => {
    for (const status of ['idle', 'expired', 'closed'] as const) {
      expect(follow({ status })).toBeNull();
    }
  });

  it('answers nothing without a document', () => {
    expect(follow({ configuration: null })).toBeNull();
  });

  it('answers nothing for a quantity already sent to this session', () => {
    expect(
      follow({ followed: { configurationId: 'session-1', quantity: 3 } }),
    ).toBeNull();
  });

  // A provider that answers 5 for a 3 would otherwise be asked forever.
  it('answers nothing when the session answered another quantity than the one sent', () => {
    expect(
      follow({
        configuration: at(5),
        followed: { configurationId: 'session-1', quantity: 3 },
      }),
    ).toBeNull();
  });

  it('answers a quantity sent before once the line moves to another', () => {
    expect(
      follow({
        lineQuantity: 4,
        followed: { configurationId: 'session-1', quantity: 3 },
      }),
    ).toBe(4);
  });

  it('answers a quantity sent to another session', () => {
    expect(
      follow({ followed: { configurationId: 'session-0', quantity: 3 } }),
    ).toBe(3);
  });
});

describe('the line behind the session', () => {
  const atOne = () => ({
    ...state({ configuration: { ...makeValidConfiguration(), quantity: 1 } }),
    skuId: 1652,
  });

  for (const [name, can] of [
    ['canCommit', canCommit],
    ['canPress', canPress],
  ] as const) {
    describe(name, () => {
      it('refuses while the session is at another quantity than the line', () => {
        expect(can({ ...atOne(), busy: false, lineQuantity: 3 })).toBe(false);
        expect(can({ ...atOne(), busy: true, lineQuantity: 3 })).toBe(false);
      });

      it('allows at the line’s quantity, or with no line known', () => {
        expect(can({ ...atOne(), busy: false, lineQuantity: 1 })).toBe(true);
        expect(can({ ...atOne(), busy: false, lineQuantity: null })).toBe(true);
        expect(can({ ...atOne(), busy: false })).toBe(true);
      });

      it('refuses with no document, whatever is in flight', () => {
        expect(
          can({
            ...state({ configuration: null }),
            busy: true,
            skuId: 1652,
            lineQuantity: 3,
          }),
        ).toBe(false);
      });

      it('refuses while the cart is changing the line', () => {
        expect(
          can({ ...atOne(), busy: false, lineQuantity: 1, linePending: true }),
        ).toBe(false);
      });
    });
  }
});
