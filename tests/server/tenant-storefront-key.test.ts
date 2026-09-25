import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

import {
  resolveTenantOutcome,
  storefrontKey,
  tenantConfigKey,
  tenantIdKey,
} from '../../server/utils/tenant';
import { processConfigRefresh } from '../../server/utils/webhook-handler';
import { getTenantSDK, type TenantSDK } from '../../server/services/_sdk';
import { resolveTenantCacheKey } from '../../server/services/categories';
import { resolveConfigCacheKey } from '../../server/api/config.get';
import type { TenantConfig } from '#shared/types/tenant-config';

// The registry answers the account name as `tenantId` for every channel of an
// account. Two channels on one account must still resolve, cache and
// invalidate as two storefronts.

// Hoisted: the modules under test read these Nitro auto-imports at load time.
const { mockUseStorage, mockUseRuntimeConfig } = vi.hoisted(() => {
  const mocks = {
    mockUseStorage: vi.fn(),
    mockUseRuntimeConfig: vi.fn(() => ({
      geins: { tenantApiUrl: 'https://merchant.example/store-settings' },
    })),
  };
  vi.stubGlobal('useStorage', mocks.mockUseStorage);
  vi.stubGlobal('useRuntimeConfig', mocks.mockUseRuntimeConfig);
  vi.stubGlobal('defineCachedEventHandler', (fn: unknown) => fn);
  vi.stubGlobal('defineCachedFunction', (fn: unknown) => fn);
  vi.stubGlobal('getQuery', () => ({}));
  return mocks;
});
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
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../server/utils/dev-mode', () => ({ isDevMode: () => true }));

// The SDK packages only need to record the settings they were built with.
vi.mock('@geins/core', () => ({
  GeinsCore: class {
    constructor(public settings: { channel: string }) {}
  },
}));
vi.mock('@geins/crm', () => ({ GeinsCRM: vi.fn() }));
vi.mock('@geins/cms', () => ({ GeinsCMS: vi.fn() }));
vi.mock('@geins/oms', () => ({ GeinsOMS: vi.fn() }));
vi.mock('@geins/types', () => ({ RuntimeContext: { SERVER: 'server' } }));

function registryRecord(
  account: string,
  hostname: string,
  alias: string,
  channelId: string,
  appHostname?: string,
) {
  return {
    tenantId: account,
    isActive: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    geinsSettings: {
      defaultHostName: hostname,
      additionalHostNames: [alias],
      apiKey: 'k',
      accountName: account,
      channelId,
      defaultLocale: 'sv-SE',
      defaultMarket: 'se',
      locales: ['sv-SE'],
      markets: ['se'],
    },
    appSettings: {
      mode: channelId === '1|se' ? 'commerce' : 'catalog',
      features: {},
      ...(appHostname === undefined ? {} : { hostname: appHostname }),
    },
  };
}

function memoryStorage() {
  const store = new Map<string, unknown>();
  const storage = {
    store,
    getItem: async <T>(key: string): Promise<T | null> =>
      store.has(key) ? (store.get(key) as T) : null,
    setItem: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    hasItem: vi.fn(async (key: string) => store.has(key)),
  };
  mockUseStorage.mockReturnValue(storage);
  return storage;
}

function eventFor(hostname: string, config: TenantConfig): H3Event {
  return {
    context: { tenant: { hostname, tenantId: config.tenantId, config } },
  } as unknown as H3Event;
}

function channelOf(sdk: TenantSDK): string {
  return (sdk.core as unknown as { settings: { channel: string } }).settings
    .channel;
}

interface Storefront {
  account: string;
  host: string;
  alias: string;
  channelId: string;
  appHostname?: string;
}

