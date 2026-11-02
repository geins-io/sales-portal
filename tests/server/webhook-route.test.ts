import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

import {
  processConfigRefresh,
  type WebhookRequest,
  type KvStorage,
  type CacheStorage,
} from '../../server/utils/webhook-handler';
import { MAX_WEBHOOK_BODY_SIZE } from '../../server/utils/webhook';
import { tenantConfigKey } from '../../server/utils/tenant';
import type { TenantConfig } from '#shared/types/tenant-config';

// clearNegativeCache mutates a module-level Map, so the only way to observe
// which hostnames were cleared is to watch the call itself.
const { clearNegativeCacheSpy } = vi.hoisted(() => ({
  clearNegativeCacheSpy: vi.fn(),
}));
vi.mock('../../server/utils/tenant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../server/utils/tenant')>()),
  clearNegativeCache: clearNegativeCacheSpy,
}));

// Mock useStorage for KV-backed rate limiter
const mockRateLimitStore = new Map<string, unknown>();
vi.stubGlobal('useStorage', () => ({
  getItem: async <T>(key: string): Promise<T | null> =>
    (mockRateLimitStore.get(key) as T) ?? null,
  setItem: async (key: string, value: unknown) => {
    mockRateLimitStore.set(key, value);
  },
  removeItem: async (key: string) => {
    mockRateLimitStore.delete(key);
  },
  getKeys: async (prefix: string) =>
    [...mockRateLimitStore.keys()].filter((k) => k.startsWith(prefix)),
}));

