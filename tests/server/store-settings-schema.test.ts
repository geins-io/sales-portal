import { describe, it, expect } from 'vitest';
import {
  StoreSettingsSchema,
  BrandingConfigSchema,
} from '../../server/schemas/store-settings';
import {
  deriveThemeColors,
  parseOklch,
  formatOklch,
} from '../../server/utils/theme';
import {
  transformGeinsSettings,
  generateFontCss,
  generateTenantCss,
} from '../../server/utils/tenant';
import { buildGoogleFontsUrl } from '#shared/utils/fonts';
import type { ThemeColors } from '../../server/schemas/store-settings';

// Full tenant mock configs inlined so tests are self-contained
const TENANT_A_MOCK = {
  tenantId: 'tenant-a',
  hostname: 'tenant-a.litium.portal',
  aliases: ['tenant-a.localhost'],
  geinsSettings: {
    apiKey: 'C10CF115-04D8-486F-9B16-593045AC3C32',
    accountName: 'monitor',
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
    name: 'teal',
    displayName: 'Teal — Default',
    colors: {
      primary: 'oklch(0.47 0.13 195.71)',
      primaryForeground: 'oklch(0.985 0 0)',
      secondary: 'oklch(0.97 0.001 286.38)',
      secondaryForeground: 'oklch(0.21 0.006 285.88)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
      card: null,
      cardForeground: null,
      popover: null,
      popoverForeground: null,
      muted: null,
      mutedForeground: null,
      accent: null,
      accentForeground: null,
      destructive: null,
      destructiveForeground: null,
      border: null,
      input: null,
      ring: null,
      chart1: null,
      chart2: null,
      chart3: null,
      chart4: null,
      chart5: null,
      sidebar: null,
      sidebarForeground: null,
      sidebarPrimary: null,
      sidebarPrimaryForeground: null,
      sidebarAccent: null,
      sidebarAccentForeground: null,
      sidebarBorder: null,
      sidebarRing: null,
    },
    radius: '0.625rem',
    typography: {
      fontFamily: 'Inter',
      headingFontFamily: 'Inter',
      monoFontFamily: null,
    },
  },
  branding: {
    name: 'Tenant A Store',
    watermark: 'minimal',
    logoUrl: 'https://placehold.co/200x60/0d9488/white?text=Tenant+A',
    logoDarkUrl: null,
    logoSymbolUrl: null,
    faviconUrl: 'https://placehold.co/32x32/0d9488/white?text=A',
    ogImageUrl: null,
  },
  features: {
    search: { enabled: true },
    cart: { enabled: true, access: 'authenticated' },
    checkout: { enabled: true, access: 'authenticated' },
    wishlist: { enabled: true, access: 'authenticated' },
    lists: { enabled: true, access: 'authenticated' },
    reorder: { enabled: true, access: 'authenticated' },
    newsletter: { enabled: true },
    orderHistory: { enabled: true, access: 'authenticated' },
    productComparison: { enabled: false },
    quotes: { enabled: false },
    mfa: { enabled: false },
  },
  seo: {
    defaultTitle: 'Tenant A Store',
    titleTemplate: '%s | Tenant A Store',
    defaultDescription: 'B2B sales portal for Tenant A',
    defaultKeywords: null,
    robots: 'noindex, nofollow',
    googleAnalyticsId: null,
    googleTagManagerId: null,
    verification: null,
  },
  contact: {
    email: 'support@tenant-a.example.com',
    phone: '+46 8 123 456',
    address: {
      street: 'Storgatan 1',
      city: 'Stockholm',
      postalCode: '111 22',
      country: 'SE',
    },
    social: null,
  },
  overrides: null,
  isActive: true,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-02-10T12:00:00.000Z',
};

