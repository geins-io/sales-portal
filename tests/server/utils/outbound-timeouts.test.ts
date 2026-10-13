import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GeinsErrorContext } from '@geins/types';

const { mockLoggerError, mockCaptureException } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockCaptureException: vi.fn(),
}));
vi.mock('../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
}));
vi.mock('@sentry/nuxt', () => ({ captureException: mockCaptureException }));

const {
  GEINS_REQUEST_TIMEOUT_MS,
  TENANT_LOOKUP_TIMEOUT_MS,
  geinsRequestConfig,
} = await import('../../../server/utils/outbound-timeouts');

const TENANT = { accountName: 'acme', channel: '1', tld: 'se' };

function timedOut(): Error {
  return Object.assign(new Error('Request r-1 timed out after 20000ms'), {
    name: 'TimeoutError',
    code: 'REQUEST_TIMEOUT',
    requestId: 'r-1',
    timeoutMs: 20_000,
  });
}

function errorContext(error: Error): GeinsErrorContext {
  return {
    requestId: 'r-1',
    operationName: 'getMenu',
    durationMs: 20_003,
    error,
    retryCount: 0,
  };
}

function report(error: Error) {
  const onError = geinsRequestConfig(TENANT).interceptors?.onError;
  if (!onError) throw new Error('no onError interceptor');
  onError(errorContext(error));
}

describe('outbound timeouts', () => {
  beforeEach(() => {
    mockLoggerError.mockClear();
    mockCaptureException.mockClear();
  });

  it('bounds every Geins call and every tenant lookup at 20 s', () => {
    expect(GEINS_REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(TENANT_LOOKUP_TIMEOUT_MS).toBe(20_000);
    expect(geinsRequestConfig(TENANT).timeoutMs).toBe(GEINS_REQUEST_TIMEOUT_MS);
  });

  it('sets no retry: a timed-out call is not sent again', () => {
    expect(geinsRequestConfig(TENANT).retry).toBeUndefined();
  });

  describe('a Geins call that timed out', () => {
    it('is logged as an error naming the operation, the tenant, the request id and the limit', () => {
      const error = timedOut();
      report(error);

      expect(mockLoggerError).toHaveBeenCalledOnce();
      const [message, logged, context] = mockLoggerError.mock.calls[0]!;
      expect(message).toBe('[geins] request timed out: getMenu');
      expect(logged).toBe(error);
      expect(context).toEqual({
        tenantId: 'acme',
        channel: '1|se',
        operationName: 'getMenu',
        geinsRequestId: 'r-1',
        timeoutMs: 20_000,
        duration: 20_003,
      });
    });

    it('is reported to Sentry, tagged with the operation and the tenant', () => {
      const error = timedOut();
      report(error);

      expect(mockCaptureException).toHaveBeenCalledOnce();
      expect(mockCaptureException).toHaveBeenCalledWith(error, {
        tags: {
          'geins.operation': 'getMenu',
          'geins.account': 'acme',
        },
        extra: { geinsRequestId: 'r-1', timeoutMs: 20_000 },
      });
    });
  });

  it('reports nothing for any other failed call', () => {
    for (const error of [
      Object.assign(new Error('Too many requests'), {
        code: 'RATE_LIMITED',
      }),
      new Error('fetch failed'),
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
    ]) {
      report(error);
    }

    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