// Mock logger
vi.mock('../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SDK cache clearing
vi.mock('../../server/services/_sdk', () => ({
  clearSdkCache: vi.fn(),
}));

const hex = (key: string) => Buffer.from(key).toString('hex');

function signStripe(body: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${body}`;
  const hex = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${ts},v1=${hex}`;
}

function createMockKvStorage(overrides?: Partial<KvStorage>): {
  storage: KvStorage;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
} {
  const setItem = vi.fn();
  const removeItem = vi.fn();
  return {
    storage: {
      getItem: overrides?.getItem ?? (() => Promise.resolve(null)),
      setItem: overrides?.setItem ?? setItem,
      removeItem: overrides?.removeItem ?? removeItem,
    },
    setItem,
    removeItem,
  };
}

function createMockCacheStorage(): {
  storage: CacheStorage;
  removeItem: ReturnType<typeof vi.fn>;
} {
  const removeItem = vi.fn();
  return {
    storage: { removeItem },
    removeItem,
  };
}

function createRequest(overrides?: Partial<WebhookRequest>): WebhookRequest {
  const secret = 'test-secret';
  const body = JSON.stringify({ hostname: 'alpha.example' });
  const sig = signStripe(body, secret);

  return {
    clientIp: `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.1`,
    secrets: [secret],
    rawBody: body,
    signatureHeader: sig,
    webhookId: `wh_${crypto.randomUUID()}`,
    contentLength: Buffer.byteLength(body, 'utf-8'),
    ...overrides,
  };
}

describe('processConfigRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitStore.clear();
  });

  describe('open mode (no secret configured)', () => {
    it('accepts an unsigned request with valid body and invalidates the cache', async () => {
      const body = JSON.stringify({ hostname: 'alpha.example' });
      const request = createRequest({
        secrets: [],
        rawBody: body,
        contentLength: Buffer.byteLength(body, 'utf-8'),
        signatureHeader: undefined,
        webhookId: undefined,
      });
      const { storage: kv } = createMockKvStorage();
      const { storage: cache } = createMockCacheStorage();

      const result = await processConfigRefresh(request, kv, cache);

      expect(result).toEqual({ invalidated: true });
    });

    it('still rejects bodies missing hostname with 422', async () => {
      const body = JSON.stringify({ wrong: 'shape' });
      const request = createRequest({
        secrets: [],
        rawBody: body,
        contentLength: Buffer.byteLength(body, 'utf-8'),
        signatureHeader: undefined,
        webhookId: undefined,
      });
      const { storage: kv } = createMockKvStorage();
      const { storage: cache } = createMockCacheStorage();

      await expect(
        processConfigRefresh(request, kv, cache),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('still enforces the rate limiter so unauth callers cannot loop', async () => {
      const make = () => {
        const body = JSON.stringify({ hostname: 'alpha.example' });
        return createRequest({
          secrets: [],
          rawBody: body,
          contentLength: Buffer.byteLength(body, 'utf-8'),
          signatureHeader: undefined,
          webhookId: undefined,
          // Same IP so the rate limiter window matches.
          clientIp: '10.99.99.99',
        });
      };
      const { storage: kv } = createMockKvStorage();
      const { storage: cache } = createMockCacheStorage();

      // First 10 calls are allowed; 11th must trip the limiter (10/min).
      for (let i = 0; i < 10; i++) {
        await processConfigRefresh(make(), kv, cache);
      }
      await expect(
        processConfigRefresh(make(), kv, cache),
      ).rejects.toMatchObject({ statusCode: 429 });
    });
  });

  it('should return 413 when contentLength exceeds limit', async () => {
    const request = createRequest({ contentLength: MAX_WEBHOOK_BODY_SIZE + 1 });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it('should return 413 when actual rawBody exceeds limit', async () => {
    const largeBody = 'x'.repeat(MAX_WEBHOOK_BODY_SIZE + 1);
    const request = createRequest({
      rawBody: largeBody,
      contentLength: 100, // Lies about size — actual body check catches it
    });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it('should return 401 when body is missing', async () => {
    const request = createRequest({ rawBody: undefined });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('should return 401 when signature header is missing', async () => {
    const request = createRequest({ signatureHeader: undefined });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('should return 401 for a malformed signature header', async () => {
    const request = createRequest({ signatureHeader: 'sha256=badhex' });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('should return 401 for an invalid signature', async () => {
    const body = JSON.stringify({ hostname: 'test.com' });
    const ts = Math.floor(Date.now() / 1000);
    const request = createRequest({
      rawBody: body,
      signatureHeader: `t=${ts},v1=0000000000000000000000000000000000000000000000000000000000000000`,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('should return 401 for a stale timestamp', async () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ hostname: 'test.com' });
    const staleTs = Math.floor(Date.now() / 1000) - 400;
    const sig = signStripe(body, secret, staleTs);
    const request = createRequest({
      secrets: [secret],
      rawBody: body,
      signatureHeader: sig,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('should return 422 when hostname is missing', async () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ notHostname: 'test.com' });
    const sig = signStripe(body, secret);
    const request = createRequest({
      secrets: [secret],
      rawBody: body,
      signatureHeader: sig,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('should return 401 when webhook ID is missing', async () => {
    const request = createRequest({ webhookId: undefined });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('should return 409 for a duplicate webhook ID', async () => {
    const request = createRequest({ webhookId: 'wh_duplicate' });
    const { storage: kv } = createMockKvStorage({
      getItem: vi.fn().mockImplementation(async (key: string) => {
        if (key === 'webhook:processed:wh_duplicate') return true;
        return null;
      }),
    });
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('should invalidate all alias hostname mappings when config has aliases', async () => {
    const hostname = 'alpha.example';
    const secret = 'test-secret';
    const body = JSON.stringify({ hostname });
    const sig = signStripe(body, secret);
    const webhookId = 'wh_valid_123';

    const tenantConfig = {
      tenantId: 'alpha',
      hostname: 'alpha.example',
      aliases: ['alpha.localhost', 'alpha.sales-portal.geins.dev'],
      isActive: true,
    };

    const request = createRequest({
      secrets: [secret],
      rawBody: body,
      signatureHeader: sig,
      webhookId,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });

    const {
      storage: kv,
      removeItem: kvRemoveItem,
      setItem: kvSetItem,
    } = createMockKvStorage({
      getItem: vi.fn().mockImplementation(async (key: string) => {
        if (key === `tenant:id:${hostname}`) return 'alpha';
        if (key === 'tenant:config:alpha') return tenantConfig;
        return null;
      }),
    });
    const { storage: cache, removeItem: cacheRemoveItem } =
      createMockCacheStorage();

    const result = await processConfigRefresh(request, kv, cache);
    expect(result).toEqual({ invalidated: true });

    // Should remove all hostname → tenantId mappings
    expect(kvRemoveItem).toHaveBeenCalledWith('tenant:id:alpha.example');
    expect(kvRemoveItem).toHaveBeenCalledWith('tenant:id:alpha.localhost');
    expect(kvRemoveItem).toHaveBeenCalledWith(
      'tenant:id:alpha.sales-portal.geins.dev',
    );
    // Should remove config under tenantId
    expect(kvRemoveItem).toHaveBeenCalledWith('tenant:config:alpha');
    expect(cacheRemoveItem).toHaveBeenCalledWith(
      `nitro/handlers:_:${hex('tenant:config:alpha')}.json`,
    );
    expect(kvSetItem).toHaveBeenCalledWith(
      `webhook:processed:${webhookId}`,
      true,
    );
  });

  it('should use hostname as fallback when tenant ID is not in KV', async () => {
    const hostname = 'new-tenant.example.com';
    const secret = 'test-secret';
    const body = JSON.stringify({ hostname });
    const sig = signStripe(body, secret);

    const request = createRequest({
      secrets: [secret],
      rawBody: body,
      signatureHeader: sig,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });

    const { storage: kv, removeItem: kvRemoveItem } = createMockKvStorage();
    const { storage: cache, removeItem: cacheRemoveItem } =
      createMockCacheStorage();

    const result = await processConfigRefresh(request, kv, cache);
    expect(result).toEqual({ invalidated: true });

    expect(kvRemoveItem).toHaveBeenCalledWith(`tenant:id:${hostname}`);
    expect(kvRemoveItem).toHaveBeenCalledWith(`tenant:config:${hostname}`);
    expect(cacheRemoveItem).toHaveBeenCalledWith(
      `nitro/handlers:_:${hex(`tenant:config:${hostname}`)}.json`,
    );
  });

  it('removes the Nitro handler cache with the correct escaped key format', async () => {
    const hostname = 'beta.sales-portal.geins.dev';
    const body = JSON.stringify({ hostname });
    const sig = signStripe(body, 'test-secret');

    const request = createRequest({
      rawBody: body,
      signatureHeader: sig,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });

    const { storage: kv } = createMockKvStorage({
      getItem: vi.fn().mockImplementation(async (key: string) => {
        if (key === `tenant:id:${hostname}`) return 'beta';
        if (key === 'tenant:config:beta')
          return {
            tenantId: 'beta',
            hostname,
            aliases: [],
            isActive: true,
          };
        return null;
      }),
    });
    const { storage: cache, removeItem: cacheRemoveItem } =
      createMockCacheStorage();

    await processConfigRefresh(request, kv, cache);

    // Nitro 2.x stores defineCachedEventHandler entries as:
    //   nitro/handlers:_:{escapeKey(getKey())}.json
    // getKey is the hex of configKey, which escapeKey leaves unchanged.
    // configKey = "tenant:config:beta" → hex below
    expect(cacheRemoveItem).toHaveBeenCalledWith(
      'nitro/handlers:_:74656e616e743a636f6e6669673a62657461.json',
    );
  });

  it('should pass with key rotation: sign with key2, secrets=[key1,key2]', async () => {
    const hostname = 'alpha.example';
    const body = JSON.stringify({ hostname });
    const sig = signStripe(body, 'old-key');

    const request = createRequest({
      secrets: ['new-key', 'old-key'],
      rawBody: body,
      signatureHeader: sig,
      contentLength: Buffer.byteLength(body, 'utf-8'),
    });

    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    const result = await processConfigRefresh(request, kv, cache);
    expect(result).toEqual({ invalidated: true });
  });

  it('should return 429 when rate limit is exceeded', async () => {
    const fixedIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.1`;

    // Make 10 requests to exhaust the limit
    for (let i = 0; i < 10; i++) {
      const request = createRequest({ clientIp: fixedIp });
      const { storage: kv } = createMockKvStorage();
      const { storage: cache } = createMockCacheStorage();
      await processConfigRefresh(request, kv, cache);
    }

    // 11th request should be rate limited
    const request = createRequest({ clientIp: fixedIp });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();
    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 429,
    });
  });
});

describe('negative cache invalidation across aliases', () => {
  it('clears the negative cache for every hostname the tenant claims', async () => {
    // resolveTenant consults the negative cache before KV, so an alias probed
    // while the tenant was unknown keeps answering 404 for the rest of its
    // TTL even though the refreshed config is already in storage.
    const primary = 'primary.example';
    const alias = 'alias.example';
    const config = {
      tenantId: 't-alias',
      hostname: primary,
      aliases: [alias],
      isActive: true,
    } as unknown as TenantConfig;

    clearNegativeCacheSpy.mockClear();

    const kvStorage = {
      getItem: vi.fn(async (key: string) =>
        key === tenantConfigKey('t-alias') ? config : 't-alias',
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    await processConfigRefresh(
      {
        clientIp: '10.0.0.1',
        secrets: [],
        rawBody: JSON.stringify({ hostname: primary }),
        signatureHeader: undefined,
        webhookId: undefined,
        contentLength: 40,
      },
      kvStorage as unknown as KvStorage,
      { removeItem: vi.fn() } as unknown as CacheStorage,
    );

    const cleared = clearNegativeCacheSpy.mock.calls.map(([h]) => h);
    expect(cleared).toContain(primary);
    expect(cleared).toContain(alias);
  });

  it('still clears the hostname the webhook named when the config has dropped it', async () => {
    // KV can map a hostname the stored config no longer claims — an alias
    // removed from the tenant. That is exactly the hostname whose stale
    // entry needs clearing, and reading the set from the config alone
    // silently stops clearing it.
    const removed = 'removed-alias.example';
    const config = {
      tenantId: 't-alias',
      hostname: 'primary.example',
      aliases: [],
      isActive: true,
    } as unknown as TenantConfig;

    clearNegativeCacheSpy.mockClear();

    const kvStorage = {
      getItem: vi.fn(async (key: string) =>
        key === tenantConfigKey('t-alias') ? config : 't-alias',
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    await processConfigRefresh(
      {
        clientIp: '10.0.0.2',
        secrets: [],
        rawBody: JSON.stringify({ hostname: removed }),
        signatureHeader: undefined,
        webhookId: undefined,
        contentLength: 40,
      },
      kvStorage as unknown as KvStorage,
      { removeItem: vi.fn() } as unknown as CacheStorage,
    );

    expect(clearNegativeCacheSpy.mock.calls.map(([h]) => h)).toContain(removed);
  });
});