const TENANT_B_MOCK = {
  tenantId: 'tenant-b',
  hostname: 'tenant-b.litium.portal',
  aliases: ['tenant-b.localhost'],
  geinsSettings: {
    apiKey: 'C10CF115-04D8-486F-9B16-593045AC3C32',
    accountName: 'monitor',
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
    name: 'rose',
    displayName: 'Rose — Custom',
    colors: {
      primary: 'oklch(0.637 0.237 25.33)',
      primaryForeground: 'oklch(0.985 0 0)',
      secondary: 'oklch(0.97 0.001 286.38)',
      secondaryForeground: 'oklch(0.21 0.006 285.88)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
      card: null,
      cardForeground: null,
      popover: null,
      popoverForeground: null,
      muted: null,
      mutedForeground: null,
      accent: null,
      accentForeground: null,
      destructive: 'oklch(0.577 0.245 27.33)',
      destructiveForeground: null,
      border: null,
      input: null,
      ring: null,
      chart1: null,
      chart2: null,
      chart3: null,
      chart4: null,
      chart5: null,
      sidebar: null,
      sidebarForeground: null,
      sidebarPrimary: null,
      sidebarPrimaryForeground: null,
      sidebarAccent: null,
      sidebarAccentForeground: null,
      sidebarBorder: null,
      sidebarRing: null,
    },
    radius: '0.5rem',
    typography: {
      fontFamily: 'DM Sans',
      headingFontFamily: 'Carter One',
      monoFontFamily: null,
    },
  },
  branding: {
    name: 'Acme Corporation',
    watermark: 'full',
    logoUrl: 'https://placehold.co/200x60/e11d48/white?text=ACME',
    logoDarkUrl: 'https://placehold.co/200x60/fda4af/1f2937?text=ACME',
    logoSymbolUrl: null,
    faviconUrl: 'https://placehold.co/32x32/e11d48/white?text=A',
    ogImageUrl: 'https://placehold.co/1200x630/e11d48/white?text=Acme+Corp',
  },
  features: {
    search: { enabled: true },
    cart: { enabled: true, access: 'authenticated' },
    checkout: { enabled: true, access: 'authenticated' },
    wishlist: { enabled: false },
    newsletter: { enabled: true },
    orderHistory: { enabled: true, access: 'authenticated' },
    productComparison: { enabled: false },
    quotes: { enabled: true, access: { role: 'order_placer' } },
    quoteApproval: { enabled: true, access: { role: 'order_approver' } },
    mfa: { enabled: true, access: 'authenticated' },
  },
  seo: {
    defaultTitle: 'Acme Corporation',
    titleTemplate: '%s — Acme Corp',
    defaultDescription: 'Acme Corporation sales portal',
    defaultKeywords: null,
    robots: 'noindex, nofollow',
    googleAnalyticsId: null,
    googleTagManagerId: null,
    verification: null,
  },
  contact: {
    email: 'orders@acme-corp.example.com',
    phone: '+44 20 7946 0958',
    address: {
      street: '123 Commerce Street',
      city: 'London',
      postalCode: 'EC1A 1BB',
      country: 'GB',
    },
    social: {
      facebook: null,
      instagram: null,
      twitter: null,
      linkedin: 'https://linkedin.com/company/acme-corp',
      youtube: null,
    },
  },
  overrides: {
    css: {
      '--bg-btn-buy': 'oklch(0.696 0.17 162.48)',
      '--text-heading': 'oklch(0.637 0.237 25.33)',
    },
    features: {
      staffPricing: { enabled: true, access: { group: 'staff' } },
    },
  },
  isActive: true,
  createdAt: '2026-02-01T08:00:00.000Z',
  updatedAt: '2026-02-11T09:00:00.000Z',
};

