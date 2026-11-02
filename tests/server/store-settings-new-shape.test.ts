import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

import {
  fetchTenantConfig,
  resolveTenantOutcome,
  resolvePreviewTenant,
  collectAllHostnames,
  storefrontKey,
  clearNegativeCache,
} from '../../server/utils/tenant';
import type { TenantResolutionTrace } from '../../server/utils/tenant';
import { getPublicConfig } from '../../server/services/tenant-config';
import type { TenantConfig } from '#shared/types/tenant-config';
import newShapeFixture from '../fixtures/store-settings/new-shape.json';
import prodAnswerFixture from '../fixtures/store-settings/prod-answer.json';

// Same auto-import shims as tests/server/tenant-resolution-log.test.ts.
const {
  mockLoggerWarn,
  mockLoggerError,
  mockGetChannel,
  mockUseRuntimeConfig,
  mockUseStorage,
} = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockGetChannel: vi.fn(),
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
    debug: vi.fn(),
    error: mockLoggerError,
    info: vi.fn(),
  },
}));
vi.mock('@sentry/nuxt', () => ({ captureException: vi.fn() }));
vi.mock('../../server/services/channels', () => ({
  getChannel: mockGetChannel,
}));
vi.stubGlobal('useStorage', mockUseStorage);

const HOST = 'sonoralab.litium.store';

type Answer = Record<string, unknown>;

