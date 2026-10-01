import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { H3Error } from 'h3';
import {
  AuthError,
  CartError,
  CheckoutError,
  GeinsCore,
  GeinsError,
  GeinsErrorCode,
  OrderError,
  TimeoutError,
  TokenExpiredError,
} from '@geins/core';
import { GeinsOMS } from '@geins/oms';
import { RuntimeContext } from '@geins/types';
import { ErrorCode, wrapServiceCall } from '../../server/utils/errors';
import { logger } from '../../server/utils/logger';

vi.mock('../../server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Response bodies the Geins merchant API returned on 2026-10-01, all HTTP 200.
const INVALID_PAYMENT_TYPE = {
  errors: [
    {
      message:
        "Variable '$paymentType' is invalid. Unable to convert 'invoice' to 'PaymentType'",
      locations: [{ line: 1, column: 37 }],
      extensions: {
        code: 'INVALID_VALUE',
        codes: ['INVALID_VALUE', 'INVALID_OPERATION'],
        number: '5.8',
      },
    },
  ],
};
const INVALID_PUBLIC_ORDER_ID = {
  errors: [
    {
      message:
        "Variable '$publicOrderId' is invalid. Unable to convert 'not-a-guid' to 'Guid'",
      locations: [{ line: 1, column: 22 }],
      extensions: {
        code: 'INVALID_VALUE',
        codes: ['INVALID_VALUE', 'FORMAT'],
        number: '5.8',
      },
    },
  ],
};
const INVALID_API_KEY = {
  errors: [
    {
      message: 'Invalid API key',
      locations: [{ line: 2, column: 3 }],
      path: ['checkout'],
    },
  ],
  data: { checkout: null },
};

const ORDER_ID = '00000000-0000-4000-8000-000000000000';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** The OMS the way `createTenantSDK` builds it, talking to a stubbed fetch. */
function omsAnswering(fetchImpl: () => Promise<Response>): GeinsOMS {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  const core = new GeinsCore({
    apiKey: 'test-key',
    accountName: 'test-account',
    channel: '1',
    tld: 'se',
    locale: 'sv-SE',
    market: 'se',
    environment: 'prod',
  });
  return new GeinsOMS(core, {
    omsSettings: { context: RuntimeContext.SERVER },
  });
}

function summaryVia(oms: GeinsOMS) {
  return wrapServiceCall(
    () => oms.checkout.summary({ orderId: ORDER_ID, paymentMethod: 'invoice' }),
    'checkout',
    CheckoutError,
  );
}

async function caught(promise: Promise<unknown>): Promise<H3Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof H3Error) return error;
    throw error;
  }
  throw new Error('expected the call to throw');
}

function rejecting(error: unknown) {
  return () => Promise.reject(error);
}

/** The details object the last `logger.<level>` call carried. */
function loggedDetails(level: 'warn' | 'error'): Record<string, unknown> {
  const calls = vi.mocked(logger[level]).mock.calls;
  const last = calls.at(-1);
  if (!last) throw new Error(`logger.${level} was not called`);
  const details = level === 'error' ? last[2] : last[1];
  if (typeof details !== 'object' || details === null) {
    throw new TypeError(`logger.${level} details are ${typeof details}`);
  }
  return { ...details };
}

