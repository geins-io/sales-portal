import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';

// Mock SDK constructors — must be classes so `new` works
const mockGeinsCore = vi.fn();
const mockGeinsCRM = vi.fn();
const mockGeinsCMS = vi.fn();
const mockGeinsOMS = vi.fn();

vi.mock('@geins/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@geins/core')>();
  return {
    ...original,
    GeinsCore: class {
      geinsSettings: unknown;
      graphql = { query: vi.fn(), mutation: vi.fn() };
      constructor(...args: unknown[]) {
        mockGeinsCore(...args);
        this.geinsSettings = args[0];
      }
    },
  };
});

vi.mock('@geins/crm', () => ({
  GeinsCRM: class {
    auth = {};
    user = {};
    constructor(...args: unknown[]) {
      mockGeinsCRM(...args);
    }
  },
}));

vi.mock('@geins/cms', () => ({
  GeinsCMS: class {
    menu = {};
    page = {};
    area = {};
    constructor(...args: unknown[]) {
      mockGeinsCMS(...args);
    }
  },
}));

vi.mock('@geins/oms', () => ({
  GeinsOMS: class {
    cart = {};
    checkout = {};
    order = {};
    constructor(...args: unknown[]) {
      mockGeinsOMS(...args);
    }
  },
}));

vi.mock('@geins/types', () => ({
  RuntimeContext: { SERVER: 'server' },
}));

// Mock Nitro auto-imports
const mockResolveTenant = vi.fn();
const mockCreateAppError = vi.fn((_code: string, message: string) => {
  const err = new Error(message);
  (err as Error & { statusCode: number }).statusCode = 400;
  return err;
});

const mockGetRequestLocale = vi.fn();
const mockGetRequestMarket = vi.fn();

vi.stubGlobal('resolveTenant', mockResolveTenant);
vi.stubGlobal('createAppError', mockCreateAppError);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
});
type AuthCookies = { authToken?: string; refreshToken?: string };
const mockGetAuthCookies = vi.fn((): AuthCookies => ({}));

vi.stubGlobal('getRequestLocale', mockGetRequestLocale);
vi.stubGlobal('getRequestMarket', mockGetRequestMarket);
vi.stubGlobal('getAuthCookies', mockGetAuthCookies);
const mockGetSessionToken = vi.fn();
vi.stubGlobal('getSessionToken', mockGetSessionToken);

// The configurator's runtime keys; undefined reads as `off`.
const mockBackendValue = vi.fn((): unknown => undefined);
const mockMerchantApiUrl = vi.fn((): unknown => undefined);
vi.mock('../../../server/services/configurator-config', () => ({
  readConfiguratorBackendValue: () => mockBackendValue(),
  readConfiguratorMerchantApiUrl: () => mockMerchantApiUrl(),
}));

const CPQ_API_URL = 'https://cpq-merchant-api.example.test/graphql';

const MOCK_STORE_SETTINGS: Pick<
  TenantConfig,
  'accountName' | 'apiKey' | 'channelSettings'
> = {
  accountName: 'test-account',
  apiKey: 'test-api-key',
  channelSettings: {
    channelId: '1|se',
    defaultLocale: 'sv-SE',
    defaultMarket: 'se',
    locales: ['sv-SE'],
    markets: ['se'],
  },
};

function createEvent(tenantHostname?: string): H3Event {
  return {
    context: {
      tenant: tenantHostname ? { hostname: tenantHostname } : undefined,
    },
  } as unknown as H3Event;
}

