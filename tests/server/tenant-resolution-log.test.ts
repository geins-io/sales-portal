import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  resolveTenant,
  resolveTenantOutcome,
  fetchTenantConfig,
  getTenantById,
  tenantIdKey,
  tenantConfigKey,
  clearNegativeCache,
  describeTransportError,
  formatTenantResolution,
} from '../../server/utils/tenant';
import type { TenantResolutionTrace } from '../../server/utils/tenant';
import type { TenantConfig } from '#shared/types/tenant-config';

// Same auto-import shims as tests/server/tenant.test.ts: the tenant utils
// reach useRuntimeConfig/useStorage through Nitro's transformer, which the
// node tier does not run. vi.hoisted so the refs exist when the hoisted
// vi.mock factories run.
const {
  mockLoggerWarn,
  mockLoggerDebug,
  mockIsDevMode,
  mockUseRuntimeConfig,
  mockUseStorage,
} = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockIsDevMode: vi.fn(() => true),
  mockUseRuntimeConfig: vi.fn(() => ({
    geins: { tenantApiUrl: 'https://merchant.example/store-settings' },
  })),
  mockUseStorage: vi.fn(() => ({
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    hasItem: vi.fn(() => Promise.resolve(false)),
  })),
}));
vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRuntimeConfig: mockUseRuntimeConfig,
    useStorage: mockUseStorage,
  };
});
vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('nitropack/runtime/internal/config', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('nitropack/runtime/internal/storage', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ...actual, useStorage: mockUseStorage };
});
vi.mock('../../server/utils/logger', () => ({
  logger: {
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
    error: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('../../server/utils/dev-mode', () => ({
  isDevMode: mockIsDevMode,
}));
// useStorage is a Nitro auto-import global, not an `#imports` member.
vi.stubGlobal('useStorage', mockUseStorage);

// --- Helpers -------------------------------------------------------------

const API_URL = 'https://merchant.example/store-settings';

function rawApiPayload(
  tenantId: string,
  hostname: string,
  options: { isActive?: boolean; additionalHostNames?: string[] } = {},
) {
  return {
    tenantId,
    isActive: options.isActive ?? true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    geinsSettings: {
      defaultHostName: hostname,
      additionalHostNames: options.additionalHostNames ?? [],
      apiKey: 'E0EB51F2-B663-457F-A7F9-A75693FD8469',
      accountName: tenantId,
      channelId: '1|se',
      defaultLocale: 'sv-SE',
      defaultMarket: 'se',
      locales: ['sv-SE'],
      markets: ['se'],
    },
    appSettings: {
      mode: 'commerce',
      theme: {
        colors: {
          primary: 'oklch(0.5 0.1 200)',
          primaryForeground: 'oklch(0.9 0 0)',
          secondary: 'oklch(0.8 0 0)',
          secondaryForeground: 'oklch(0.2 0 0)',
          background: 'oklch(1 0 0)',
          foreground: 'oklch(0.1 0 0)',
        },
      },
      branding: { name: 'Brand', watermark: 'full' },
      features: {},
    },
  };
}

function httpResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined
        ? Promise.reject(new SyntaxError('Unexpected end of JSON input'))
        : Promise.resolve(body),
  } as unknown as Response;
}

/** What Node's fetch throws when the connection is refused: TypeError with the code on `cause`. */
function connectionRefused(): Error {
  const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), {
    code: 'ECONNREFUSED',
  });
  return new TypeError('fetch failed', { cause });
}

function stubFetch(impl: (url: string) => Promise<Response>) {
  const spy = vi.fn(impl);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function makeEvent(): { context: Record<string, unknown> } {
  return { context: {} };
}

/**
 * A Map-backed KV so a test can seed keys and assert exactly what the
 * resolution path wrote and removed. Installed as the `useStorage` result
 * until {@link resetStorage} puts the empty default back.
 */
function memoryStorage(seed: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(seed));
  const storage = {
    store,
    getItem: vi.fn((key: string) =>
      Promise.resolve(store.has(key) ? store.get(key) : null),
    ),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    hasItem: vi.fn((key: string) => Promise.resolve(store.has(key))),
  };
  mockUseStorage.mockReturnValue(
    storage as unknown as ReturnType<typeof mockUseStorage>,
  );
  return storage;
}

function resetStorage() {
  mockUseStorage.mockReset();
  mockUseStorage.mockImplementation(() => ({
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    hasItem: vi.fn(() => Promise.resolve(false)),
  }));
}

