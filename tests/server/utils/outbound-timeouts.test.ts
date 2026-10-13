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
  CMS_READ_TIMEOUT_MS,
  GEINS_REQUEST_TIMEOUT_MS,
  TENANT_LOOKUP_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
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

  it("reports a timeout at a call's own limit too", () => {
    const onError = geinsRequestConfig(TENANT).interceptors?.onError;
    onError?.({
      ...errorContext(Object.assign(timedOut(), { timeoutMs: 3_000 })),
      operationName: 'cmsPages',
    });

    expect(mockLoggerError).toHaveBeenCalledOnce();
    expect(mockLoggerError.mock.calls[0]![2]).toMatchObject({
      operationName: 'cmsPages',
      timeoutMs: 3_000,
    });
    expect(mockCaptureException).toHaveBeenCalledOnce();
  });

  it.each(['getConfiguredCartLines', 'getConfiguredOrderLineChoices'])(
    "reports nothing for the configurator's line read %s, which answers without its lines by design",
    (operationName) => {
      const onError = geinsRequestConfig(TENANT).interceptors?.onError;
      onError?.({
        ...errorContext(Object.assign(timedOut(), { timeoutMs: 2_000 })),
        operationName,
      });

      expect(mockLoggerError).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    },
  );

  it('keeps a write unbounded by us and a CMS read short', () => {
    expect(WRITE_TIMEOUT_MS).toBe(300_000);
    expect(CMS_READ_TIMEOUT_MS).toBe(3_000);
  });

  it('reports nothing for any other failed call', () => {
    for (const error of [
      Object.assign(new Error('Too many requests'), {
        code: 'RATE_LIMITED',
      }),
      new Error('fetch failed'),
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
      Object.assign(new Error('fetch failed'), {
        code: 'NETWORK_ERROR',
        timeoutMs: 20_000,
      }),
    ]) {
      report(error);
    }

    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