/** Answers the registry lookup for every host and alias of `list`. */
function stubRegistry(list: Storefront[]) {
  const records = new Map(
    list.flatMap((s) => {
      const record = registryRecord(
        s.account,
        s.host,
        s.alias,
        s.channelId,
        s.appHostname,
      );
      return [
        [s.host, record],
        [s.alias, record],
      ] as const;
    }),
  );
  const fetchSpy = vi.fn(async (url: string) => {
    const hostname = new URL(url).searchParams.get('hostname') ?? '';
    const record = records.get(hostname);
    return {
      ok: Boolean(record),
      status: record ? 200 : 404,
      json: async () => record,
    } as unknown as Response;
  });
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

/**
 * Two storefronts on one account, each with one alias. Names carry a per-test
 * prefix because the SDK cache and the negative cache are module state shared
 * by every test in the file.
 */
function storefronts(prefix: string) {
  const account = `${prefix}-account`;
  const a: Storefront = {
    account,
    host: `${prefix}-a.example`,
    alias: `${prefix}-a-alias.example`,
    channelId: '1|se',
  };
  const b: Storefront = {
    account,
    host: `${prefix}-b.example`,
    alias: `${prefix}-b-alias.example`,
    channelId: '2|se',
  };
  return { account, a, b, fetchSpy: stubRegistry([a, b]) };
}

async function resolved(hostname: string): Promise<TenantConfig> {
  const { config } = await resolveTenantOutcome(hostname);
  if (!config) throw new Error(`${hostname} did not resolve`);
  return config;
}

describe.sequential('two channels on one account', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockUseStorage.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('each host resolves to its own channel, and KV holds one config per storefront', async () => {
    const storage = memoryStorage();
    const { account, a, b, fetchSpy } = storefronts('resolve');

    const firstB = await resolved(b.host);
    const firstA = await resolved(a.host);
    const secondB = await resolved(b.host);

    expect(firstB.tenantId).toBe(account);
    expect(firstA.tenantId).toBe(account);
    expect(firstB.geinsSettings.channel).toBe('2');
    expect(firstA.geinsSettings.channel).toBe('1');
    expect(secondB.geinsSettings.channel).toBe('2');
    // The third lookup is a KV hit: A did not overwrite B's entry.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(storage.store.get(tenantConfigKey(`${account}:1|se`))).toBe(firstA);
    expect(storage.store.get(tenantConfigKey(`${account}:2|se`))).toBe(firstB);
    expect(storage.store.get(tenantIdKey(a.alias))).toBe(`${account}:1|se`);
  });

  it('two accounts on the same channel get two entries', async () => {
    const storage = memoryStorage();
    const one: Storefront = {
      account: 'first-account',
      host: 'first.example',
      alias: 'www.first.example',
      channelId: '1|se',
    };
    const two: Storefront = {
      ...one,
      account: 'second-account',
      host: 'second.example',
      alias: 'www.second.example',
    };
    stubRegistry([one, two]);

    const configOne = await resolved(one.host);
    const configTwo = await resolved(two.host);

    expect(storage.store.get(tenantConfigKey('first-account:1|se'))).toBe(
      configOne,
    );
    expect(storage.store.get(tenantConfigKey('second-account:1|se'))).toBe(
      configTwo,
    );
    expect(resolveConfigCacheKey(eventFor(one.host, configOne))).not.toBe(
      resolveConfigCacheKey(eventFor(two.host, configTwo)),
    );
  });

  it('falls back to the hostname when account or channel is missing', () => {
    const geinsSettings = { accountName: 'acct', channel: '1', tld: 'se' };
    const config = (
      overrides: Partial<typeof geinsSettings>,
      hostname = 'shop.example',
    ) =>
      ({
        hostname,
        geinsSettings: { ...geinsSettings, ...overrides },
      }) as unknown as TenantConfig;

    expect(storefrontKey(config({}), 'req.example')).toBe('acct:1|se');
    expect(storefrontKey(config({ channel: '' }), 'req.example')).toBe(
      'shop.example',
    );
    expect(storefrontKey(config({ tld: '' }), 'req.example')).toBe(
      'shop.example',
    );
    expect(storefrontKey(config({ accountName: '' }), 'req.example')).toBe(
      'shop.example',
    );
    expect(storefrontKey(config({ channel: '' }, ''), 'req.example')).toBe(
      'req.example',
    );
  });

  it('a config with neither channel nor hostname is keyed by the requested hostname', async () => {
    const storage = memoryStorage();
    // An empty channelId, no Geins defaultHostName and an empty
    // appSettings.hostname: the schema accepts every one of them as "", which
    // would otherwise collapse onto one shared key.
    const hostA = 'empty-a.example';
    const hostB = 'empty-b.example';
    const blank = {
      account: 'empty-account',
      host: '',
      channelId: '|',
      appHostname: '',
    };
    stubRegistry([
      { ...blank, alias: hostA },
      { ...blank, alias: hostB },
    ]);

    const configA = await resolved(hostA);
    const configB = await resolved(hostB);

    expect(configA.hostname).toBe('');
    expect(configA.geinsSettings.channel).toBe('');
    expect(storage.store.has(tenantConfigKey(''))).toBe(false);
    expect(storage.store.get(tenantConfigKey(hostA))).toBe(configA);
    expect(storage.store.get(tenantConfigKey(hostB))).toBe(configB);
    expect(storage.store.get(tenantIdKey(hostA))).toBe(hostA);
    expect(await resolved(hostB)).toBe(configB);
  });

  it('an alias shares its storefront entry without a second registry call', async () => {
    memoryStorage();
    const { a, fetchSpy } = storefronts('alias');

    const viaHost = await resolved(a.host);
    const viaAlias = await resolved(a.alias);

    expect(viaAlias).toBe(viaHost);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resolveConfigCacheKey(eventFor(a.alias, viaAlias))).toBe(
      resolveConfigCacheKey(eventFor(a.host, viaHost)),
    );
  });

  it('/api/config, the SDK and the category tree get one cache entry per storefront', async () => {
    memoryStorage();
    const { a, b } = storefronts('caches');
    const configB = await resolved(b.host);
    const configA = await resolved(a.host);
    const eventB = eventFor(b.host, configB);
    const eventA = eventFor(a.host, configA);

    expect(resolveConfigCacheKey(eventA)).not.toBe(
      resolveConfigCacheKey(eventB),
    );
    expect(resolveTenantCacheKey(eventA)).not.toBe(
      resolveTenantCacheKey(eventB),
    );

    const sdkB = await getTenantSDK(eventB);
    const sdkA = await getTenantSDK(eventA);
    expect(sdkA).not.toBe(sdkB);
    expect(channelOf(sdkB)).toBe('2');
    expect(channelOf(sdkA)).toBe('1');
    expect(await getTenantSDK(eventFor(a.alias, configA))).toBe(sdkA);
  });

  it('a config refresh for one storefront leaves the other storefront cached', async () => {
    const storage = memoryStorage();
    const { a, b } = storefronts('webhook');
    const configB = await resolved(b.host);
    const configA = await resolved(a.host);
    const sdkB = await getTenantSDK(eventFor(b.host, configB));
    const sdkA = await getTenantSDK(eventFor(a.host, configA));
    const cacheStorage = { removeItem: vi.fn(async () => {}) };

    await processConfigRefresh(
      {
        clientIp: '203.0.113.7',
        secrets: [],
        rawBody: JSON.stringify({ hostname: a.host }),
        signatureHeader: undefined,
        webhookId: undefined,
        contentLength: 0,
      },
      storage,
      cacheStorage,
    );

    expect(
      storage.store.has(tenantConfigKey(storefrontKey(configA, a.host))),
    ).toBe(false);
    expect(storage.store.has(tenantIdKey(a.alias))).toBe(false);
    expect(
      storage.store.get(tenantConfigKey(storefrontKey(configB, b.host))),
    ).toBe(configB);
    expect(storage.store.has(tenantIdKey(b.host))).toBe(true);
    expect(cacheStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(cacheStorage.removeItem).toHaveBeenCalledWith(
      `nitro/handlers:_:${resolveConfigCacheKey(eventFor(a.host, configA)).replace(/\W/g, '')}.json`,
    );
    expect(await getTenantSDK(eventFor(b.host, configB))).toBe(sdkB);
    expect(await getTenantSDK(eventFor(a.host, configA))).not.toBe(sdkA);
  });
});
