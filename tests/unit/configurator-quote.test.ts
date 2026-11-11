import { describe, it, expect } from 'vitest';
import {
  quoteLineHref,
  quoteLineTarget,
  quoteFace,
  withoutQuoteLine,
} from '../../app/utils/configurator-quote';

const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
const LINE_ID = '4e8f8c0d-10f0-4c07-a7a4-d0a21c77da11';

describe('quoteLineHref', () => {
  it('puts the draft and its line on the product path, as ids only', () => {
    expect(
      quoteLineHref('/se/sv/p/digging-bucket', {
        quoteId: QUOTE_ID,
        lineId: LINE_ID,
      }),
    ).toBe(`/se/sv/p/digging-bucket?quote=${QUOTE_ID}&quoteLine=${LINE_ID}`);
  });
});

describe('quoteLineTarget', () => {
  it('names the draft line the query points at', () => {
    expect(quoteLineTarget({ quote: QUOTE_ID, quoteLine: LINE_ID })).toEqual({
      line: { quoteId: QUOTE_ID, lineId: LINE_ID },
      stale: false,
    });
  });

  it('names nothing on an ordinary product page, or one editing a cart line or replaying an order', () => {
    expect(quoteLineTarget({})).toEqual({ line: null, stale: false });
    expect(quoteLineTarget({ cart: 'cart-1', line: 'item-1' })).toEqual({
      line: null,
      stale: false,
    });
    expect(quoteLineTarget({ order: QUOTE_ID, row: '0' })).toEqual({
      line: null,
      stale: false,
    });
  });

  it.each([
    ['a draft without a line', { quote: QUOTE_ID }],
    ['a line without a draft', { quoteLine: LINE_ID }],
    ['a draft id that is not a GUID', { quote: 'q-1', quoteLine: LINE_ID }],
    [
      'a GUID with something after it',
      { quote: `${QUOTE_ID}x`, quoteLine: LINE_ID },
    ],
    ['an empty line', { quote: QUOTE_ID, quoteLine: '' }],
    [
      'a GUID with something before it',
      { quote: `x${QUOTE_ID}`, quoteLine: LINE_ID },
    ],
    ['repeated ids', { quote: [QUOTE_ID, QUOTE_ID], quoteLine: LINE_ID }],
    ['a draft id in a list', { quote: [QUOTE_ID], quoteLine: LINE_ID }],
    ['a line id in a list', { quote: QUOTE_ID, quoteLine: [LINE_ID] }],
  ])('calls %s stale', (_case, query) => {
    expect(quoteLineTarget(query)).toEqual({ line: null, stale: true });
  });
});

describe('withoutQuoteLine', () => {
  it('drops the draft and its line, and keeps the rest', () => {
    expect(
      withoutQuoteLine({ quote: QUOTE_ID, quoteLine: LINE_ID, tab: 'a' }),
    ).toEqual({ tab: 'a' });
  });
});

describe('quoteFace', () => {
  const GONE = { message: 'x', status: 404, code: 'QUOTE_LINE_GONE' };
  const DOWN = { message: 'x', status: 502 };
  const state = (over: Partial<Parameters<typeof quoteFace>[0]> = {}) => ({
    draft: true,
    notice: null,
    stage: 'error' as const,
    lastAction: 'start' as const,
    error: DOWN,
    ...over,
  });

  it('is none outside a draft line, whatever else holds', () => {
    expect(quoteFace(state({ draft: false }))).toBeNull();
    expect(quoteFace(state({ draft: false, notice: 'line_gone' }))).toBeNull();
  });

  it.each(['form', 'loading', 'expired', 'committed'] as const)(
    'is none while the page is on its %s face',
    (stage) => {
      expect(quoteFace(state({ stage }))).toBeNull();
    },
  );

  it.each([
    ['at the open, with no session', 'loading', 'start', null],
    ['at the save', 'error', 'commit', GONE],
  ] as const)(
    'says the line is gone %s, with only the way back',
    (_case, stage, lastAction, error) => {
      expect(
        quoteFace(state({ notice: 'line_gone', stage, lastAction, error })),
      ).toEqual({
        message: 'configurator.quote.line_gone',
        retry: null,
        leave: 'configurator.quote.back',
      });
    },
  );

  it('says the line could not be opened, with a retry of the open and the way back', () => {
    expect(quoteFace(state())).toEqual({
      message: 'configurator.quote.open_failed',
      retry: 'open',
      leave: 'configurator.quote.back',
    });
  });

  it('reads an open that failed without saying why as one worth another try', () => {
    expect(quoteFace(state({ error: null }))?.retry).toBe('open');
  });

  it('offers no retry for a product that cannot be configured now', () => {
    expect(
      quoteFace(
        state({
          error: {
            message: 'x',
            status: 503,
            code: 'CONFIGURATOR_NOT_AVAILABLE',
          },
        }),
      ),
    ).toEqual({
      message: 'configurator.not_available',
      retry: null,
      leave: 'configurator.quote.back',
    });
  });

  it('says the line could not be updated, with a retry of the save and a way out of the edit', () => {
    expect(quoteFace(state({ lastAction: 'commit' }))).toEqual({
      message: 'configurator.quote.update_failed',
      retry: 'save',
      leave: 'configurator.edit.cancel',
    });
  });

  it('reads a save that failed as one whatever its code', () => {
    expect(
      quoteFace(
        state({
          lastAction: 'commit',
          error: {
            message: 'x',
            status: 503,
            code: 'CONFIGURATOR_NOT_AVAILABLE',
          },
        }),
      )?.message,
    ).toBe('configurator.quote.update_failed');
  });

  it('is not gone for the notice of choices that did not land', () => {
    expect(
      quoteFace(state({ notice: 'not_reopenable', stage: 'form' })),
    ).toBeNull();
  });
});
