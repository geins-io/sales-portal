/**
 * A Geins call against a real socket that accepts and never answers: the
 * shape of the 300 s stalls. The call must fail at the portal's limit as an
 * ordinary upstream error, and the socket must be closed, not left waiting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { H3Error } from 'h3';
import { CartError, GeinsCore } from '@geins/core';
import { GeinsOMS } from '@geins/oms';
import { RuntimeContext } from '@geins/types';
import { wrapServiceCall } from '../../server/utils/errors';

const { mockLoggerError, mockCaptureException } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockCaptureException: vi.fn(),
}));
vi.mock('../../server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));
vi.mock('@sentry/nuxt', () => ({ captureException: mockCaptureException }));

const { GEINS_REQUEST_TIMEOUT_MS, geinsRequestConfig } =
  await import('../../server/utils/outbound-timeouts');

const CART_ID = '00000000-0000-4000-8000-000000000000';

/** Accepts, reads the request, never answers; says when the client lets go. */
async function stallingServer() {
  let connected!: () => void;
  let closed!: () => void;
  const connection = new Promise<void>((resolve) => (connected = resolve));
  const release = new Promise<void>((resolve) => (closed = resolve));
  const server = net.createServer((socket) => {
    socket.resume();
    socket.on('close', closed);
    connected();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/graphql`,
    connection,
    release,
    server,
  };
}

function omsAt(apiUrl: string) {
  const core = new GeinsCore({
    apiKey: 'test-key',
    accountName: 'acme',
    channel: '1',
    tld: 'se',
    locale: 'sv-SE',
    market: 'se',
    environment: 'prod',
    apiUrl,
    requestConfig: geinsRequestConfig({
      accountName: 'acme',
      channel: '1',
      tld: 'se',
    }),
  });
  return new GeinsOMS(core, {
    omsSettings: { context: RuntimeContext.SERVER },
  });
}

describe('a Geins call that never answers', () => {
  let stall: Awaited<ReturnType<typeof stallingServer>>;

  beforeEach(async () => {
    mockLoggerError.mockClear();
    mockCaptureException.mockClear();
    stall = await stallingServer();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await new Promise<void>((resolve) => stall.server.close(() => resolve()));
  });

  it('fails at the limit as an upstream error, reports the timeout and closes the socket', async () => {
    const read = wrapServiceCall(
      () => omsAt(stall.url).cart.get(CART_ID, false),
      'cart',
      CartError,
    );
    const settled = vi.fn();
    read.then(settled, settled);
    await stall.connection;

    await vi.advanceTimersByTimeAsync(GEINS_REQUEST_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    const failure = await read.catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(H3Error);
    expect((failure as H3Error).statusCode).toBe(502);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('[geins] request timed out'),
      expect.objectContaining({ code: 'REQUEST_TIMEOUT' }),
      expect.objectContaining({ tenantId: 'acme', timeoutMs: 20_000 }),
    );
    expect(mockCaptureException).toHaveBeenCalledOnce();
    await stall.release;
  });

  it('still waits as long as a call asks for itself', async () => {
    const core = new GeinsCore({
      apiKey: 'test-key',
      accountName: 'acme',
      channel: '1',
      tld: 'se',
      locale: 'sv-SE',
      market: 'se',
      environment: 'prod',
      apiUrl: stall.url,
      requestConfig: geinsRequestConfig({
        accountName: 'acme',
        channel: '1',
        tld: 'se',
      }),
    });
    const settled = vi.fn();
    const call = core.graphql.query({
      queryAsString: 'query { __typename }',
      requestOptions: { context: { timeoutMs: 45_000 } },
    });
    call.then(settled, settled);
    await stall.connection;

    await vi.advanceTimersByTimeAsync(GEINS_REQUEST_TIMEOUT_MS);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(45_000 - GEINS_REQUEST_TIMEOUT_MS);
    await call.catch(() => undefined);
    expect(settled).toHaveBeenCalledOnce();
    await stall.release;
  });
});
