import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommittedConfiguration } from '../../../../../shared/types/configurator';
import {
  CTX,
  backend,
  bodyReads,
  lifecycleCases,
  makeEvent,
  QUOTE_REQUESTS_ON,
  quoteRequestCases,
  resetHarness,
  withTenantFeatures,
  type RouteHandler,
} from './harness';

const replaceConfiguredLine = vi.fn();
vi.mock('../../../../../server/services/quotes', () => ({
  replaceConfiguredLine: (...args: unknown[]) => replaceConfiguredLine(...args),
}));

const rateLimitCheck = vi.fn();
vi.mock('../../../../../server/utils/rate-limiter', () => ({
  quoteDraftRateLimiter: {
    check: (...args: unknown[]) => rateLimitCheck(...args),
  },
  getClientIp: () => '203.0.113.7',
}));

const SESSION_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
const BODY = { productId: '1358', quoteId: QUOTE_ID, lineId: 'line-1' };
const COMMITTED = {
  committedConfigurationId: '9c5b94b1-35ad-49bb-b118-8e8fc24abf80',
  configurationId: SESSION_ID,
  quantity: 2,
} as Partial<CommittedConfiguration> as CommittedConfiguration;
const QUOTE = { id: QUOTE_ID, lineItems: [] };

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
    withoutTenant?: boolean;
    body?: unknown;
  } = {},
) {
  return makeEvent({ id: SESSION_ID, body: BODY, ...init });
}

describe('POST /api/configurations/:id/quote-line', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    withTenantFeatures(QUOTE_REQUESTS_ON);
    rateLimitCheck.mockReset().mockResolvedValue({ allowed: true });
    // The service runs the commit it is handed, as the real one does once the
    // line has been checked.
    replaceConfiguredLine
      .mockReset()
      .mockImplementation(
        async (
          _quote: string,
          _line: string,
          _product: string,
          commit: () => Promise<unknown>,
        ) => {
          await commit();
          return QUOTE;
        },
      );
    handler = (
      await import('../../../../../server/api/configurations/[id]/quote-line.post')
    ).default;
  });

  it('commits the session onto the named draft line and answers the draft', async () => {
    backend.commit.mockResolvedValue(COMMITTED);
    const event = validEvent();

    await expect(handler(event)).resolves.toEqual({ quote: QUOTE });

    expect(replaceConfiguredLine).toHaveBeenCalledWith(
      QUOTE_ID,
      'line-1',
      '1358',
      expect.any(Function),
      event,
    );
    expect(backend.commit).toHaveBeenCalledWith(SESSION_ID, CTX);
  });

  it('commits nothing when the service refuses the line', async () => {
    replaceConfiguredLine.mockReset().mockRejectedValue(new Error('gone'));

    await expect(handler(validEvent())).rejects.toThrow();
    expect(backend.commit).not.toHaveBeenCalled();
  });

  it('answers 429 when the draft has changed too often, reading nothing', async () => {
    rateLimitCheck.mockResolvedValue({ allowed: false });

    await expect(handler(validEvent())).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(bodyReads).not.toHaveBeenCalled();
    expect(replaceConfiguredLine).not.toHaveBeenCalled();
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
  ])('answers 400 for %s, committing nothing', async (_case, body) => {
    await expect(handler(validEvent({ body }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(replaceConfiguredLine).not.toHaveBeenCalled();
    expect(backend.commit).not.toHaveBeenCalled();
  });

  quoteRequestCases({
    handler: () => handler,
    event: validEvent,
    draftCall: replaceConfiguredLine,
  });

  lifecycleCases({
    handler: () => handler,
    method: 'commit',
    event: validEvent,
    operation: 'configurator.replaceQuoteLine',
    result: COMMITTED,
  });
});