describe('wrapServiceCall with errors from the real Geins SDK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('the SDK build cannot be matched by class', () => {
    it('keeps instanceof false, which is why classification reads name and code', () => {
      const error = new CheckoutError('Error getting summary');

      expect(error instanceof CheckoutError).toBe(false);
      expect(error.name).toBe('CheckoutError');
      expect(error.code).toBe(GeinsErrorCode.CHECKOUT_FAILED);
    });
  });

  describe('a failed summary stays 502 and logs what failed', () => {
    it('logs the GraphQL validation error behind CHECKOUT_FAILED', async () => {
      const error = await caught(
        summaryVia(omsAnswering(async () => json(INVALID_PAYMENT_TYPE))),
      );

      expect(error.statusCode).toBe(502);
      expect(logger.error).toHaveBeenCalledWith(
        'Server error: Error communicating with checkout',
        undefined,
        expect.anything(),
      );
      expect(loggedDetails('error')).toMatchObject({
        service: 'checkout',
        sdkError: {
          name: 'CheckoutError',
          code: 'CHECKOUT_FAILED',
          message: 'Error getting summary',
          cause: {
            name: 'ApolloError',
            graphQLErrors: [
              {
                message:
                  "Variable '$paymentType' is invalid. Unable to convert 'invoice' to 'PaymentType'",
                code: 'INVALID_VALUE',
              },
            ],
          },
        },
      });
    });

    it('logs the GraphQL error path when Geins rejects the API key', async () => {
      const error = await caught(
        summaryVia(omsAnswering(async () => json(INVALID_API_KEY))),
      );

      expect(error.statusCode).toBe(502);
      expect(loggedDetails('error')).toMatchObject({
        sdkError: {
          code: 'CHECKOUT_FAILED',
          cause: {
            graphQLErrors: [{ message: 'Invalid API key', path: 'checkout' }],
          },
        },
      });
    });

    it('logs the network error when the connection fails', async () => {
      const error = await caught(
        summaryVia(
          omsAnswering(() => Promise.reject(new TypeError('fetch failed'))),
        ),
      );

      expect(error.statusCode).toBe(502);
      expect(loggedDetails('error')).toMatchObject({
        sdkError: {
          code: 'CHECKOUT_FAILED',
          cause: {
            name: 'ApolloError',
            networkError: { name: 'TypeError', message: 'fetch failed' },
          },
        },
      });
    });

    it('logs the upstream status when Geins answers 503', async () => {
      const error = await caught(
        summaryVia(
          omsAnswering(
            async () =>
              new Response('<html>Service Unavailable</html>', {
                status: 503,
                headers: { 'content-type': 'text/html' },
              }),
          ),
        ),
      );

      expect(error.statusCode).toBe(502);
      expect(loggedDetails('error')).toMatchObject({
        sdkError: {
          cause: { networkError: { name: 'ServerError', statusCode: 503 } },
        },
      });
    });

    it('passes the SDK error on as the cause, so Sentry links it', async () => {
      const error = await caught(
        summaryVia(omsAnswering(async () => json(INVALID_PAYMENT_TYPE))),
      );

      expect(error.cause).toMatchObject({
        name: 'CheckoutError',
        code: 'CHECKOUT_FAILED',
      });
    });

    it('keeps the production response body to the error code', async () => {
      const error = await caught(
        summaryVia(omsAnswering(async () => json(INVALID_PAYMENT_TYPE))),
      );

      expect(error.data).toEqual({ code: ErrorCode.EXTERNAL_API_ERROR });
    });
  });

  it('logs the cause of a failed order lookup', async () => {
    const oms = omsAnswering(async () => json(INVALID_PUBLIC_ORDER_ID));

    const error = await caught(
      wrapServiceCall(
        () => oms.order.get({ publicOrderId: 'not-a-guid' }),
        'order',
        OrderError,
      ),
    );

    expect(error.statusCode).toBe(502);
    expect(loggedDetails('error')).toMatchObject({
      sdkError: {
        name: 'OrderError',
        code: 'ORDER_FAILED',
        cause: { graphQLErrors: [{ code: 'INVALID_VALUE' }] },
      },
    });
  });

  it('keeps a missing cart at 502, because the SDK rewraps CART_NOT_FOUND', async () => {
    const oms = omsAnswering(async () => json({ data: { getCart: null } }));

    const error = await caught(
      wrapServiceCall(() => oms.cart.get(ORDER_ID), 'cart', CartError),
    );

    expect(error.statusCode).toBe(502);
    expect(loggedDetails('error')).toMatchObject({
      sdkError: {
        name: 'CartError',
        code: 'CART_OPERATION_FAILED',
        cause: { name: 'CartError', code: 'CART_NOT_FOUND' },
      },
    });
  });

  // No real SDK path reaches these codes in 0.10.4 (see the real-path test
  // above), so the errors are built by hand: this pins the mapping only.
  describe('the client-fault mapping, pinned with hand-built errors', () => {
    it('maps CART_NOT_FOUND to the site status', async () => {
      const error = await caught(
        wrapServiceCall(
          rejecting(
            new CartError('Cart not found', GeinsErrorCode.CART_NOT_FOUND),
          ),
          'cart',
          CartError,
        ),
      );

      expect(error.statusCode).toBe(400);
      expect(error.data).toEqual({ code: ErrorCode.BAD_REQUEST });
      expect(loggedDetails('warn')).toEqual({
        code: ErrorCode.BAD_REQUEST,
        service: 'cart',
        sdkError: {
          name: 'CartError',
          code: 'CART_NOT_FOUND',
          message: 'Cart not found',
        },
      });
    });

    it('maps AUTH_TOKEN_EXPIRED to the site status', async () => {
      const error = await caught(
        wrapServiceCall(
          rejecting(new TokenExpiredError()),
          'auth',
          AuthError,
          ErrorCode.UNAUTHORIZED,
        ),
      );

      expect(error.statusCode).toBe(401);
    });

    it('maps AUTH_NOT_AUTHENTICATED to the site status', async () => {
      const error = await caught(
        wrapServiceCall(
          rejecting(
            new AuthError(
              'Not authenticated',
              GeinsErrorCode.AUTH_NOT_AUTHENTICATED,
            ),
          ),
          'user',
          AuthError,
          ErrorCode.UNAUTHORIZED,
        ),
      );

      expect(error.statusCode).toBe(401);
    });

    it('keeps 502 at a site that names no known error', async () => {
      const error = await caught(
        wrapServiceCall(
          rejecting(
            new CartError('Cart not found', GeinsErrorCode.CART_NOT_FOUND),
          ),
          'cart',
        ),
      );

      expect(error.statusCode).toBe(502);
    });
  });

  describe('every other GeinsErrorCode stays 502', () => {
    const clientFaults: string[] = [
      GeinsErrorCode.CART_NOT_FOUND,
      GeinsErrorCode.AUTH_TOKEN_EXPIRED,
      GeinsErrorCode.AUTH_NOT_AUTHENTICATED,
    ];
    const upstream = Object.values(GeinsErrorCode).filter(
      (code) => !clientFaults.includes(code),
    );

    it.each(upstream)('%s', async (code) => {
      const error = await caught(
        wrapServiceCall(
          rejecting(new GeinsError('failed', code)),
          'checkout',
          CheckoutError,
        ),
      );

      expect(error.statusCode).toBe(502);
      expect(loggedDetails('error')).toMatchObject({ sdkError: { code } });
    });

    it('keeps AUTH_FAILED at 502, since the SDK also uses it for an auth endpoint 5xx', async () => {
      const error = await caught(
        wrapServiceCall(
          rejecting(
            new AuthError('Failed to fetch user token: Internal Server Error'),
          ),
          'auth',
          AuthError,
          ErrorCode.UNAUTHORIZED,
        ),
      );

      expect(error.statusCode).toBe(502);
    });
  });

  describe('what the log carries', () => {
    it('includes the request id of a network error', async () => {
      await caught(
        wrapServiceCall(
          rejecting(new TimeoutError('req-1', 5000)),
          'checkout',
          CheckoutError,
        ),
      );

      expect(loggedDetails('error')).toMatchObject({
        sdkError: {
          name: 'TimeoutError',
          code: 'REQUEST_TIMEOUT',
          requestId: 'req-1',
        },
      });
    });

    it('reads a GRAPHQL_ERROR whose cause is the raw errors array', async () => {
      await caught(
        wrapServiceCall(
          rejecting(
            new GeinsError('GraphQL errors', GeinsErrorCode.GRAPHQL_ERROR, [
              { message: 'boom', extensions: { code: 'X' }, path: ['a', 0] },
            ]),
          ),
          'order',
          OrderError,
        ),
      );

      expect(loggedDetails('error')).toMatchObject({
        sdkError: {
          cause: {
            graphQLErrors: [{ message: 'boom', code: 'X', path: 'a.0' }],
          },
        },
      });
    });

    it('describes a non-object cause by its text', async () => {
      await caught(
        wrapServiceCall(
          rejecting(
            new GeinsError('failed', GeinsErrorCode.PARSE_ERROR, 'bad json'),
          ),
          'checkout',
        ),
      );

      expect(loggedDetails('error')).toMatchObject({
        sdkError: { cause: { message: 'bad json' } },
      });
    });

    it('caps messages and the number of GraphQL errors', async () => {
      const errors = Array.from({ length: 8 }, (_, i) => ({
        message: `${i}`.repeat(400),
      }));

      await caught(
        wrapServiceCall(
          rejecting(
            new GeinsError(
              'x'.repeat(400),
              GeinsErrorCode.GRAPHQL_ERROR,
              errors,
            ),
          ),
          'checkout',
        ),
      );

      const sdkError = loggedDetails('error').sdkError;
      expect(sdkError).toMatchObject({ message: 'x'.repeat(300) });
      expect(sdkError).toMatchObject({
        cause: { graphQLErrors: expect.any(Array) },
      });
      const logged = JSON.stringify(sdkError);
      expect(logged).toContain('4'.repeat(300));
      expect(logged).not.toContain('4'.repeat(301));
      expect(logged).not.toContain('5'.repeat(300));
    });

    it('logs a thrown non-error value without failing', async () => {
      const error = await caught(
        wrapServiceCall(rejecting('boom'), 'checkout', CheckoutError),
      );

      expect(error.statusCode).toBe(502);
      expect(loggedDetails('error')).toMatchObject({
        sdkError: { message: 'boom' },
      });
    });

    it('caps a thrown non-error value', async () => {
      await caught(
        wrapServiceCall(rejecting('b'.repeat(400)), 'checkout', CheckoutError),
      );

      expect(loggedDetails('error').sdkError).toEqual({
        message: 'b'.repeat(300),
      });
    });

    it('logs a thrown null without failing', async () => {
      const error = await caught(
        wrapServiceCall(rejecting(null), 'checkout', CheckoutError),
      );

      expect(error.statusCode).toBe(502);
      expect(loggedDetails('error')).toMatchObject({
        sdkError: { message: 'null' },
      });
    });

    it('skips fields that are not strings and GraphQL errors that are not objects', async () => {
      await caught(
        wrapServiceCall(
          rejecting(
            Object.assign(new Error('failed'), {
              code: 404,
              cause: [null, 'text', { message: 7, extensions: null }],
            }),
          ),
          'checkout',
          CheckoutError,
        ),
      );

      expect(loggedDetails('error').sdkError).toEqual({
        name: 'Error',
        message: 'failed',
        cause: { graphQLErrors: [{}, {}, {}] },
      });
    });

    it('re-throws an H3Error untouched', async () => {
      const original = new H3Error('already handled');

      await expect(
        wrapServiceCall(rejecting(original), 'checkout', CheckoutError),
      ).rejects.toBe(original);
    });
  });
});