/** A config as KV holds it: only the fields the resolution path reads. */
function kvConfig(
  tenantId: string,
  hostname: string,
  options: { isActive?: boolean; aliases?: string[] } = {},
): TenantConfig {
  return {
    tenantId,
    hostname,
    aliases: options.aliases ?? [],
    isActive: options.isActive ?? true,
  } as unknown as TenantConfig;
}

function warnLinesFor(hostname: string): string[] {
  return mockLoggerWarn.mock.calls
    .map(([msg]) => msg as string)
    .filter((msg) => msg.includes(`host=${hostname} `));
}

function debugLinesFor(hostname: string): string[] {
  return mockLoggerDebug.mock.calls
    .map(([msg]) => msg as string)
    .filter((msg) => msg.includes(`host=${hostname} `));
}

// --- Tests ---------------------------------------------------------------

// Sequential: the tests swap the global fetch and flip the dev-mode mock,
// which the file-level concurrency of the node tier would otherwise race.
describe.sequential('resolveTenant resolution log', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockLoggerWarn.mockClear();
    mockLoggerDebug.mockClear();
    mockIsDevMode.mockReturnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('unknown hostname: the merchant API answered 404 → outcome=unknown-tenant', async () => {
    const host = 'unknown.example';
    stubFetch(async () => httpResponse(404));
    const event = makeEvent();

    const result = await resolveTenant(
      host,
      event as unknown as Parameters<typeof resolveTenant>[1],
    );
    clearNegativeCache(host);

    expect(result).toBeNull();
    const lines = warnLinesFor(host);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 404 outcome=unknown-tenant`,
    );
    // The same line is left on the event for the 404 page.
    expect(event.context.tenantResolution).toBe(lines[0]);
    expect(mockLoggerDebug).not.toHaveBeenCalled();
  });

  it('merchant API unreachable: fetch threw → outcome=transport-failure, naming the error code', async () => {
    const host = 'unreachable.example';
    stubFetch(async () => {
      throw connectionRefused();
    });
    const event = makeEvent();

    const result = await resolveTenant(
      host,
      event as unknown as Parameters<typeof resolveTenant>[1],
    );
    clearNegativeCache(host);

    expect(result).toBeNull();
    const lines = warnLinesFor(host);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → ECONNREFUSED (connect ECONNREFUSED 127.0.0.1:1) outcome=transport-failure`,
    );
    expect(event.context.tenantResolution).toBe(lines[0]);
  });

  it('the two failure lines differ in the first token after outcome=', async () => {
    const unknownHost = 'a-unknown.example';
    const downHost = 'a-down.example';

    stubFetch(async () => httpResponse(404));
    await resolveTenant(unknownHost);
    stubFetch(async () => {
      throw connectionRefused();
    });
    await resolveTenant(downHost);
    clearNegativeCache(unknownHost);
    clearNegativeCache(downHost);

    const token = (line: string) => /outcome=(\S+)/.exec(line)?.[1];
    expect(token(warnLinesFor(unknownHost)[0]!)).toBe('unknown-tenant');
    expect(token(warnLinesFor(downHost)[0]!)).toBe('transport-failure');
  });

  it('a non-404 error status from the merchant API is a transport failure, not an unknown tenant', async () => {
    const host = 'upstream-500.example';
    stubFetch(async () => httpResponse(502));

    await resolveTenant(host);
    clearNegativeCache(host);

    expect(warnLinesFor(host)[0]).toContain('→ 502 outcome=transport-failure');
  });

  it('a later lookup within the negative-cache window says what it repeats', async () => {
    const host = 'cached.example';
    const fetchSpy = stubFetch(async () => httpResponse(404));

    await resolveTenant(host);
    await resolveTenant(host);
    clearNegativeCache(host);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const lines = warnLinesFor(host);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(
      new RegExp(
        `^\\[tenant\\] resolve host=${host} kv=skipped api=skipped outcome=negative-cache \\(unknown-tenant, \\d+s ago\\)$`,
      ),
    );
  });

  it('a transport failure is not negative-cached: the next lookup asks the merchant API again', async () => {
    const host = 'flaky.example';
    let calls = 0;
    const fetchSpy = stubFetch(async () => {
      calls++;
      if (calls === 1) throw connectionRefused();
      return httpResponse(200, rawApiPayload('flaky', host));
    });

    const first = await resolveTenantOutcome(host);
    const second = await resolveTenantOutcome(host);
    clearNegativeCache(host);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ config: null, outcome: 'transport-failure' });
    expect(second.outcome).toBe('resolved');
    expect(second.config?.tenantId).toBe('flaky');
  });

  it('an unknown hostname is negative-cached and reported as such', async () => {
    const host = 'nobody.example';
    const fetchSpy = stubFetch(async () => httpResponse(404));

    const first = await resolveTenantOutcome(host);
    const second = await resolveTenantOutcome(host);
    clearNegativeCache(host);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first.outcome).toBe('unknown-tenant');
    expect(second.outcome).toBe('negative-cache');
  });

  it('a resolved lookup logs at debug, not warn', async () => {
    const host = 'registered.example';
    stubFetch(async () => httpResponse(200, rawApiPayload('registered', host)));

    const result = await resolveTenant(host);

    expect(result?.tenantId).toBe('registered');
    expect(warnLinesFor(host)).toHaveLength(0);
    const lines = debugLinesFor(host);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 200 outcome=resolved tenant=registered`,
    );
  });

  it('a KV hit logs kv=hit with the merchant API skipped', async () => {
    const host = 'kv-hit.example';
    const config = {
      tenantId: 'kv-tenant',
      hostname: host,
      isActive: true,
      geinsSettings: { additionalHostNames: [] },
    };
    // useStorage is called once per KV step; keep the seeded store for all of them.
    mockUseStorage.mockReturnValue({
      getItem: vi.fn((key: string) =>
        Promise.resolve(key.endsWith(`:${host}`) ? 'kv-tenant' : config),
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      hasItem: vi.fn(() => Promise.resolve(false)),
    } as unknown as ReturnType<typeof mockUseStorage>);
    const fetchSpy = stubFetch(async () => httpResponse(404));

    const result = await resolveTenant(host);
    mockUseStorage.mockReset();
    mockUseStorage.mockImplementation(() => ({
      getItem: vi.fn(() => Promise.resolve(null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      hasItem: vi.fn(() => Promise.resolve(false)),
    }));

    expect(result).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(debugLinesFor(host)[0]).toBe(
      `[tenant] resolve host=${host} kv=hit api=skipped outcome=resolved tenant=kv-tenant`,
    );
  });

  it('production build: nothing is logged and nothing is left on the event', async () => {
    mockIsDevMode.mockReturnValue(false);
    const host = 'prod-unknown.example';
    stubFetch(async () => httpResponse(404));
    const event = makeEvent();

    const result = await resolveTenant(
      host,
      event as unknown as Parameters<typeof resolveTenant>[1],
    );
    clearNegativeCache(host);

    expect(result).toBeNull();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(mockLoggerDebug).not.toHaveBeenCalled();
    expect(event.context.tenantResolution).toBeUndefined();
  });
});

// Sequential for the same reason as above; these swap the KV stub as well.
describe.sequential('resolveTenantOutcome KV paths', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockLoggerWarn.mockClear();
    mockLoggerDebug.mockClear();
    mockIsDevMode.mockReturnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetStorage();
  });

  it('a resolved lookup writes the config under its tenantId and a mapping for every hostname', async () => {
    const host = 'primary.example';
    const aliases = ['alias.example', 'www.primary.example'];
    const storage = memoryStorage();
    stubFetch(async () =>
      httpResponse(
        200,
        rawApiPayload('multi-host', host, { additionalHostNames: aliases }),
      ),
    );

    const { config, outcome } = await resolveTenantOutcome(host);

    expect(outcome).toBe('resolved');
    expect(config?.tenantId).toBe('multi-host');
    expect(storage.store.get(tenantConfigKey('multi-host'))).toBe(config);
    for (const h of [host, ...aliases]) {
      expect(storage.store.get(tenantIdKey(h))).toBe('multi-host');
    }
    // Nothing is stored under the hostname-keyed config key.
    expect(storage.store.has(tenantConfigKey(host))).toBe(false);
    expect(storage.store.size).toBe(1 + 1 + aliases.length);
  });

  it('after a resolve, an alias is a KV hit: no merchant API call', async () => {
    const host = 'brand.example';
    const alias = 'shop.brand.example';
    memoryStorage();
    const fetchSpy = stubFetch(async () =>
      httpResponse(
        200,
        rawApiPayload('brand', host, { additionalHostNames: [alias] }),
      ),
    );

    await resolveTenantOutcome(host);
    const second = await resolveTenantOutcome(alias);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.outcome).toBe('resolved');
    expect(second.config?.tenantId).toBe('brand');
    expect(debugLinesFor(alias)[0]).toBe(
      `[tenant] resolve host=${alias} kv=hit api=skipped outcome=resolved tenant=brand`,
    );
  });

  it('stale mapping: the KV key is removed, the merchant API is asked, and the fresh mapping is written', async () => {
    const host = 'moved.example';
    const staleConfig = kvConfig('old-tenant', 'elsewhere.example');
    const storage = memoryStorage({
      [tenantIdKey(host)]: 'old-tenant',
      [tenantConfigKey('old-tenant')]: staleConfig,
    });
    const fetchSpy = stubFetch(async () =>
      httpResponse(200, rawApiPayload('new-tenant', host)),
    );

    const { config, outcome } = await resolveTenantOutcome(host);

    expect(outcome).toBe('resolved');
    expect(config?.tenantId).toBe('new-tenant');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      `${API_URL}?hostname=${host}`,
    );
    // The stale key was removed before the fetch, so the rewrite is a plain
    // write and not a remap between two tenants.
    expect(storage.removeItem).toHaveBeenCalledWith(tenantIdKey(host));
    expect(storage.store.get(tenantIdKey(host))).toBe('new-tenant');
    expect(storage.store.get(tenantConfigKey('new-tenant'))).toBe(config);
    // The other tenant's own config is left alone.
    expect(storage.store.get(tenantConfigKey('old-tenant'))).toBe(staleConfig);

    const warns = mockLoggerWarn.mock.calls.map(([msg]) => msg as string);
    expect(warns.some((m) => m.includes('Stale hostname mapping'))).toBe(true);
    expect(warns.some((m) => m.includes('remapped'))).toBe(false);
    expect(debugLinesFor(host)[0]).toBe(
      `[tenant] resolve host=${host} kv=stale api=GET ${API_URL}?hostname=${host} → 200 outcome=resolved tenant=new-tenant`,
    );
  });

  it('a mapping to a tenant whose config is gone from KV falls through to the merchant API', async () => {
    const host = 'orphan.example';
    const storage = memoryStorage({ [tenantIdKey(host)]: 'vanished' });
    const fetchSpy = stubFetch(async () =>
      httpResponse(200, rawApiPayload('vanished', host)),
    );

    const { outcome, config } = await resolveTenantOutcome(host);

    expect(outcome).toBe('resolved');
    expect(config?.tenantId).toBe('vanished');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storage.store.get(tenantConfigKey('vanished'))).toBe(config);
    expect(debugLinesFor(host)[0]).toContain('kv=miss api=GET');
  });

  it('inactive tenant: unknown-tenant, negative-cached, nothing written to KV', async () => {
    const host = 'switched-off.example';
    const storage = memoryStorage();
    const fetchSpy = stubFetch(async () =>
      httpResponse(200, rawApiPayload('off', host, { isActive: false })),
    );

    const first = await resolveTenantOutcome(host);
    const second = await resolveTenantOutcome(host);
    clearNegativeCache(host);

    expect(first).toEqual({ config: null, outcome: 'unknown-tenant' });
    expect(second.outcome).toBe('negative-cache');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.store.size).toBe(0);
    expect(warnLinesFor(host)[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 200 (inactive) outcome=unknown-tenant`,
    );
  });

  it('unreadable body: invalid-config, negative-cached, nothing written to KV', async () => {
    const host = 'garbled.example';
    const storage = memoryStorage();
    const fetchSpy = stubFetch(async () => httpResponse(200));

    const first = await resolveTenantOutcome(host);
    const second = await resolveTenantOutcome(host);
    clearNegativeCache(host);

    expect(first).toEqual({ config: null, outcome: 'invalid-config' });
    expect(second.outcome).toBe('negative-cache');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(warnLinesFor(host)[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 200 (unreadable body) outcome=invalid-config`,
    );
    expect(warnLinesFor(host)[1]).toContain(
      'outcome=negative-cache (invalid-config,',
    );
  });

  it('body rejected by the schema: invalid-config, negative-cached, nothing written to KV', async () => {
    const host = 'malformed.example';
    const storage = memoryStorage();
    // No tenantId anywhere: a fatal path for parseStoreSettingsResilient.
    const fetchSpy = stubFetch(async () =>
      httpResponse(200, { appSettings: { mode: 'commerce' } }),
    );

    const first = await resolveTenantOutcome(host);
    const second = await resolveTenantOutcome(host);
    clearNegativeCache(host);

    expect(first).toEqual({ config: null, outcome: 'invalid-config' });
    expect(second.outcome).toBe('negative-cache');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(warnLinesFor(host)[0]).toBe(
      `[tenant] resolve host=${host} kv=miss api=GET ${API_URL}?hostname=${host} → 200 outcome=invalid-config`,
    );
  });
});

describe.sequential('getTenantById', () => {
  afterEach(() => {
    resetStorage();
  });

  it('returns the config stored under tenant:config:{tenantId}', async () => {
    const config = kvConfig('t-1', 't-1.example');
    const storage = memoryStorage({ [tenantConfigKey('t-1')]: config });

    await expect(getTenantById('t-1')).resolves.toBe(config);
    expect(storage.getItem).toHaveBeenCalledWith(tenantConfigKey('t-1'));
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('returns null for an unknown tenantId without touching the merchant API or writing', async () => {
    const storage = memoryStorage();
    const fetchSpy = stubFetch(async () => httpResponse(404));

    await expect(getTenantById('nobody')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('returns null for an inactive config and leaves it in KV', async () => {
    const config = kvConfig('t-off', 't-off.example', { isActive: false });
    const storage = memoryStorage({ [tenantConfigKey('t-off')]: config });

    await expect(getTenantById('t-off')).resolves.toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.store.get(tenantConfigKey('t-off'))).toBe(config);
  });
});

describe.sequential('fetchTenantConfig', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function trace(hostname: string): TenantResolutionTrace {
    return { hostname, kv: 'miss', outcome: 'unknown-tenant' };
  }

  it('200: builds a TenantConfig and marks the trace resolved', async () => {
    const host = 'fetch-ok.example';
    stubFetch(async () => httpResponse(200, rawApiPayload('fetched', host)));
    const t = trace(host);

    const config = await fetchTenantConfig(host, undefined, t);

    expect(config?.tenantId).toBe('fetched');
    expect(config?.hostname).toBe(host);
    expect(config?.isActive).toBe(true);
    expect(t).toMatchObject({
      outcome: 'resolved',
      api: { url: `${API_URL}?hostname=${host}`, result: '200' },
    });
  });

  it('404: null and unknown-tenant', async () => {
    const host = 'fetch-404.example';
    stubFetch(async () => httpResponse(404));
    const t = trace(host);

    await expect(fetchTenantConfig(host, undefined, t)).resolves.toBeNull();
    expect(t).toMatchObject({
      outcome: 'unknown-tenant',
      api: { result: '404' },
    });
  });

  it('fetch threw: null and transport-failure', async () => {
    const host = 'fetch-down.example';
    stubFetch(async () => {
      throw connectionRefused();
    });
    const t = trace(host);

    await expect(fetchTenantConfig(host, undefined, t)).resolves.toBeNull();
    expect(t.outcome).toBe('transport-failure');
    expect(t.api?.result).toBe(
      'ECONNREFUSED (connect ECONNREFUSED 127.0.0.1:1)',
    );
  });

  it('works without a trace', async () => {
    const host = 'fetch-quiet.example';
    stubFetch(async () => httpResponse(200, rawApiPayload('quiet', host)));

    const config = await fetchTenantConfig(host);

    expect(config?.tenantId).toBe('quiet');
  });
});

describe('describeTransportError', () => {
  it('prefers the code undici puts on cause, followed by its message', () => {
    expect(describeTransportError(connectionRefused())).toBe(
      'ECONNREFUSED (connect ECONNREFUSED 127.0.0.1:1)',
    );
  });

  it('falls back to the error name for a timeout', () => {
    const err = new DOMException('The operation was aborted', 'TimeoutError');
    expect(describeTransportError(err)).toBe(
      'TimeoutError (The operation was aborted)',
    );
  });

  it('does not repeat a message that equals the label', () => {
    const err = new Error('ENOTFOUND');
    err.name = 'ENOTFOUND';
    expect(describeTransportError(err)).toBe('ENOTFOUND');
  });
});

describe('formatTenantResolution', () => {
  it('keeps the field order constant when the merchant API was not called', () => {
    expect(
      formatTenantResolution({
        hostname: 'x.example',
        kv: 'skipped',
        outcome: 'negative-cache',
        detail: 'unknown-tenant, 12s ago',
      }),
    ).toBe(
      '[tenant] resolve host=x.example kv=skipped api=skipped outcome=negative-cache (unknown-tenant, 12s ago)',
    );
  });
});