describe('server/services/_sdk', () => {
  let createTenantSDK: typeof import('../../../server/services/_sdk').createTenantSDK;
  let getTenantSDK: typeof import('../../../server/services/_sdk').getTenantSDK;
  let getChannelVariables: typeof import('../../../server/services/_sdk').getChannelVariables;
  let getRequestChannelVariables: typeof import('../../../server/services/_sdk').getRequestChannelVariables;
  let buildRequestContext: typeof import('../../../server/services/_sdk').buildRequestContext;
  let resolveSdkApiUrl: typeof import('../../../server/services/_sdk').resolveSdkApiUrl;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../../server/services/_sdk');
    createTenantSDK = mod.createTenantSDK;
    getTenantSDK = mod.getTenantSDK;
    getChannelVariables = mod.getChannelVariables;
    getRequestChannelVariables = mod.getRequestChannelVariables;
    buildRequestContext = mod.buildRequestContext;
    resolveSdkApiUrl = mod.resolveSdkApiUrl;
    mockGetAuthCookies.mockReturnValue({});
    mockBackendValue.mockReturnValue(undefined);
    mockMerchantApiUrl.mockReturnValue(undefined);
  });

  describe('createTenantSDK', () => {
    it('should create all four SDK instances', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);

      expect(sdk).toHaveProperty('core');
      expect(sdk).toHaveProperty('crm');
      expect(sdk).toHaveProperty('cms');
      expect(sdk).toHaveProperty('oms');
    });

    it('should pass mapped settings to GeinsCore', () => {
      createTenantSDK(MOCK_STORE_SETTINGS);

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          accountName: 'test-account',
          channel: '1',
          tld: 'se',
          locale: 'sv-SE',
          market: 'se',
          environment: 'prod',
        }),
      );
    });

    it('bounds every Geins call at the portal limit and reports a timeout', async () => {
      const { GEINS_REQUEST_TIMEOUT_MS } =
        await import('../../../server/utils/outbound-timeouts');
      createTenantSDK(MOCK_STORE_SETTINGS);

      const settings = mockGeinsCore.mock.calls[0]![0] as {
        requestConfig?: {
          timeoutMs?: number;
          interceptors?: { onError?: unknown };
        };
      };
      expect(settings.requestConfig?.timeoutMs).toBe(GEINS_REQUEST_TIMEOUT_MS);
      expect(settings.requestConfig?.interceptors?.onError).toBeTypeOf(
        'function',
      );
    });

    it('names the account and channel when it reports a Geins timeout', async () => {
      const { logger } = await import('../../../server/utils/logger');
      const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      createTenantSDK(MOCK_STORE_SETTINGS);
      const settings = mockGeinsCore.mock.calls[0]![0] as {
        requestConfig: {
          interceptors: { onError: (context: unknown) => void };
        };
      };

      settings.requestConfig.interceptors.onError({
        error: Object.assign(new Error('timed out'), {
          code: 'REQUEST_TIMEOUT',
        }),
        operationName: 'getProduct',
        requestId: 'req-1',
        durationMs: 1,
      });

      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('getProduct'),
        expect.any(Error),
        expect.objectContaining({ tenantId: 'test-account', channel: '1|se' }),
      );
    });

    it('splits channelId into the channel and tld the SDK takes', () => {
      createTenantSDK({
        ...MOCK_STORE_SETTINGS,
        channelSettings: {
          ...MOCK_STORE_SETTINGS.channelSettings,
          channelId: '5|dk',
        },
      });

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ channel: '5', tld: 'dk' }),
      );
    });

    it('takes the first locale as the SDK locale, else the default locale', () => {
      const channelSettings = {
        ...MOCK_STORE_SETTINGS.channelSettings,
        defaultLocale: 'en-US',
      };
      createTenantSDK({
        ...MOCK_STORE_SETTINGS,
        channelSettings: { ...channelSettings, locales: ['sv-SE', 'en-US'] },
      });
      createTenantSDK({
        ...MOCK_STORE_SETTINGS,
        channelSettings: { ...channelSettings, locales: [] },
      });

      expect(mockGeinsCore.mock.calls[0]![0]).toMatchObject({
        locale: 'sv-SE',
      });
      expect(mockGeinsCore.mock.calls[1]![0]).toMatchObject({
        locale: 'en-US',
      });
    });

    it('should initialize CRM with Direct connection mode', () => {
      createTenantSDK(MOCK_STORE_SETTINGS);

      expect(mockGeinsCRM).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clientConnectionMode: 'Direct' }),
      );
    });

    it('should initialize OMS with server context', () => {
      createTenantSDK(MOCK_STORE_SETTINGS);

      expect(mockGeinsOMS).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          omsSettings: expect.objectContaining({ context: 'server' }),
        }),
      );
    });

    it('should return fresh instances on each call', () => {
      const sdk1 = createTenantSDK(MOCK_STORE_SETTINGS);
      const sdk2 = createTenantSDK(MOCK_STORE_SETTINGS);

      expect(sdk1).not.toBe(sdk2);
      expect(sdk1.core).not.toBe(sdk2.core);
    });
  });

  describe('getTenantSDK', () => {
    it('should throw when event has no tenant context', async () => {
      const event = { context: {} } as unknown as H3Event;

      await expect(getTenantSDK(event)).rejects.toThrow(
        'No tenant context on request',
      );
    });

    it('should throw when tenant has no channelSettings', async () => {
      mockResolveTenant.mockResolvedValue({
        accountName: 'test',
        hostname: 'test.com',
      });
      const event = createEvent('test.com');

      await expect(getTenantSDK(event)).rejects.toThrow(
        'Tenant has no Geins SDK configuration',
      );
    });

    it('should throw when resolveTenant returns null', async () => {
      mockResolveTenant.mockResolvedValue(null);
      const event = createEvent('test.com');

      await expect(getTenantSDK(event)).rejects.toThrow(
        'Tenant has no Geins SDK configuration',
      );
    });

    it('should create SDK from the tenant store settings', async () => {
      mockResolveTenant.mockResolvedValue({
        ...MOCK_STORE_SETTINGS,
        hostname: 'test.com',
      });
      const event = createEvent('test.com');

      const sdk = await getTenantSDK(event);

      expect(mockResolveTenant).toHaveBeenCalledWith('test.com', event);
      expect(sdk).toHaveProperty('core');
      expect(sdk).toHaveProperty('crm');
      expect(sdk).toHaveProperty('cms');
      expect(sdk).toHaveProperty('oms');
    });

    it('should return cached SDK for the same tenant', async () => {
      mockResolveTenant.mockResolvedValue({
        ...MOCK_STORE_SETTINGS,
        hostname: 'test.com',
      });

      const sdk1 = await getTenantSDK(createEvent('test.com'));
      const sdk2 = await getTenantSDK(createEvent('test.com'));

      expect(sdk1).toBe(sdk2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(1);
    });

    it('should create separate SDKs for different tenants', async () => {
      mockResolveTenant.mockImplementation((hostname: string) =>
        Promise.resolve({
          ...MOCK_STORE_SETTINGS,
          accountName: hostname,
          hostname,
        }),
      );

      const sdk1 = await getTenantSDK(createEvent('alpha.example'));
      const sdk2 = await getTenantSDK(createEvent('beta.example'));

      expect(sdk1).not.toBe(sdk2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(2);
    });

    it('should share SDK when two hostnames resolve to the same storefront', async () => {
      mockResolveTenant.mockResolvedValue({
        ...MOCK_STORE_SETTINGS,
        hostname: 'alias-a.com',
      });

      const sdk1 = await getTenantSDK(createEvent('alias-a.com'));
      const sdk2 = await getTenantSDK(createEvent('alias-b.com'));

      expect(sdk1).toBe(sdk2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(1);
    });
  });

  describe('SDK endpoint', () => {
    it('leaves apiUrl out of the SDK settings when none is given', () => {
      createTenantSDK(MOCK_STORE_SETTINGS);

      expect(mockGeinsCore.mock.calls[0]![0]).not.toHaveProperty('apiUrl');
    });

    it('passes apiUrl to GeinsCore when given', () => {
      createTenantSDK(MOCK_STORE_SETTINGS, CPQ_API_URL);

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ apiUrl: CPQ_API_URL }),
      );
    });

    it('resolves no endpoint on the fixture backend, even with a URL set', () => {
      mockBackendValue.mockReturnValue('fixture');
      mockMerchantApiUrl.mockReturnValue(CPQ_API_URL);

      expect(resolveSdkApiUrl(createEvent('test.com'))).toBeUndefined();
    });

    it.each([undefined, '', 'merchant-api'])(
      'resolves the configurator URL for backend %j',
      (backend) => {
        mockBackendValue.mockReturnValue(backend);
        mockMerchantApiUrl.mockReturnValue(CPQ_API_URL);

        expect(resolveSdkApiUrl(createEvent('test.com'))).toBe(CPQ_API_URL);
      },
    );

    it('resolves no endpoint on the merchant-api backend with an empty URL', () => {
      mockBackendValue.mockReturnValue('merchant-api');
      mockMerchantApiUrl.mockReturnValue('');

      expect(resolveSdkApiUrl(createEvent('test.com'))).toBeUndefined();
    });

    it('builds the tenant SDK on the configurator URL on the merchant-api backend', async () => {
      mockBackendValue.mockReturnValue('merchant-api');
      mockMerchantApiUrl.mockReturnValue(CPQ_API_URL);
      mockResolveTenant.mockResolvedValue({
        ...MOCK_STORE_SETTINGS,
        hostname: 'test.com',
      });

      await getTenantSDK(createEvent('test.com'));

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ apiUrl: CPQ_API_URL }),
      );
    });

    it('builds the tenant SDK without apiUrl on the fixture backend', async () => {
      mockBackendValue.mockReturnValue('fixture');
      mockMerchantApiUrl.mockReturnValue(CPQ_API_URL);
      mockResolveTenant.mockResolvedValue({
        ...MOCK_STORE_SETTINGS,
        hostname: 'test.com',
      });

      await getTenantSDK(createEvent('test.com'));

      expect(mockGeinsCore.mock.calls[0]![0]).not.toHaveProperty('apiUrl');
    });

    it('does not reuse a cached SDK built for another endpoint', async () => {
      mockResolveTenant.mockResolvedValue({
        ...MOCK_STORE_SETTINGS,
        hostname: 'test.com',
      });

      const onDefault = await getTenantSDK(createEvent('test.com'));
      mockBackendValue.mockReturnValue('merchant-api');
      mockMerchantApiUrl.mockReturnValue(CPQ_API_URL);
      const onCpq = await getTenantSDK(createEvent('test.com'));
      const onCpqAgain = await getTenantSDK(createEvent('test.com'));

      expect(onCpq).not.toBe(onDefault);
      expect(onCpqAgain).toBe(onCpq);
      expect(mockGeinsCore).toHaveBeenCalledTimes(2);
    });
  });

  describe('getChannelVariables', () => {
    it('should extract channel, locale, and market from SDK settings', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const vars = getChannelVariables(sdk);

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });

    it('should use BCP-47 localeOverride when provided', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const vars = getChannelVariables(sdk, 'en-US');

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'en-US',
        marketId: 'se',
      });
    });

    it('should expand short locale override matching SDK locale prefix', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const vars = getChannelVariables(sdk, 'sv');

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });

    it('should fall back to SDK locale for unknown short locale', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const vars = getChannelVariables(sdk, 'de');

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });

    it('should use marketOverride when provided', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const vars = getChannelVariables(sdk, undefined, 'no');

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'no',
      });
    });

    it('should use both overrides when provided', () => {
      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const vars = getChannelVariables(sdk, 'en-US', 'no');

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'en-US',
        marketId: 'no',
      });
    });
  });

  describe('getRequestChannelVariables', () => {
    it('should use locale and market from request cookies', () => {
      mockGetRequestLocale.mockReturnValue('en-US');
      mockGetRequestMarket.mockReturnValue('no');

      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const event = createEvent('test.com');
      const vars = getRequestChannelVariables(sdk, event);

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'en-US',
        marketId: 'no',
      });
      expect(mockGetRequestLocale).toHaveBeenCalledWith(event);
      expect(mockGetRequestMarket).toHaveBeenCalledWith(event);
    });

    it('should fall back to SDK defaults when cookies are not set', () => {
      mockGetRequestLocale.mockReturnValue(undefined);
      mockGetRequestMarket.mockReturnValue(undefined);

      const sdk = createTenantSDK(MOCK_STORE_SETTINGS);
      const event = createEvent('test.com');
      const vars = getRequestChannelVariables(sdk, event);

      expect(vars).toEqual({
        channelId: '1|se',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });
  });

  describe('buildRequestContext', () => {
    it('returns undefined when nothing upstream set a locale, market or token', () => {
      mockGetRequestLocale.mockReturnValue(undefined);
      mockGetRequestMarket.mockReturnValue(undefined);

      expect(buildRequestContext(createEvent('test.com'))).toBeUndefined();
    });

    it('omits languageId entirely when no locale was requested', () => {
      // Absent, not undefined: an undefined key overrides the SDK default.
      mockGetRequestLocale.mockReturnValue(undefined);
      mockGetRequestMarket.mockReturnValue('se');

      const ctx = buildRequestContext(createEvent('test.com'));

      expect(ctx).toEqual({ marketId: 'se' });
      expect(ctx && 'languageId' in ctx).toBe(false);
      expect(ctx && 'userToken' in ctx).toBe(false);
    });

    it('omits marketId entirely when no market was requested', () => {
      mockGetRequestLocale.mockReturnValue('nb-NO');
      mockGetRequestMarket.mockReturnValue(undefined);

      const ctx = buildRequestContext(createEvent('test.com'));

      expect(ctx).toEqual({ languageId: 'nb-NO' });
      expect(ctx && 'marketId' in ctx).toBe(false);
    });

    it('passes the requested locale and market through when both are set', () => {
      mockGetRequestLocale.mockReturnValue('fi-FI');
      mockGetRequestMarket.mockReturnValue('fi');

      expect(buildRequestContext(createEvent('test.com'))).toEqual({
        languageId: 'fi-FI',
        marketId: 'fi',
      });
    });

    it('builds a context for an auth token alone', () => {
      mockGetRequestLocale.mockReturnValue(undefined);
      mockGetRequestMarket.mockReturnValue(undefined);
      mockGetSessionToken.mockReturnValue('token-123');

      expect(buildRequestContext(createEvent('test.com'))).toEqual({
        userToken: 'token-123',
      });
    });

    it('reads the session token, not the request cookie', () => {
      mockGetRequestLocale.mockReturnValue(undefined);
      mockGetRequestMarket.mockReturnValue(undefined);
      mockGetAuthCookies.mockReturnValue({ authToken: 'stale-cookie' });
      mockGetSessionToken.mockReturnValue('rotated');

      expect(buildRequestContext(createEvent('test.com'))).toEqual({
        userToken: 'rotated',
      });
    });
  });
});
