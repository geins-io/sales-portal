/**
 * The storage check in `/api/health` proves the KV store with a write, read
 * and remove. It must not enumerate keys: Azure's probe hits the full check
 * on every interval, and on Redis an enumeration is a scan of the whole store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import type { H3Event } from 'h3';

const { runtimeConfigMock, storageMock, useStorageMock } = vi.hoisted(() => ({
  runtimeConfigMock: {
    current: {} as Record<string, unknown>,
  },
  storageMock: {
    setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
    getItem: vi.fn<(key: string) => Promise<unknown>>(),
    removeItem: vi.fn<(key: string) => Promise<void>>(),
    keys: vi.fn<() => Promise<string[]>>(),
  },
  useStorageMock: vi.fn<(base: string) => unknown>(),
}));

mockNuxtImport(
  'useRuntimeConfig',
  (original) => (event?: unknown) =>
    event === undefined ? original() : runtimeConfigMock.current,
);
mockNuxtImport('setResponseStatus', () => vi.fn());

interface StorageCheck {
  status: string;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

describe('GET /api/health storage check', () => {
  /** An event with no `context.logger`, which is what returns the details. */
  const event = { context: {}, _query: {} } as unknown as H3Event;

  async function storageCheck(): Promise<StorageCheck> {
    const module = await import('../../server/api/health.get');
    const handler = module.default as (
      event: H3Event,
    ) => Promise<{ checks: { storage: StorageCheck } }>;
    return (await handler(event)).checks.storage;
  }

  beforeEach(() => {
    vi.resetModules();
    runtimeConfigMock.current = {
      public: { appVersion: '1.0.0', commitSha: 'abc123', environment: 'test' },
      healthCheckSecret: '',
      storage: { driver: 'redis' },
    };
    let stored: string | null = null;
    storageMock.setItem.mockReset().mockImplementation(async (_key, value) => {
      stored = value;
    });
    storageMock.getItem.mockReset().mockImplementation(async () => stored);
    storageMock.removeItem.mockReset().mockResolvedValue();
    storageMock.keys.mockReset().mockResolvedValue(['a', 'b', 'c']);
    vi.stubGlobal(
      'defineEventHandler',
      (handler: (event: H3Event) => unknown) => handler,
    );
    vi.stubGlobal(
      'getQuery',
      (e: H3Event) =>
        (e as H3Event & { _query?: Record<string, string> })._query ?? {},
    );
    vi.stubGlobal('setResponseHeaders', vi.fn());
    useStorageMock.mockReset().mockReturnValue(storageMock);
    vi.stubGlobal('useStorage', useStorageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('proves the store with a write, read and remove of one key', async () => {
    const check = await storageCheck();

    expect(check.status).toBe('healthy');
    expect(storageMock.setItem).toHaveBeenCalledWith(
      '_health_check',
      expect.any(String),
    );
    expect(storageMock.getItem).toHaveBeenCalledWith('_health_check');
    expect(storageMock.removeItem).toHaveBeenCalledWith('_health_check');
    expect(check.latency).toEqual(expect.any(Number));
  });

  it('checks the kv mount', async () => {
    await storageCheck();

    expect(useStorageMock).toHaveBeenCalledWith('kv');
  });

  it('does not enumerate the store', async () => {
    await storageCheck();

    expect(storageMock.keys).not.toHaveBeenCalled();
  });

  it('reports only the driver, no key count or key list', async () => {
    const check = await storageCheck();

    expect(check.details).toEqual({ driver: 'redis' });
  });

  it('reports degraded when the read does not return the written value', async () => {
    storageMock.getItem.mockResolvedValue('something else');

    const check = await storageCheck();

    expect(check.status).toBe('degraded');
    expect(check.message).toBe('Storage read/write mismatch');
  });

  it('reports the fs driver when no storage is configured', async () => {
    delete runtimeConfigMock.current.storage;

    const check = await storageCheck();

    expect(check.details).toEqual({ driver: 'fs' });
  });

  it('reports degraded when the store throws', async () => {
    storageMock.setItem.mockRejectedValue(new Error('connection refused'));

    const check = await storageCheck();

    expect(check.status).toBe('degraded');
    expect(check.message).toBe('KV storage unavailable: connection refused');
    expect(check.details).toEqual({ driver: 'redis' });
  });
});
