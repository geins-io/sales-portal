import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Configuration } from '../../../../../shared/types/configurator';
import {
  CTX,
  backend,
  bodyReads,
  headersOf,
  lifecycleCases,
  makeEvent,
  QUOTE_REQUESTS_ON,
  quoteRequestCases,
  resetHarness,
  withTenantFeatures,
  type RouteHandler,
} from './harness';
import { createAppError, ErrorCode } from '../../../../../server/utils/errors';

const getQuoteLineChoices = vi.fn();
vi.mock('../../../../../server/services/quotes', () => ({
  getQuoteLineChoices: (...args: unknown[]) => getQuoteLineChoices(...args),
}));

const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
const BODY = { productId: '1358', quoteId: QUOTE_ID, lineId: 'line-1' };
const CREATED = {
  configurationId: 'fresh-1',
  isValid: false,
  sections: [],
} as Partial<Configuration> as Configuration;

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
    withoutTenant?: boolean;
    body?: unknown;
  } = {},
) {
  return makeEvent({ body: BODY, ...init });
}

describe('POST /api/configurations/from-quote', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    withTenantFeatures(QUOTE_REQUESTS_ON);
    getQuoteLineChoices
      .mockReset()
      .mockResolvedValue({ productId: 1358, quantity: 2, choices: null });
    handler = (
      await import('../../../../../server/api/configurations/from-quote.post')
    ).default;
  });

  it("replays the draft line into a new session at the line's amount", async () => {
    backend.create.mockResolvedValue(CREATED);
    getQuoteLineChoices.mockResolvedValue({
      productId: 1358,
      quantity: 2,
      choices: { variables: [], options: [] },
    });
    const event = validEvent();

    const result = await handler(event);

    expect(getQuoteLineChoices).toHaveBeenCalledWith(QUOTE_ID, 'line-1', event);
    expect(backend.create).toHaveBeenCalledWith(
      { productId: '1358', quantity: 2 },
      CTX,
    );
    expect(result).toEqual({ configuration: CREATED, replayed: true });
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it("answers a session on the defaults at the line's amount for a line with nothing to replay", async () => {
    backend.create.mockResolvedValue(CREATED);

    await expect(handler(validEvent())).resolves.toEqual({
      configuration: CREATED,
      replayed: false,
    });
    expect(backend.create).toHaveBeenCalledWith(
      { productId: '1358', quantity: 2 },
      CTX,
    );
    expect(backend.applyChanges).not.toHaveBeenCalled();
  });

  it("answers the read's own failure, creating no session, when the line is gone", async () => {
    getQuoteLineChoices.mockRejectedValue(
      createAppError(ErrorCode.QUOTE_LINE_GONE, 'gone'),
    );

    await expect(handler(validEvent())).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'QUOTE_LINE_GONE' },
    });
    expect(backend.create).not.toHaveBeenCalled();
  });

  it.each([
    ['no product id', { quoteId: QUOTE_ID, lineId: 'line-1' }],
    ['no quote id', { productId: '1358', lineId: 'line-1' }],
    [
      'a quote id that is not a GUID',
      { productId: '1358', quoteId: 'q-1', lineId: 'line-1' },
    ],
    ['no line id', { productId: '1358', quoteId: QUOTE_ID }],
    ['an empty line id', { productId: '1358', quoteId: QUOTE_ID, lineId: '' }],
  ])(
    'answers 400 for %s, reading and creating nothing',
    async (_case, body) => {
      await expect(handler(validEvent({ body }))).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(bodyReads).toHaveBeenCalled();
      expect(getQuoteLineChoices).not.toHaveBeenCalled();
      expect(backend.create).not.toHaveBeenCalled();
    },
  );

  quoteRequestCases({
    handler: () => handler,
    event: validEvent,
    draftCall: getQuoteLineChoices,
  });

  lifecycleCases({
    handler: () => handler,
    method: 'create',
    event: validEvent,
    operation: 'configurator.fromQuote',
    result: CREATED,
  });
});
