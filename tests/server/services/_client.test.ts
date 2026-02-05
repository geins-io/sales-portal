import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import type { GeinsSettings } from '#shared/types/tenant-config';

// Mock SDK constructors — must be classes so `new` works
const mockGeinsCore = vi.fn();
const mockGeinsCRM = vi.fn();
const mockGeinsCMS = vi.fn();
const mockGeinsOMS = vi.fn();

vi.mock('@geins/core', () => ({
  GeinsCore: class {
    geinsSettings: unknown;
    graphql = { query: vi.fn(), mutation: vi.fn() };
    constructor(...args: unknown[]) {
      mockGeinsCore(...args);
      this.geinsSettings = args[0];
    }
  },
}));

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
const mockGetTenant = vi.fn();
const mockCreateAppError = vi.fn((_code: string, message: string) => {
  const err = new Error(message);
  (err as Error & { statusCode: number }).statusCode = 400;
  return err;
});

vi.stubGlobal('getTenant', mockGetTenant);
vi.stubGlobal('createAppError', mockCreateAppError);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
});

const MOCK_GEINS_SETTINGS: GeinsSettings = {
  apiKey: 'test-api-key',
  accountName: 'test-account',
  channel: '1',
  tld: 'se',
  locale: 'sv-SE',
  market: 'se',
};

function createEvent(tenantHostname?: string): H3Event {
  return {
    context: {
      tenant: tenantHostname ? { hostname: tenantHostname } : undefined,
    },
  } as unknown as H3Event;
}

describe('server/services/_client', () => {
  let createGeinsClient: typeof import('../../../server/services/_client').createGeinsClient;
  let getGeinsClient: typeof import('../../../server/services/_client').getGeinsClient;
  let getChannelVariables: typeof import('../../../server/services/_client').getChannelVariables;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../../server/services/_client');
    createGeinsClient = mod.createGeinsClient;
    getGeinsClient = mod.getGeinsClient;
    getChannelVariables = mod.getChannelVariables;
  });

  describe('createGeinsClient', () => {
    it('should create all four SDK instances', () => {
      const client = createGeinsClient(MOCK_GEINS_SETTINGS);

      expect(client).toHaveProperty('core');
      expect(client).toHaveProperty('crm');
      expect(client).toHaveProperty('cms');
      expect(client).toHaveProperty('oms');
    });

    it('should pass mapped settings to GeinsCore', () => {
      createGeinsClient(MOCK_GEINS_SETTINGS);

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
      createGeinsClient({ ...MOCK_GEINS_SETTINGS, environment: 'production' });

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'prod' }),
      );
    });

    it('should map staging environment to qa', () => {
      createGeinsClient({ ...MOCK_GEINS_SETTINGS, environment: 'staging' });

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'qa' }),
      );
    });

    it('should default to prod when environment is undefined', () => {
      const settings = { ...MOCK_GEINS_SETTINGS };
      delete (settings as Partial<GeinsSettings>).environment;
      createGeinsClient(settings);

      expect(mockGeinsCore).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'prod' }),
      );
    });

    it('should initialize CRM with Direct connection mode', () => {
      createGeinsClient(MOCK_GEINS_SETTINGS);

      expect(mockGeinsCRM).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clientConnectionMode: 'Direct' }),
      );
    });

    it('should initialize OMS with server context', () => {
      createGeinsClient(MOCK_GEINS_SETTINGS);

      expect(mockGeinsOMS).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          omsSettings: expect.objectContaining({ context: 'server' }),
        }),
      );
    });

    it('should return fresh instances on each call', () => {
      const client1 = createGeinsClient(MOCK_GEINS_SETTINGS);
      const client2 = createGeinsClient(MOCK_GEINS_SETTINGS);

      expect(client1).not.toBe(client2);
      expect(client1.core).not.toBe(client2.core);
    });
  });

  describe('getGeinsClient', () => {
    it('should throw when event has no tenant context', async () => {
      const event = { context: {} } as unknown as H3Event;

      await expect(getGeinsClient(event)).rejects.toThrow(
        'No tenant context on request',
      );
    });

    it('should throw when tenant has no geinsSettings', async () => {
      mockGetTenant.mockResolvedValue({ hostname: 'test.com' });
      const event = createEvent('test.com');

      await expect(getGeinsClient(event)).rejects.toThrow(
        'Tenant has no Geins SDK configuration',
      );
    });

    it('should throw when getTenant returns null', async () => {
      mockGetTenant.mockResolvedValue(null);
      const event = createEvent('test.com');

      await expect(getGeinsClient(event)).rejects.toThrow(
        'Tenant has no Geins SDK configuration',
      );
    });

    it('should create client from tenant geinsSettings', async () => {
      mockGetTenant.mockResolvedValue({
        hostname: 'test.com',
        geinsSettings: MOCK_GEINS_SETTINGS,
      });
      const event = createEvent('test.com');

      const client = await getGeinsClient(event);

      expect(mockGetTenant).toHaveBeenCalledWith('test.com', event);
      expect(client).toHaveProperty('core');
      expect(client).toHaveProperty('crm');
      expect(client).toHaveProperty('cms');
      expect(client).toHaveProperty('oms');
    });

    it('should return cached client for the same tenant', async () => {
      mockGetTenant.mockResolvedValue({
        hostname: 'test.com',
        geinsSettings: MOCK_GEINS_SETTINGS,
      });

      const client1 = await getGeinsClient(createEvent('test.com'));
      const client2 = await getGeinsClient(createEvent('test.com'));

      expect(client1).toBe(client2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(1);
    });

    it('should create separate clients for different tenants', async () => {
      mockGetTenant.mockImplementation((hostname: string) =>
        Promise.resolve({
          hostname,
          geinsSettings: { ...MOCK_GEINS_SETTINGS, accountName: hostname },
        }),
      );

      const client1 = await getGeinsClient(createEvent('tenant-a.com'));
      const client2 = await getGeinsClient(createEvent('tenant-b.com'));

      expect(client1).not.toBe(client2);
      expect(mockGeinsCore).toHaveBeenCalledTimes(2);
    });
  });

  describe('getChannelVariables', () => {
    it('should extract channel, locale, and market from SDK settings', () => {
      const client = createGeinsClient(MOCK_GEINS_SETTINGS);
      const vars = getChannelVariables(client);

      expect(vars).toEqual({
        channelId: '1',
        languageId: 'sv-SE',
        marketId: 'se',
      });
    });
  });
});
