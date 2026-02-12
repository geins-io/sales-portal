import { describe, it, expect } from 'vitest';
import {
  buildSiteUrl,
  buildSocialLinks,
  isIndexable,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from '../../server/utils/seo';
import type { TenantConfig } from '../../shared/types/tenant-config';

function createMockConfig(overrides?: Partial<TenantConfig>): TenantConfig {
  return {
    tenantId: 'test-tenant',
    hostname: 'shop.example.com',
    geinsSettings: {
      apiKey: 'key',
      accountName: 'acct',
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
      name: 'default',
      colors: { primary: 'oklch(0.205 0 0)' },
    },
    branding: {
      name: 'Test Store',
      watermark: 'full',
      logoUrl: 'https://shop.example.com/logo.svg',
      ogImageUrl: 'https://shop.example.com/og.jpg',
    },
    features: {},
    seo: {
      defaultTitle: 'Test Store',
      titleTemplate: '%s | Test Store',
      defaultDescription: 'A great store for testing',
      defaultKeywords: ['test', 'store'],
      robots: 'index, follow',
      verification: { google: 'abc123', bing: 'def456' },
    },
    contact: {
      email: 'hello@example.com',
      phone: '+46 123 456',
      address: {
        street: '123 Main St',
        city: 'Stockholm',
        postalCode: '11122',
        country: 'SE',
      },
      social: {
        facebook: 'https://facebook.com/teststore',
        instagram: 'https://instagram.com/teststore',
        twitter: null,
        linkedin: 'https://linkedin.com/company/teststore',
        youtube: null,
      },
    },
    css: '',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SEO utilities', () => {
  describe('buildSiteUrl', () => {
    it('returns https URL from hostname', () => {
      expect(buildSiteUrl('shop.example.com')).toBe('https://shop.example.com');
    });

    it('handles localhost', () => {
      expect(buildSiteUrl('localhost')).toBe('https://localhost');
    });
  });

  describe('buildSocialLinks', () => {
    it('extracts non-null social URLs', () => {
      const links = buildSocialLinks({
        facebook: 'https://facebook.com/store',
        instagram: 'https://instagram.com/store',
        twitter: null,
        linkedin: null,
        youtube: 'https://youtube.com/store',
      });
      expect(links).toEqual([
        'https://facebook.com/store',
        'https://instagram.com/store',
        'https://youtube.com/store',
      ]);
    });

    it('returns empty array for null social', () => {
      expect(buildSocialLinks(null)).toEqual([]);
    });

    it('returns empty array for undefined social', () => {
      expect(buildSocialLinks(undefined)).toEqual([]);
    });

    it('returns empty array when all values are null', () => {
      const links = buildSocialLinks({
        facebook: null,
        instagram: null,
        twitter: null,
        linkedin: null,
        youtube: null,
      });
      expect(links).toEqual([]);
    });
  });

  describe('isIndexable', () => {
    it('returns true for "index, follow"', () => {
      expect(isIndexable('index, follow')).toBe(true);
    });

    it('returns false for "noindex"', () => {
      expect(isIndexable('noindex')).toBe(false);
    });

    it('returns false for "noindex, nofollow"', () => {
      expect(isIndexable('noindex, nofollow')).toBe(false);
    });

    it('returns true for null', () => {
      expect(isIndexable(null)).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(isIndexable(undefined)).toBe(true);
    });
  });

  describe('buildOrganizationSchema', () => {
    it('maps branding + contact correctly', () => {
      const config = createMockConfig();
      const org = buildOrganizationSchema(config);

      expect(org.name).toBe('Test Store');
      expect(org.url).toBe('https://shop.example.com');
      expect(org.logo).toBe('https://shop.example.com/logo.svg');
      expect(org.contactPoint).toEqual({
        email: 'hello@example.com',
        telephone: '+46 123 456',
      });
      expect(org.sameAs).toEqual([
        'https://facebook.com/teststore',
        'https://instagram.com/teststore',
        'https://linkedin.com/company/teststore',
      ]);
    });

    it('omits logo when not set', () => {
      const config = createMockConfig({
        branding: { name: 'Store', watermark: 'full' },
      });
      const org = buildOrganizationSchema(config);
      expect(org.logo).toBeUndefined();
    });

    it('omits contactPoint when no email/phone', () => {
      const config = createMockConfig({ contact: { address: null } });
      const org = buildOrganizationSchema(config);
      expect(org.contactPoint).toBeUndefined();
    });

    it('omits sameAs when no social links', () => {
      const config = createMockConfig({ contact: null });
      const org = buildOrganizationSchema(config);
      expect(org.sameAs).toBeUndefined();
    });
  });

  describe('buildWebSiteSchema', () => {
    it('includes name, url, description, inLanguage', () => {
      const config = createMockConfig();
      const site = buildWebSiteSchema(config);

      expect(site.name).toBe('Test Store');
      expect(site.url).toBe('https://shop.example.com');
      expect(site.description).toBe('A great store for testing');
      expect(site.inLanguage).toBe('sv-SE');
    });

    it('omits description when not set', () => {
      const config = createMockConfig({ seo: null });
      const site = buildWebSiteSchema(config);
      expect(site.description).toBeUndefined();
    });

    it('includes inLanguage from geinsSettings', () => {
      const config = createMockConfig();
      config.geinsSettings.locale = 'en-US';
      const site = buildWebSiteSchema(config);
      expect(site.inLanguage).toBe('en-US');
    });
  });
});