describe('StoreSettingsSchema', () => {
  describe('valid input', () => {
    it('should validate tenant-a mock', () => {
      const result = StoreSettingsSchema.safeParse(TENANT_A_MOCK);
      expect(result.success).toBe(true);
    });

    it('should validate tenant-b mock', () => {
      const result = StoreSettingsSchema.safeParse(TENANT_B_MOCK);
      expect(result.success).toBe(true);
    });

    it('should validate minimal required config', () => {
      const minimal = {
        tenantId: 'test',
        hostname: 'test.example.com',
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
          colors: {
            primary: 'oklch(0.5 0.1 200)',
            primaryForeground: 'oklch(0.9 0 0)',
            secondary: 'oklch(0.8 0 0)',
            secondaryForeground: 'oklch(0.2 0 0)',
            background: 'oklch(1 0 0)',
            foreground: 'oklch(0.1 0 0)',
          },
        },
        branding: {
          name: 'Test',
          watermark: 'full',
        },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = StoreSettingsSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('should reject missing required color fields', () => {
      const incomplete = {
        tenantId: 'test',
        hostname: 'test.example.com',
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
          colors: {
            primary: 'oklch(0.5 0.1 200)',
            // Missing primaryForeground, secondary, etc.
          },
        },
        branding: { name: 'Test', watermark: 'full' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = StoreSettingsSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should reject missing mode field', () => {
      const noMode = {
        tenantId: 'test',
        hostname: 'test.example.com',
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
        theme: {
          name: 'default',
          colors: {
            primary: 'oklch(0.5 0.1 200)',
            primaryForeground: 'oklch(0.9 0 0)',
            secondary: 'oklch(0.8 0 0)',
            secondaryForeground: 'oklch(0.2 0 0)',
            background: 'oklch(1 0 0)',
            foreground: 'oklch(0.1 0 0)',
          },
        },
        branding: { name: 'Test', watermark: 'full' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = StoreSettingsSchema.safeParse(noMode);
      expect(result.success).toBe(false);
    });

    it('should reject missing branding.watermark', () => {
      const noWatermark = {
        tenantId: 'test',
        hostname: 'test.example.com',
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
          colors: {
            primary: 'oklch(0.5 0.1 200)',
            primaryForeground: 'oklch(0.9 0 0)',
            secondary: 'oklch(0.8 0 0)',
            secondaryForeground: 'oklch(0.2 0 0)',
            background: 'oklch(1 0 0)',
            foreground: 'oklch(0.1 0 0)',
          },
        },
        branding: { name: 'Test' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = StoreSettingsSchema.safeParse(noWatermark);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid OKLCH colors', () => {
    it('should reject hex colors', () => {
      const hexColors = {
        tenantId: 'test',
        hostname: 'test.example.com',
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
          colors: {
            primary: '#ff0000',
            primaryForeground: '#ffffff',
            secondary: '#00ff00',
            secondaryForeground: '#000000',
            background: '#ffffff',
            foreground: '#000000',
          },
        },
        branding: { name: 'Test', watermark: 'full' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = StoreSettingsSchema.safeParse(hexColors);
      expect(result.success).toBe(false);
    });

    it('should reject rgb colors', () => {
      const config = {
        tenantId: 'test',
        hostname: 'test.example.com',
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
          colors: {
            primary: 'rgb(255, 0, 0)',
            primaryForeground: 'oklch(0.9 0 0)',
            secondary: 'oklch(0.8 0 0)',
            secondaryForeground: 'oklch(0.2 0 0)',
            background: 'oklch(1 0 0)',
            foreground: 'oklch(0.1 0 0)',
          },
        },
        branding: { name: 'Test', watermark: 'full' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = StoreSettingsSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('feature access variants', () => {
    it('should accept features with string access', () => {
      const config = createMinimalConfig({
        features: {
          cart: { enabled: true, access: 'authenticated' },
          search: { enabled: true, access: 'all' },
        },
      });
      const result = StoreSettingsSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept features with object access', () => {
      const config = createMinimalConfig({
        features: {
          quotes: { enabled: true, access: { role: 'order_placer' } },
          staffPricing: { enabled: true, access: { group: 'staff' } },
          enterprise: { enabled: true, access: { accountType: 'enterprise' } },
        },
      });
      const result = StoreSettingsSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept features without access (defaults to all)', () => {
      const config = createMinimalConfig({
        features: {
          search: { enabled: true },
          newsletter: { enabled: false },
        },
      });
      const result = StoreSettingsSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

describe('BrandingConfigSchema URL validation', () => {
  const basebranding = { name: 'Test Store', watermark: 'full' as const };

  describe('logoUrl', () => {
    it('accepts a valid https URL', () => {
      const result = BrandingConfigSchema.safeParse({
        ...basebranding,
        logoUrl: 'https://cdn.example.com/logo.png',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a valid http URL', () => {
      const result = BrandingConfigSchema.safeParse({
        ...basebranding,
        logoUrl: 'http://cdn.example.com/logo.png',
      });
      expect(result.success).toBe(true);
    });

    it('accepts null', () => {
      const result = BrandingConfigSchema.safeParse({
        ...basebranding,
        logoUrl: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts undefined (field omitted)', () => {
      const result = BrandingConfigSchema.safeParse({ ...basebranding });
      expect(result.success).toBe(true);
    });

    it('rejects javascript: protocol', () => {
      const result = BrandingConfigSchema.safeParse({
        ...basebranding,
        logoUrl: 'javascript:alert(1)',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = BrandingConfigSchema.safeParse({
        ...basebranding,
        logoUrl: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('all five URL fields reject unsafe values', () => {
    const urlFields = [
      'logoUrl',
      'logoDarkUrl',
      'logoSymbolUrl',
      'faviconUrl',
      'ogImageUrl',
    ] as const;

    for (const field of urlFields) {
      it(`${field}: rejects javascript: URL`, () => {
        const result = BrandingConfigSchema.safeParse({
          ...basebranding,
          [field]: 'javascript:alert(1)',
        });
        expect(result.success).toBe(false);
      });

      it(`${field}: rejects empty string`, () => {
        const result = BrandingConfigSchema.safeParse({
          ...basebranding,
          [field]: '',
        });
        expect(result.success).toBe(false);
      });

      it(`${field}: accepts https URL`, () => {
        const result = BrandingConfigSchema.safeParse({
          ...basebranding,
          [field]: 'https://cdn.example.com/asset.png',
        });
        expect(result.success).toBe(true);
      });

      it(`${field}: accepts null`, () => {
        const result = BrandingConfigSchema.safeParse({
          ...basebranding,
          [field]: null,
        });
        expect(result.success).toBe(true);
      });

      it(`${field}: accepts undefined`, () => {
        const result = BrandingConfigSchema.safeParse({
          ...basebranding,
          [field]: undefined,
        });
        expect(result.success).toBe(true);
      });
    }
  });
});

describe('deriveThemeColors', () => {
  const coreColors: ThemeColors = {
    primary: 'oklch(0.47 0.13 195.71)',
    primaryForeground: 'oklch(0.985 0 0)',
    secondary: 'oklch(0.97 0.001 286.38)',
    secondaryForeground: 'oklch(0.21 0.006 285.88)',
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
  };

  it('should derive all 26 optional colors from 6 core', () => {
    const result = deriveThemeColors(coreColors);

    // All 32 keys should be present as non-null strings
    const keys = Object.keys(result);
    expect(keys).toHaveLength(32);
    for (const key of keys) {
      expect(result[key as keyof typeof result]).toBeTruthy();
      expect(typeof result[key as keyof typeof result]).toBe('string');
    }
  });

  it('should preserve API-provided non-null values', () => {
    const withOverrides: ThemeColors = {
      ...coreColors,
      destructive: 'oklch(0.577 0.245 27.33)',
      card: 'oklch(0.99 0 0)',
    };
    const result = deriveThemeColors(withOverrides);
    expect(result.destructive).toBe('oklch(0.577 0.245 27.33)');
    expect(result.card).toBe('oklch(0.99 0 0)');
  });

  it('should derive card from background when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.card).toBe(coreColors.background);
  });

  it('should derive cardForeground from foreground when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.cardForeground).toBe(coreColors.foreground);
  });

  it('should derive popover from background when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.popover).toBe(coreColors.background);
  });

  it('should derive accent from secondary when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.accent).toBe(coreColors.secondary);
  });

  it('should derive accentForeground from secondaryForeground when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.accentForeground).toBe(coreColors.secondaryForeground);
  });

  it('should derive destructive to standard red when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.destructive).toBe('oklch(0.577 0.245 27.325)');
  });

  it('should derive destructiveForeground to white when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.destructiveForeground).toBe('oklch(0.985 0 0)');
  });

  it('should derive sidebarPrimary from primary when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.sidebarPrimary).toBe(coreColors.primary);
  });

  it('should derive sidebarPrimaryForeground from primaryForeground when null', () => {
    const result = deriveThemeColors(coreColors);
    expect(result.sidebarPrimaryForeground).toBe(coreColors.primaryForeground);
  });

  it('should generate valid OKLCH for derived muted/border/ring/chart colors', () => {
    const result = deriveThemeColors(coreColors);
    const oklchPattern = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;
    expect(result.muted).toMatch(oklchPattern);
    expect(result.mutedForeground).toMatch(oklchPattern);
    expect(result.border).toMatch(oklchPattern);
    expect(result.ring).toMatch(oklchPattern);
    expect(result.chart1).toMatch(oklchPattern);
    expect(result.chart5).toMatch(oklchPattern);
    expect(result.sidebar).toMatch(oklchPattern);
  });
});

describe('parseOklch / formatOklch', () => {
  it('should round-trip a valid OKLCH value', () => {
    const input = 'oklch(0.500 0.130 195.710)';
    const parsed = parseOklch(input);
    expect(parsed.l).toBeCloseTo(0.5);
    expect(parsed.c).toBeCloseTo(0.13);
    expect(parsed.h).toBeCloseTo(195.71);

    const formatted = formatOklch(parsed.l, parsed.c, parsed.h);
    expect(formatted).toBe('oklch(0.500 0.130 195.710)');
  });

  it('should clamp values', () => {
    const formatted = formatOklch(1.5, -0.1, 400);
    expect(formatted).toBe('oklch(1.000 0.000 40.000)');
  });

  it('should handle zero values', () => {
    const formatted = formatOklch(0, 0, 0);
    expect(formatted).toBe('oklch(0.000 0.000 0.000)');
  });
});

describe('transformGeinsSettings', () => {
  it('should transform platform shape to clean internal shape', () => {
    const platformShape = {
      defaultHostName: 'tenant-b.sales-portal.geins.dev',
      additionalHostNames: ['tenant-b.litium.portal'],
      apiKey: 'C10CF115-04D8-486F-9B16-593045AC3C32',
      accountName: 'monitor',
      channelId: '2|se',
      defaultLocale: 'sv-SE',
      defaultMarket: 'se',
      locales: ['sv-SE'],
      markets: ['se'],
    };

    const result = transformGeinsSettings(platformShape);

    expect(result).toEqual({
      apiKey: 'C10CF115-04D8-486F-9B16-593045AC3C32',
      accountName: 'monitor',
      channel: '2',
      tld: 'se',
      locale: 'sv-SE',
      market: 'se',
      availableLocales: ['sv-SE'],
      availableMarkets: ['se'],
    });
  });

  it('should split channelId into channel and tld', () => {
    const result = transformGeinsSettings({
      channelId: '5|dk',
      apiKey: 'key',
      accountName: 'acct',
      defaultLocale: 'da-DK',
      defaultMarket: 'dk',
      locales: ['da-DK', 'en-US'],
      markets: ['dk', 'se'],
    });

    expect(result.channel).toBe('5');
    expect(result.tld).toBe('dk');
    expect(result.availableLocales).toEqual(['da-DK', 'en-US']);
    expect(result.availableMarkets).toEqual(['dk', 'se']);
  });

  it('should handle missing locales/markets arrays', () => {
    const result = transformGeinsSettings({
      channelId: '1|se',
      apiKey: 'key',
      accountName: 'acct',
      defaultLocale: 'sv-SE',
      defaultMarket: 'se',
    });

    expect(result.availableLocales).toEqual([]);
    expect(result.availableMarkets).toEqual([]);
  });
});

describe('generateFontCss', () => {
  it('should generate all three font vars for full typography', () => {
    const css = generateFontCss({
      fontFamily: 'DM Sans',
      headingFontFamily: 'Carter One',
      monoFontFamily: 'Fira Code',
    });
    expect(css).toContain("--font-family: 'DM Sans'");
    expect(css).toContain("--heading-font-family: 'Carter One'");
    expect(css).toContain("--mono-font-family: 'Fira Code'");
  });

  it('should fall back heading to fontFamily when headingFontFamily is null', () => {
    const css = generateFontCss({
      fontFamily: 'Inter',
      headingFontFamily: null,
      monoFontFamily: null,
    });
    expect(css).toContain("--font-family: 'Inter'");
    expect(css).toContain("--heading-font-family: 'Inter'");
    expect(css).not.toContain('--mono-font-family');
  });

  it('should return empty string for null typography', () => {
    expect(generateFontCss(null)).toBe('');
    expect(generateFontCss(undefined)).toBe('');
  });

  it('should include sans-serif fallback stack for body/heading fonts', () => {
    const css = generateFontCss({
      fontFamily: 'Roboto',
    });
    expect(css).toContain('ui-sans-serif, system-ui, sans-serif');
  });

  it('should include monospace fallback stack for mono font', () => {
    const css = generateFontCss({
      fontFamily: 'Inter',
      monoFontFamily: 'JetBrains Mono',
    });
    expect(css).toContain(
      "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
    );
  });
});

describe('generateTenantCss with typography', () => {
  const minimalColors = deriveThemeColors({
    primary: 'oklch(0.5 0.1 200)',
    primaryForeground: 'oklch(0.9 0 0)',
    secondary: 'oklch(0.8 0 0)',
    secondaryForeground: 'oklch(0.2 0 0)',
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.1 0 0)',
  });

  it('should include font vars when typography is provided', () => {
    const css = generateTenantCss('test', minimalColors, '0.5rem', null, {
      fontFamily: 'DM Sans',
      headingFontFamily: 'Carter One',
    });
    expect(css).toContain("--font-family: 'DM Sans'");
    expect(css).toContain("--heading-font-family: 'Carter One'");
    expect(css).toContain("[data-theme='test']");
  });

  it('should not include font vars when typography is null', () => {
    const css = generateTenantCss('test', minimalColors, '0.5rem', null, null);
    expect(css).not.toContain('--font-family');
    expect(css).not.toContain('--heading-font-family');
  });
});

describe('buildGoogleFontsUrl', () => {
  it('should build URL with single font family', () => {
    const url = buildGoogleFontsUrl({ fontFamily: 'Inter' });
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe('https://fonts.googleapis.com');
    expect(parsed.pathname).toBe('/css2');
    expect(parsed.searchParams.getAll('family')).toEqual([
      'Inter:wght@300;400;500;600;700',
    ]);
    expect(parsed.searchParams.get('display')).toBe('swap');
  });

  it('should build URL with multiple font families', () => {
    const url = buildGoogleFontsUrl({
      fontFamily: 'DM Sans',
      headingFontFamily: 'Carter One',
    });
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    const families = parsed.searchParams.getAll('family');
    expect(families).toContain('DM Sans:wght@300;400;500;600;700');
    expect(families).toContain('Carter One:wght@300;400;500;600;700');
    expect(parsed.searchParams.get('display')).toBe('swap');
  });

  it('should deduplicate when heading equals body font', () => {
    const url = buildGoogleFontsUrl({
      fontFamily: 'Inter',
      headingFontFamily: 'Inter',
    });
    // Should only have one "family=Inter" param
    const matches = url!.match(/family=Inter/g);
    expect(matches).toHaveLength(1);
  });

  it('should include mono font in URL', () => {
    const url = buildGoogleFontsUrl({
      fontFamily: 'Inter',
      monoFontFamily: 'Fira Code',
    });
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    const families = parsed.searchParams.getAll('family');
    expect(families).toContain('Fira Code:wght@300;400;500;600;700');
  });

  it('should return null for null/undefined typography', () => {
    expect(buildGoogleFontsUrl(null)).toBeNull();
    expect(buildGoogleFontsUrl(undefined)).toBeNull();
  });

  it('should encode spaces as + in font names', () => {
    const url = buildGoogleFontsUrl({ fontFamily: 'Playfair Display' });
    expect(url).toContain('family=Playfair+Display');
    expect(url).not.toContain('family=Playfair Display');
  });
});

// Helper to create minimal valid config for testing
function createMinimalConfig(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'test',
    hostname: 'test.example.com',
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
      colors: {
        primary: 'oklch(0.5 0.1 200)',
        primaryForeground: 'oklch(0.9 0 0)',
        secondary: 'oklch(0.8 0 0)',
        secondaryForeground: 'oklch(0.2 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.1 0 0)',
      },
    },
    branding: { name: 'Test', watermark: 'full' },
    features: {},
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
