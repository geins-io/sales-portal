/**
 * The config's read of the channel's asset host, through the real SDK: a read
 * that never answers is cut at the limit and the config is served without the
 * host; a read that answers sets it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import type { H3Event } from 'h3';
import { GeinsCore } from '@geins/core';
import type { TenantConfig } from '#shared/types/tenant-config';
import { wrapServiceCall } from '../../server/utils/errors';

const { mockLoggerWarn, sdk } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  sdk: { core: undefined as unknown },
}));
vi.mock('../../server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}));
vi.mock('@sentry/nuxt', () => ({ captureException: vi.fn() }));
vi.mock('../../server/services/_sdk', () => ({
  getTenantSDK: async () => sdk,
}));
vi.stubGlobal('wrapServiceCall', wrapServiceCall);

const { getPublicConfig, ASSET_HOST_TIMEOUT_MS } =
  await import('../../server/services/tenant-config');

function coreAt(apiUrl: string) {
  return new GeinsCore({
    apiKey: 'test-key',
    accountName: 'acme',
    channel: '1',
    tld: 'se',
    locale: 'sv-SE',
    market: 'se',
    environment: 'prod',
    apiUrl,
  });
}

function eventFor(): H3Event {
  const config = {
    tenantId: 'acme',
    hostname: 'acme.example.test',
    geinsSettings: {
      apiKey: 'test-key',
      accountName: 'acme',
      channel: '1',
      tld: 'se',
    },
  } as unknown as TenantConfig;
  return {
    context: {
      tenant: { hostname: 'acme.example.test', tenantId: 'acme', config },
    },
  } as unknown as H3Event;
}

describe("the config's asset host read", () => {
  const closers: Array<() => Promise<void>> = [];

  beforeEach(() => {
    mockLoggerWarn.mockClear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    for (const close of closers.splice(0)) await close();
  });

  it('serves the config without the host when the read never answers, and lets the socket go', async () => {
    let connected!: () => void;
    let released!: () => void;
    const connection = new Promise<void>((resolve) => (connected = resolve));
    const release = new Promise<void>((resolve) => (released = resolve));
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => {
      sockets.push(socket);
      socket.resume();
      socket.on('close', released);
      connected();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    closers.push(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    const { port } = server.address() as AddressInfo;
    sdk.core = coreAt(`http://127.0.0.1:${port}/graphql`);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const config = getPublicConfig(eventFor());
    const settled = vi.fn();
    config.then(settled, settled);
    await connection;

    await vi.advanceTimersByTimeAsync(ASSET_HOST_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    const pub = await config;

    expect(ASSET_HOST_TIMEOUT_MS).toBe(3_000);
    expect(pub?.tenantId).toBe('acme');
    expect(pub).not.toHaveProperty('assetBaseUrl');
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    await release;
  });

  it('sets the host when the read answers', async () => {
    let body = '';
    const server = http.createServer((request, response) => {
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        response.setHeader('Content-Type', 'application/json');
        response.end(
          JSON.stringify({
            data: {
              channel: {
                assetHost: 'https://cdn.example.test/acme',
                markets: [],
              },
            },
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    closers.push(
      () => new Promise<void>((resolve) => server.close(() => resolve())),
    );
    const { port } = server.address() as AddressInfo;
    sdk.core = coreAt(`http://127.0.0.1:${port}/graphql`);

    const pub = await getPublicConfig(eventFor());

    expect(pub?.assetBaseUrl).toBe('https://cdn.example.test/acme');
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(JSON.parse(body).variables).toEqual({ channelId: '1|se' });
  });
});
