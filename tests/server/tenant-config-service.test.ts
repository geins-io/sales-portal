import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';

const { mockGetChannel, mockLoggerWarn } = vi.hoisted(() => ({
  mockGetChannel: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));
vi.mock('../../server/services/channels', () => ({
  getChannel: (...args: unknown[]) => mockGetChannel(...args),
}));
vi.mock('../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockTenantConfig: TenantConfig = {
  tenantId: 'test-tenant',
  hostname: 'test.example.com',
  geinsSettings: {
    apiKey: 'test-key',
    accountName: 'test-account',
    channel: '1',
    tld: 'se',
    locale: 'sv-SE',
    market: 'se',
    environment: 'production',
    availableLocales: ['sv-SE'],
    availableMarkets: ['se'],
  },
  mode: 'commerce',
  checkoutMode: 'custom',
  timezone: 'Europe/Stockholm',
  theme: {
    name: 'test-theme',
    colors: {
      primary: 'oklch(0.5 0.1 200)',
      primaryForeground: 'oklch(0.9 0 0)',
      secondary: 'oklch(0.8 0 0)',
      secondaryForeground: 'oklch(0.2 0 0)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.1 0 0)',
    },
    radius: '0.625rem',
  },
  branding: {
    name: 'Test Brand',
    watermark: 'minimal',
    logoUrl: 'https://example.com/logo.png',
  },
  features: {
    search: { enabled: true },
    cart: { enabled: true, access: 'authenticated' },
    wishlist: { enabled: false },
    quotes: { enabled: true, access: 'authenticated' },
  },
  seo: {
    defaultTitle: 'Test Store',
    titleTemplate: '%s | Test Store',
  },
  contact: {
    email: 'test@example.com',
    phone: '+46 8 123 456',
  },
  overrides: {
    css: { '--custom': 'value' },
    features: { staffPricing: { enabled: true, access: 'authenticated' } },
  },
  css: '[data-theme=test] { --primary: oklch(0.5 0.1 200); }',
  themeHash: 'hash123',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

const createMockEvent = (config: TenantConfig = mockTenantConfig): H3Event =>
  ({
    context: {
      tenant: {
        hostname: 'test.example.com',
        tenantId: 'test-tenant',
        config,
      },
    },
  }) as unknown as H3Event;

describe('Tenant Config Service', () => {
  let service: typeof import('../../server/services/tenant-config');

  beforeEach(async () => {
    vi.resetModules();
    mockGetChannel.mockReset();
    mockGetChannel.mockResolvedValue({ assetHost: null });
    mockLoggerWarn.mockReset();
    service = await import('../../server/services/tenant-config');
  });

  describe('getConfig', () => {
    it('should return the full tenant config', async () => {
      const config = await service.getConfig(createMockEvent());
      expect(config).toEqual(mockTenantConfig);
    });
  });

  describe('getTheme', () => {
    it('should return the theme section', async () => {
      const theme = await service.getTheme(createMockEvent());
      expect(theme).toEqual(mockTenantConfig.theme);
    });
  });

  describe('getBranding', () => {
    it('should return the branding section', async () => {
      const branding = await service.getBranding(createMockEvent());
      expect(branding).toEqual(mockTenantConfig.branding);
    });
  });

  describe('getFeatures', () => {
    it('should return features record', async () => {
      const features = await service.getFeatures(createMockEvent());
      expect(features).toEqual(mockTenantConfig.features);
    });
  });

  describe('getSeo', () => {
    it('should return seo config', async () => {
      const seo = await service.getSeo(createMockEvent());
      expect(seo).toEqual(mockTenantConfig.seo);
    });
  });

  describe('getContact', () => {
    it('should return contact config', async () => {
      const contact = await service.getContact(createMockEvent());
      expect(contact).toEqual(mockTenantConfig.contact);
    });
  });

  describe('getMode', () => {
    it('should return the mode', async () => {
      const mode = await service.getMode(createMockEvent());
      expect(mode).toBe('commerce');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled feature', async () => {
      expect(await service.isFeatureEnabled(createMockEvent(), 'search')).toBe(
        true,
      );
    });

    it('should return true for enabled feature with access control', async () => {
      expect(await service.isFeatureEnabled(createMockEvent(), 'cart')).toBe(
        true,
      );
    });

    it('should return false for disabled feature', async () => {
      expect(
        await service.isFeatureEnabled(createMockEvent(), 'wishlist'),
      ).toBe(false);
    });

    it('should return false for nonexistent feature', async () => {
      expect(
        await service.isFeatureEnabled(createMockEvent(), 'nonexistent'),
      ).toBe(false);
    });
  });

  describe('getPublicConfig', () => {
    it('should strip geinsSettings', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(pub).toBeDefined();
      expect(
        (pub as unknown as Record<string, unknown>).geinsSettings,
      ).toBeUndefined();
    });

    it('should strip overrides', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(
        (pub as unknown as Record<string, unknown>).overrides,
      ).toBeUndefined();
    });

    it('should strip themeHash', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(
        (pub as unknown as Record<string, unknown>).themeHash,
      ).toBeUndefined();
    });

    it('should strip createdAt and updatedAt', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(
        (pub as unknown as Record<string, unknown>).createdAt,
      ).toBeUndefined();
      expect(
        (pub as unknown as Record<string, unknown>).updatedAt,
      ).toBeUndefined();
    });

    it('should include timezone', async () => {
      // The server-to-client hop for this field: without the mapping in
      // getPublicConfig the tenant's zone never reaches the browser, and a
      // client test that injects it into mocked public data would still pass.
      const pub = await service.getPublicConfig(createMockEvent());
      expect(pub?.timezone).toBe('Europe/Stockholm');
    });

    it('should include locale from geinsSettings', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(pub?.locale).toBe('sv-SE');
    });

    it('should include availableLocales', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(pub?.availableLocales).toEqual(['sv-SE']);
    });

    it('should include theme, branding, features, seo, contact, css', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(pub?.theme).toEqual(mockTenantConfig.theme);
      expect(pub?.branding).toEqual(mockTenantConfig.branding);
      expect(pub?.features).toEqual(mockTenantConfig.features);
      expect(pub?.seo).toEqual(mockTenantConfig.seo);
      expect(pub?.contact).toEqual(mockTenantConfig.contact);
      expect(pub?.css).toBe(mockTenantConfig.css);
    });

    it('should include mode', async () => {
      const pub = await service.getPublicConfig(createMockEvent());
      expect(pub?.mode).toBe('commerce');
    });

    describe('assetBaseUrl', () => {
      it("is the channel's asset host", async () => {
        mockGetChannel.mockResolvedValue({
          assetHost: 'https://cdn.example.test/acme',
        });
        const event = createMockEvent();

        const pub = await service.getPublicConfig(event);

        expect(pub?.assetBaseUrl).toBe('https://cdn.example.test/acme');
        expect(mockGetChannel).toHaveBeenCalledWith(event, {
          timeoutMs: 3_000,
        });
      });

      it.each([null, undefined, '', 42])(
        'is absent when the channel host is %s',
        async (assetHost) => {
          mockGetChannel.mockResolvedValue({ assetHost });

          const pub = await service.getPublicConfig(createMockEvent());

          expect(pub).not.toHaveProperty('assetBaseUrl');
        },
      );

      it('is absent when the channel is missing', async () => {
        mockGetChannel.mockResolvedValue(null);

        const pub = await service.getPublicConfig(createMockEvent());

        expect(pub).not.toHaveProperty('assetBaseUrl');
        expect(mockLoggerWarn).not.toHaveBeenCalled();
      });

      it('does not ask for the channel without Geins settings', async () => {
        const pub = await service.getPublicConfig(
          createMockEvent({
            ...mockTenantConfig,
            geinsSettings: undefined,
          } as unknown as TenantConfig),
        );

        expect(mockGetChannel).not.toHaveBeenCalled();
        expect(pub).not.toHaveProperty('assetBaseUrl');
      });

      it('serves the config without a host when the channel cannot be read', async () => {
        mockGetChannel.mockRejectedValue(new Error('timeout'));

        const pub = await service.getPublicConfig(createMockEvent());

        expect(pub?.tenantId).toBe('test-tenant');
        expect(pub).not.toHaveProperty('assetBaseUrl');
        expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          expect.stringContaining('without the asset host'),
          { hostname: 'test.example.com', storefront: 'test-account:1|se' },
        );
      });
    });

    describe('assetHostRetryDue', () => {
      const failRead = () =>
        mockGetChannel.mockRejectedValueOnce(new Error('timeout'));

      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('is due before the first read', () => {
        expect(service.assetHostRetryDue(createMockEvent())).toBe(true);
      });

      // The handler asks before it runs, also for a host with no tenant.
      it('is never due for a host without a tenant config', () => {
        const event = {
          context: { tenant: { hostname: 'nope.example.com', config: null } },
        } as unknown as H3Event;

        expect(service.assetHostRetryDue(event)).toBe(false);
      });

      it('is never due without Geins settings', async () => {
        const event = createMockEvent({
          ...mockTenantConfig,
          geinsSettings: undefined,
        } as unknown as TenantConfig);

        await service.getPublicConfig(event);

        expect(service.assetHostRetryDue(event)).toBe(false);
      });

      it('is not due after a read that found a host', async () => {
        mockGetChannel.mockResolvedValue({
          assetHost: 'https://cdn.example.test/acme',
        });
        const event = createMockEvent();

        await service.getPublicConfig(event);

        expect(service.assetHostRetryDue(event)).toBe(false);
      });

      it('is not due after a read that found no host, so that config stays cached', async () => {
        const event = createMockEvent();

        await service.getPublicConfig(event);
        vi.advanceTimersByTime(60 * 60 * 1000);

        expect(service.assetHostRetryDue(event)).toBe(false);
      });

      it('is due 30 s after a failed read, not before', async () => {
        failRead();
        const event = createMockEvent();

        await service.getPublicConfig(event);
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS - 1);
        expect(service.assetHostRetryDue(event)).toBe(false);

        vi.advanceTimersByTime(1);
        expect(service.ASSET_HOST_RETRY_MS).toBe(30_000);
        expect(service.assetHostRetryDue(event)).toBe(true);
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          expect.stringContaining('read again in 30 s'),
          expect.anything(),
        );
      });

      it('waits another 30 s after a retry that fails too', async () => {
        failRead();
        failRead();
        const event = createMockEvent();
        await service.getPublicConfig(event);
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS);

        await service.getPublicConfig(event);
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS - 1);
        expect(service.assetHostRetryDue(event)).toBe(false);

        vi.advanceTimersByTime(1);
        expect(service.assetHostRetryDue(event)).toBe(true);
      });

      it('stops retrying once a read answers', async () => {
        failRead();
        mockGetChannel.mockResolvedValue({
          assetHost: 'https://cdn.example.test/acme',
        });
        const event = createMockEvent();
        await service.getPublicConfig(event);
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS);

        const pub = await service.getPublicConfig(event);

        expect(pub?.assetBaseUrl).toBe('https://cdn.example.test/acme');
        expect(service.assetHostRetryDue(event)).toBe(false);
      });

      it('keeps the host it read when a later read fails', async () => {
        mockGetChannel.mockResolvedValueOnce({
          assetHost: 'https://cdn.example.test/acme',
        });
        failRead();
        const event = createMockEvent();
        await service.getPublicConfig(event);

        const pub = await service.getPublicConfig(event);

        expect(pub?.assetBaseUrl).toBe('https://cdn.example.test/acme');
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          expect.stringContaining('the last read asset host'),
          { hostname: 'test.example.com', storefront: 'test-account:1|se' },
        );
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS);
        expect(service.assetHostRetryDue(event)).toBe(false);
        failRead();
        const again = await service.getPublicConfig(event);
        expect(again?.assetBaseUrl).toBe('https://cdn.example.test/acme');
      });

      it('keeps a channel without a host as read when a later read fails', async () => {
        failRead();
        const event = createMockEvent();
        await service.getPublicConfig(event);
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS);
        await service.getPublicConfig(event);
        failRead();

        const pub = await service.getPublicConfig(event);

        expect(pub).not.toHaveProperty('assetBaseUrl');
        vi.advanceTimersByTime(service.ASSET_HOST_RETRY_MS);
        expect(service.assetHostRetryDue(event)).toBe(false);
      });

      it('keeps reads apart per storefront', async () => {
        await service.getPublicConfig(createMockEvent());

        const other = createMockEvent({
          ...mockTenantConfig,
          geinsSettings: { ...mockTenantConfig.geinsSettings!, channel: '2' },
        });

        expect(service.assetHostRetryDue(other)).toBe(true);
      });

      it('forgets a storefront read when cleared', async () => {
        mockGetChannel.mockResolvedValueOnce({
          assetHost: 'https://cdn.example.test/acme',
        });
        failRead();
        const event = createMockEvent();
        await service.getPublicConfig(event);

        service.clearAssetHost('test-account:1|se');

        expect(service.assetHostRetryDue(event)).toBe(true);
        const pub = await service.getPublicConfig(event);
        expect(pub).not.toHaveProperty('assetBaseUrl');
      });
    });
  });
});