/** The new-shape answer as prod sends it, freshly copied so a test can edit it. */
function newShape(): Answer & {
  channelSettings: Record<string, unknown>;
  appSettings: Record<string, unknown>;
} {
  return structuredClone(newShapeFixture) as never;
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function stubAnswer(body: unknown) {
  const spy = vi.fn(() => Promise.resolve(okResponse(body)));
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

async function resolve(
  body: unknown,
  hostname = HOST,
): Promise<TenantConfig | null> {
  stubAnswer(body);
  return fetchTenantConfig(hostname);
}

async function publicConfigFor(config: TenantConfig, hostname = HOST) {
  const event = {
    context: { tenant: { hostname, config } },
  } as unknown as H3Event;
  return getPublicConfig(event);
}

describe('store settings in the merchant API new shape', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
    mockGetChannel.mockReset();
    mockGetChannel.mockResolvedValue({ assetHost: 'https://channel.example' });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves the new-shape answer to the storefront it is today', async () => {
    const config = await resolve(newShape());
    expect(config).not.toBeNull();
    const publicConfig = await publicConfigFor(config!);

    expect(publicConfig).toMatchObject({
      tenantId: 'sonoralab',
      hostname: 'sonoralab.litium.store',
      aliases: [
        'sonoralab.staging.litium.store',
        'sonoralab.sales-portal.geins.dev',
      ],
      locale: 'sv-SE',
      market: 'se',
      availableLocales: ['sv-SE', 'en-GB', 'nb-NO', 'de-DE', 'fi-FI', 'da-DK'],
      availableMarkets: ['se', 'de'],
      imageBaseUrl: 'https://sonoralab.commerce.services',
      assetBaseUrl: 'https://cdn.litium.media/sonoralab',
    });
    expect(storefrontKey(config, HOST)).toBe('sonoralab:1|se');
    expect([...collectAllHostnames(config!)]).toEqual([
      'sonoralab.litium.store',
      'sonoralab.staging.litium.store',
      'sonoralab.sales-portal.geins.dev',
    ]);
  });

  it('serves assetPath without asking the channel for its asset host', async () => {
    const config = await resolve(newShape());
    expect(config).not.toBeNull();
    await publicConfigFor(config!);
    expect(mockGetChannel).not.toHaveBeenCalled();
  });

  it('never reads the old fields: wrong values there change nothing', async () => {
    const expected = await publicConfigFor((await resolve(newShape()))!);

    const answer = structuredClone(prodAnswerFixture) as Answer;
    answer.tenantId = 'wrong-tenant';
    answer.isActive = false;
    answer.geinsSettings = {
      defaultHostName: 'wrong.example',
      additionalHostNames: ['wrong-alias.example'],
      apiKey: 'wrong',
      accountName: 'wrong-account',
      channelId: '9|xx',
      defaultLocale: 'xx-XX',
      defaultMarket: 'xx',
      locales: ['xx-XX'],
      markets: ['xx'],
    };
    const config = await resolve(answer);

    expect(config).not.toBeNull();
    expect(await publicConfigFor(config!)).toEqual(expected);
    expect(storefrontKey(config, HOST)).toBe('sonoralab:1|se');
  });

  it('reads the new fields: a change there changes the config', async () => {
    const answer = structuredClone(prodAnswerFixture) as Answer & {
      channelSettings: Record<string, unknown>;
    };
    answer.accountName = 'other-account';
    answer.channelSettings.defaultLocale = 'en-GB';
    const config = await resolve(answer);

    const publicConfig = await publicConfigFor(config!);
    expect(publicConfig?.tenantId).toBe('other-account');
    expect(publicConfig?.locale).toBe('en-GB');
  });

  describe('an answer without channelSettings', () => {
    function withoutChannelSettings(): Answer {
      const answer = structuredClone(prodAnswerFixture) as Answer;
      delete answer.channelSettings;
      return answer;
    }

    it('does not resolve, even with the old fields present', async () => {
      const trace: TenantResolutionTrace = {
        hostname: HOST,
        kv: 'miss',
        outcome: 'unknown-tenant',
      };
      stubAnswer(withoutChannelSettings());
      expect(await fetchTenantConfig(HOST, undefined, trace)).toBeNull();
      expect(trace.outcome).toBe('invalid-config');
    });

    it('is logged as an error naming the missing field', async () => {
      await resolve(withoutChannelSettings());
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('channelSettings'),
        undefined,
        { hostname: HOST },
      );
      // Not mistaken for a hostname the payload does not register.
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('Hostname not registered'),
        expect.anything(),
      );
    });

    it('is negative-cached like any invalid answer', async () => {
      const host = 'no-channel.example';
      clearNegativeCache(host);
      const fetchSpy = stubAnswer(withoutChannelSettings());
      const first = await resolveTenantOutcome(host);
      const second = await resolveTenantOutcome(host);
      expect(first).toEqual({ config: null, outcome: 'invalid-config' });
      expect(second).toEqual({ config: null, outcome: 'negative-cache' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      clearNegativeCache(host);
    });

    it('in preview, the side without it is dropped and the other one serves', async () => {
      const live = newShape();
      const preview = withoutChannelSettings();
      globalThis.fetch = vi.fn((url: string) =>
        Promise.resolve(
          okResponse(url.includes('previewKey=preview') ? preview : live),
        ),
      ) as unknown as typeof fetch;

      const config = await resolvePreviewTenant(HOST);
      expect(config).not.toBeNull();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('falling back to live'),
      );
    });

    it('in preview, neither side having it gives no config', async () => {
      stubAnswer(withoutChannelSettings());
      expect(await resolvePreviewTenant(HOST)).toBeNull();
    });
  });

  describe('assetPath', () => {
    it('null: no asset base URL and no channel read', async () => {
      const answer = newShape();
      answer.assetPath = null;
      const publicConfig = await publicConfigFor((await resolve(answer))!);
      expect(publicConfig).not.toHaveProperty('assetBaseUrl');
      expect(mockGetChannel).not.toHaveBeenCalled();
    });

    it('absent: no asset base URL and no channel read', async () => {
      const answer = newShape();
      delete answer.assetPath;
      const publicConfig = await publicConfigFor((await resolve(answer))!);
      expect(publicConfig).not.toHaveProperty('assetBaseUrl');
      expect(mockGetChannel).not.toHaveBeenCalled();
    });

    it('not a string: the storefront resolves without an asset base URL', async () => {
      const answer = newShape();
      answer.assetPath = 42;
      const config = await resolve(answer);
      expect(config).not.toBeNull();
      expect(await publicConfigFor(config!)).not.toHaveProperty('assetBaseUrl');
    });

    it('empty: no asset base URL and no channel read', async () => {
      const answer = newShape();
      answer.assetPath = '';
      const publicConfig = await publicConfigFor((await resolve(answer))!);
      expect(publicConfig).not.toHaveProperty('assetBaseUrl');
      expect(mockGetChannel).not.toHaveBeenCalled();
    });
  });

  describe('appSettings cannot carry identity or routing', () => {
    it('keeps the root account, key and asset path over appSettings', async () => {
      const answer = newShape();
      Object.assign(answer.appSettings, {
        tenantId: 'from-app-settings',
        accountName: 'from-app-settings',
        apiKey: 'from-app-settings',
        assetPath: 'https://from-app-settings.example',
        isActive: false,
      });
      const config = await resolve(answer);

      expect(config).not.toBeNull();
      const publicConfig = await publicConfigFor(config!);
      expect(publicConfig?.tenantId).toBe('sonoralab');
      expect(publicConfig?.assetBaseUrl).toBe(
        'https://cdn.litium.media/sonoralab',
      );
      expect(storefrontKey(config, HOST)).toBe('sonoralab:1|se');
    });

    it('routes on channelSettings alone, not on legacy appSettings hosts or a channelSettings there', async () => {
      const answer = newShape();
      Object.assign(answer.appSettings, {
        hostname: 'legacy.example',
        aliases: ['legacy-alias.example'],
        channelSettings: {
          channelId: '9|xx',
          defaultHostName: 'claimed.example',
          hostNames: ['claimed.example'],
        },
      });
      const config = await resolve(answer);

      expect([...collectAllHostnames(config!)]).toEqual([
        'sonoralab.litium.store',
        'sonoralab.staging.litium.store',
        'sonoralab.sales-portal.geins.dev',
      ]);
      expect(storefrontKey(config, HOST)).toBe('sonoralab:1|se');
    });
  });

  describe('channelSettings tolerances', () => {
    it.each(['locales', 'markets'] as const)(
      '%s sent as null resolves as an empty list',
      async (field) => {
        const answer = newShape();
        answer.channelSettings[field] = null;
        const config = await resolve(answer);
        expect(config).not.toBeNull();
        const publicConfig = await publicConfigFor(config!);
        const key =
          field === 'locales' ? 'availableLocales' : 'availableMarkets';
        expect(publicConfig?.[key]).toEqual([]);
      },
    );

    it('hostNames sent as null resolves with no aliases', async () => {
      const answer = newShape();
      answer.channelSettings.hostNames = null;
      const config = await resolve(answer);
      expect(config).not.toBeNull();
      expect(config?.hostname).toBe(HOST);
      expect(config?.aliases).toEqual([]);
    });

    it('drops the default host from the aliases when hostNames repeats it', async () => {
      const answer = newShape();
      answer.channelSettings.hostNames = [
        'sonoralab.litium.store',
        'other.example',
        'other.example',
      ];
      const config = await resolve(answer);
      expect(config?.aliases).toEqual(['other.example']);
    });

    it('an empty defaultHostName falls back to the legacy appSettings.hostname', async () => {
      const answer = newShape();
      answer.channelSettings.defaultHostName = '';
      answer.channelSettings.hostNames = [];
      answer.appSettings.hostname = 'legacy.example';
      const config = await resolve(answer, 'legacy.example');
      expect(config?.hostname).toBe('legacy.example');
    });

    it('a defaultHostName that is not a string falls back to the legacy appSettings.hostname', async () => {
      const answer = newShape();
      answer.channelSettings.defaultHostName = 42;
      answer.channelSettings.hostNames = [];
      answer.appSettings.hostname = 'legacy.example';
      const config = await resolve(answer, 'legacy.example');
      expect(config?.hostname).toBe('legacy.example');
    });

    it('an empty account name keeps the storefront key on the hostname', async () => {
      const answer = newShape();
      answer.accountName = '';
      const config = await resolve(answer);
      expect(config).not.toBeNull();
      expect(storefrontKey(config, HOST)).toBe(HOST);
    });

    it('an empty channel keeps the storefront key on the hostname', async () => {
      const answer = newShape();
      answer.channelSettings.channelId = '|';
      const config = await resolve(answer);
      expect(config).not.toBeNull();
      expect(storefrontKey(config, HOST)).toBe(HOST);
    });

    it('a channelId without a separator does not resolve, as today', async () => {
      const answer = newShape();
      answer.channelSettings.channelId = '1';
      expect(await resolve(answer)).toBeNull();
    });
  });

  describe('a missing root identity does not resolve', () => {
    it.each(['accountName', 'apiKey'] as const)('%s', async (field) => {
      const answer = newShape();
      Reflect.deleteProperty(answer, field);
      expect(await resolve(answer)).toBeNull();
    });
  });
});
