import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock Nitro/h3 auto-imports before the module under test is loaded.
// Only ?preview=1 (the query) may push a request onto a preview cache key; a
// stale store_settings_preview / preview_mode cookie must never do so. These
// tests lock that contract so a future refactor can't silently re-add a cookie
// term to the cache key and reintroduce the cross-tenant cache-poisoning leak.
// ---------------------------------------------------------------------------
let query: Record<string, unknown> = {};
const getQueryMock = vi.fn(() => query);

vi.stubGlobal('defineCachedEventHandler', (fn: unknown) => fn);
vi.stubGlobal('withErrorHandling', (fn: () => unknown) => fn());
vi.stubGlobal('getQuery', getQueryMock);

vi.mock('#shared/constants/storage', () => ({
  KV_STORAGE_KEYS: {
    TENANT_CONFIG_PREFIX: 'tenant-config:',
    TENANT_ID_PREFIX: 'tenant-id:',
  },
}));

let resolveConfigCacheKey: (event: H3Event) => string;

beforeEach(async () => {
  query = {};
  vi.resetModules();
  resolveConfigCacheKey = (await import('../../server/api/config.get'))
    .resolveConfigCacheKey;
});

function createEvent(
  cookies: Record<string, string> = {},
  tenant: { tenantId?: string; hostname?: string } = {
    tenantId: 'acme',
    hostname: 'acme.localhost',
  },
): H3Event {
  return {
    context: { tenant },
    // node.req.headers.cookie is where h3 reads cookies from; included so a
    // future cookie-based regression would have something real to read.
    node: { req: { headers: { cookie: serializeCookies(cookies) } } },
  } as unknown as H3Event;
}

function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

describe('resolveConfigCacheKey', () => {
  const base = 'tenant-config:acme';

  it('returns the plain base key for a clean request (no query)', () => {
    expect(resolveConfigCacheKey(createEvent())).toBe(base);
  });

  it('falls back to hostname when tenantId is absent', () => {
    const event = createEvent({}, { hostname: 'acme.localhost' });
    expect(resolveConfigCacheKey(event)).toBe('tenant-config:acme.localhost');
  });

  it('two clean requests produce the identical stable key (cache-hit-rate guarantee)', () => {
    const a = resolveConfigCacheKey(createEvent());
    const b = resolveConfigCacheKey(createEvent());
    expect(a).toBe(b);
    expect(a).toBe(base);
  });

  it('?preview=1 returns a key with the :settings-preview: suffix', () => {
    query = { preview: '1' };
    const key = resolveConfigCacheKey(createEvent());
    expect(key).toContain(':settings-preview:');
    expect(key.startsWith(base)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Regression locks: a cookie must NEVER produce a preview cache key.
  // -------------------------------------------------------------------------
  it('store_settings_preview cookie alone (no ?preview=1) returns the plain base key', () => {
    const event = createEvent({ store_settings_preview: 'true' });
    expect(resolveConfigCacheKey(event)).toBe(base);
  });

  it('CMS preview_mode cookie alone (no ?preview=1) returns the plain base key', () => {
    const event = createEvent({ preview_mode: 'true' });
    expect(resolveConfigCacheKey(event)).toBe(base);
  });

  // -------------------------------------------------------------------------
  // Strict === '1' edge values must NOT trigger the preview suffix.
  // -------------------------------------------------------------------------
  it('preview=true does not trigger the preview suffix', () => {
    query = { preview: 'true' };
    expect(resolveConfigCacheKey(createEvent())).toBe(base);
  });

  it('preview=0 does not trigger the preview suffix', () => {
    query = { preview: '0' };
    expect(resolveConfigCacheKey(createEvent())).toBe(base);
  });

  it("preview as array ['1'] does not trigger the preview suffix", () => {
    query = { preview: ['1'] };
    expect(resolveConfigCacheKey(createEvent())).toBe(base);
  });
});
