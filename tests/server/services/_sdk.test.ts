import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import type { GeinsSettings } from '#shared/types/tenant-config';

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
vi.stubGlobal('getRequestLocale', mockGetRequestLocale);
vi.stubGlobal('getRequestMarket', mockGetRequestMarket);

const MOCK_GEINS_SETTINGS: GeinsSettings = {
  apiKey: 'test-api-key',
  accountName: 'test-account',
  channel: '1',
  tld: 'se',
  locale: 'sv-SE',
  market: 'se',
  environment: 'production',
  availableLocales: ['sv-SE'],
  availableMarkets: ['se'],
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

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../../server/services/_sdk');
    createTenantSDK = mod.createTenantSDK;
    getTenantSDK = mod.getTenantSDK;
    getChannelVariables = mod.getChannelVariables;
    getRequestChannelVariables = mod.getRequestChannelVariables;
  });

  describe('createTenantSDK', () => {
    it('should create all four SDK instances', () => {
      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);

      expect(sdk).toHaveProperty('core');
      expect(sdk).toHaveProperty('crm');
      expect(sdk).toHaveProperty('cms');
      expect(sdk).toHaveProperty('oms');
    });

    it('should pass mapped settings to GeinsCore', () => {
      createTenantSDK(MOCK_GEINS_SETTINGS);

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

    it('should map production environment to prod', () => {
      createTenantSDK({ ...MOCK_GEINS_SETTINGS, environment: 'production' });

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'prod' }),
      );
    });

    it('should map staging environment to qa', () => {
      createTenantSDK({ ...MOCK_GEINS_SETTINGS, environment: 'staging' });

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'qa' }),
      );
    });

    it('should default to prod when environment is undefined', () => {
      const settings = { ...MOCK_GEINS_SETTINGS };
      delete (settings as Partial<GeinsSettings>).environment;
      createTenantSDK(settings);

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'prod' }),
      );
    });

    it('should initialize CRM with Direct connection mode', () => {
      createTenantSDK(MOCK_GEINS_SETTINGS);

      expect(mockGeinsCRM).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clientConnectionMode: 'Direct' }),
      );
    });

    it('should initialize OMS with server context', () => {
      createTenantSDK(MOCK_GEINS_SETTINGS);

      expect(mockGeinsOMS).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          omsSettings: expect.objectContaining({ context: 'server' }),
        }),
      );
    });

    it('should return fresh instances on each call', () => {
      const sdk1 = createTenantSDK(MOCK_GEINS_SETTINGS);
      const sdk2 = createTenantSDK(MOCK_GEINS_SETTINGS);

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

    it('should throw when tenant has no geinsSettings', async () => {
      mockResolveTenant.mockResolvedValue({
        tenantId: 'test',
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

    it('should create SDK from tenant geinsSettings', async () => {
      mockResolveTenant.mockResolvedValue({
        tenantId: 'test-tenant',
        hostname: 'test.com',
        geinsSettings: MOCK_GEINS_SETTINGS,
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
        tenantId: 'test-tenant',
        hostname: 'test.com',
        geinsSettings: MOCK_GEINS_SETTINGS,
      });

      const sdk1 = await getTenantSDK(createEvent('test.com'));
      const sdk2 = await getTenantSDK(createEvent('test.com'));

      expect(sdk1).toBe(sdk2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(1);
    });

    it('should create separate SDKs for different tenants', async () => {
      mockResolveTenant.mockImplementation((hostname: string) =>
        Promise.resolve({
          tenantId: hostname.replace('.com', ''),
          hostname,
          geinsSettings: { ...MOCK_GEINS_SETTINGS, accountName: hostname },
        }),
      );

      const sdk1 = await getTenantSDK(createEvent('tenant-a.com'));
      const sdk2 = await getTenantSDK(createEvent('tenant-b.com'));

      expect(sdk1).not.toBe(sdk2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(2);
    });

    it('should share SDK when two hostnames resolve to same tenantId', async () => {
      mockResolveTenant.mockResolvedValue({
        tenantId: 'shared-tenant',
        hostname: 'alias-a.com',
        geinsSettings: MOCK_GEINS_SETTINGS,
      });

      const sdk1 = await getTenantSDK(createEvent('alias-a.com'));
      const sdk2 = await getTenantSDK(createEvent('alias-b.com'));

      expect(sdk1).toBe(sdk2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(1);
    });
  });

  describe('getChannelVariables', () => {
    it('should extract channel, locale, and market from SDK settings', () => {
      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);
      const vars = getChannelVariables(sdk);

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });

    it('should use localeOverride when provided', () => {
      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);
      const vars = getChannelVariables(sdk, 'en');

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'en',
        marketId: 'se',
      });
    });

    it('should use marketOverride when provided', () => {
      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);
      const vars = getChannelVariables(sdk, undefined, 'no');

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'sv-SE',
        marketId: 'no',
      });
    });

    it('should use both overrides when provided', () => {
      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);
      const vars = getChannelVariables(sdk, 'en', 'no');

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'en',
        marketId: 'no',
      });
    });
  });

  describe('getRequestChannelVariables', () => {
    it('should use locale and market from request cookies', () => {
      mockGetRequestLocale.mockReturnValue('en');
      mockGetRequestMarket.mockReturnValue('no');

      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);
      const event = createEvent('test.com');
      const vars = getRequestChannelVariables(sdk, event);

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'en',
        marketId: 'no',
      });
      expect(mockGetRequestLocale).toHaveBeenCalledWith(event);
      expect(mockGetRequestMarket).toHaveBeenCalledWith(event);
    });

    it('should fall back to SDK defaults when cookies are not set', () => {
      mockGetRequestLocale.mockReturnValue(undefined);
      mockGetRequestMarket.mockReturnValue(undefined);

      const sdk = createTenantSDK(MOCK_GEINS_SETTINGS);
      const event = createEvent('test.com');
      const vars = getRequestChannelVariables(sdk, event);

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });
  });
});
