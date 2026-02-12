import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';

// Mock the tenant utility
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
    quotes: { enabled: true, access: { role: 'order_placer' } },
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
    features: { staffPricing: { enabled: true, access: { group: 'staff' } } },
  },
  css: '[data-theme=test] { --primary: oklch(0.5 0.1 200); }',
  themeHash: 'hash123',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

vi.mock('../../server/utils/tenant', () => ({
  getTenant: vi.fn().mockResolvedValue(mockTenantConfig),
}));

const createMockEvent = (): H3Event =>
  ({
    context: {
      tenant: {
        id: 'test-tenant',
        hostname: 'test.example.com',
      },
    },
  }) as unknown as H3Event;

describe('Tenant Config Service', () => {
  let service: typeof import('../../server/services/tenant-config');

  beforeEach(async () => {
    vi.resetModules();
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
  });
});
