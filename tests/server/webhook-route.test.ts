import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

import {
  processConfigRefresh,
  type WebhookRequest,
  type KvStorage,
  type CacheStorage,
} from '../../server/utils/webhook-handler';
import { MAX_WEBHOOK_BODY_SIZE } from '../../server/utils/webhook';

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
  const body = JSON.stringify({ hostname: 'tenant-a.litium.portal' });
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

  it('should return 500 when no secrets are configured', async () => {
    const request = createRequest({ secrets: [] });
    const { storage: kv } = createMockKvStorage();
    const { storage: cache } = createMockCacheStorage();

    await expect(
      processConfigRefresh(request, kv, cache),
    ).rejects.toMatchObject({
      statusCode: 500,
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
    const hostname = 'tenant-a.litium.portal';
    const secret = 'test-secret';
    const body = JSON.stringify({ hostname });
    const sig = signStripe(body, secret);
    const webhookId = 'wh_valid_123';

    const tenantConfig = {
      tenantId: 'tenant-a',
      hostname: 'tenant-a.litium.portal',
      aliases: ['tenant-a.localhost', 'tenant-a.sales-portal.geins.dev'],
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
        if (key === `tenant:id:${hostname}`) return 'tenant-a';
        if (key === 'tenant:config:tenant-a') return tenantConfig;
        return null;
      }),
    });
    const { storage: cache, removeItem: cacheRemoveItem } =
      createMockCacheStorage();

    const result = await processConfigRefresh(request, kv, cache);
    expect(result).toEqual({ invalidated: true });

    // Should remove all hostname → tenantId mappings
    expect(kvRemoveItem).toHaveBeenCalledWith(
      'tenant:id:tenant-a.litium.portal',
    );
    expect(kvRemoveItem).toHaveBeenCalledWith('tenant:id:tenant-a.localhost');
    expect(kvRemoveItem).toHaveBeenCalledWith(
      'tenant:id:tenant-a.sales-portal.geins.dev',
    );
    // Should remove config under tenantId
    expect(kvRemoveItem).toHaveBeenCalledWith('tenant:config:tenant-a');
    expect(cacheRemoveItem).toHaveBeenCalledWith(
      'nitro:handlers:tenant:config:tenant-a',
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
      `nitro:handlers:tenant:config:${hostname}`,
    );
  });

  it('should pass with key rotation: sign with key2, secrets=[key1,key2]', async () => {
    const hostname = 'tenant-a.litium.portal';
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
