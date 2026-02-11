import { describe, it, expect } from 'vitest';
import { StoreSettingsSchema } from '../../server/schemas/store-settings';
import {
  deriveThemeColors,
  parseOklch,
  formatOklch,
} from '../../server/utils/theme';
import type { ThemeColors } from '../../server/schemas/store-settings';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load mock JSON files for validation
const mockDir = path.resolve(
  __dirname,
  '../../../local-docs/mock-store-settings',
);

describe('StoreSettingsSchema', () => {
  describe('valid input', () => {
    it('should validate tenant-a.json mock', () => {
      const raw = JSON.parse(
        fs.readFileSync(path.join(mockDir, 'tenant-a.json'), 'utf-8'),
      );
      const result = StoreSettingsSchema.safeParse(raw);
      if (!result.success) {
        console.error(result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('should validate tenant-b.json mock', () => {
      const raw = JSON.parse(
        fs.readFileSync(path.join(mockDir, 'tenant-b.json'), 'utf-8'),
      );
      const result = StoreSettingsSchema.safeParse(raw);
      if (!result.success) {
        console.error(result.error.issues);
      }
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
