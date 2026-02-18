import { describe, it, expect } from 'vitest';
import {
  tenantIdKey,
  tenantConfigKey,
  collectAllHostnames,
} from '../../server/utils/tenant';
import {
  createDefaultTheme,
  generateTenantCss,
  generateThemeHash,
  generateOverrideCss,
  mergeThemes,
} from '../../server/utils/tenant-css';
import type { TenantConfig } from '#shared/types/tenant-config';
import { deriveThemeColors } from '../../server/utils/theme';
import type { ThemeColors } from '../../server/schemas/store-settings';
import { KV_STORAGE_KEYS } from '../../shared/constants/storage';

describe('Tenant utilities', () => {
  describe('tenantIdKey', () => {
    it('should generate correct key for hostname', () => {
      const key = tenantIdKey('example.com');
      expect(key).toBe(`${KV_STORAGE_KEYS.TENANT_ID_PREFIX}example.com`);
    });

    it('should handle localhost', () => {
      const key = tenantIdKey('localhost');
      expect(key).toBe(`${KV_STORAGE_KEYS.TENANT_ID_PREFIX}localhost`);
    });
  });

  describe('tenantConfigKey', () => {
    it('should generate correct key for tenant ID', () => {
      const key = tenantConfigKey('tenant-123');
      expect(key).toBe(`${KV_STORAGE_KEYS.TENANT_CONFIG_PREFIX}tenant-123`);
    });
  });

  describe('createDefaultTheme', () => {
    it('should create theme with correct name', () => {
      const theme = createDefaultTheme('my-tenant');
      expect(theme.name).toBe('my-tenant');
      expect(theme.displayName).toBe('my-tenant');
    });

    it('should include 6 core colors and 26 null optionals', () => {
      const theme = createDefaultTheme('test');
      expect(theme.colors.primary).toBeDefined();
      expect(theme.colors.secondary).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(theme.colors.foreground).toBeDefined();
      expect(theme.colors.primaryForeground).toBeDefined();
      expect(theme.colors.secondaryForeground).toBeDefined();
      // Optional colors should be null
      expect(theme.colors.card).toBeNull();
      expect(theme.colors.chart1).toBeNull();
      expect(theme.colors.sidebar).toBeNull();
    });

    it('should include radius as a string', () => {
      const theme = createDefaultTheme('test');
      expect(theme.radius).toBe('0.625rem');
    });

    it('should not have borderRadius or customProperties', () => {
      const theme = createDefaultTheme('test');
      expect((theme as Record<string, unknown>).borderRadius).toBeUndefined();
      expect(
        (theme as Record<string, unknown>).customProperties,
      ).toBeUndefined();
    });
  });

  describe('generateTenantCss', () => {
    function defaultDerivedColors() {
      const theme = createDefaultTheme('test');
      return deriveThemeColors(theme.colors as ThemeColors);
    }

    it('should generate CSS with data-theme selector', () => {
      const css = generateTenantCss('my-tenant', defaultDerivedColors());
      expect(css).toContain("[data-theme='my-tenant']");
    });

    it('should include all 32 color variables', () => {
      const css = generateTenantCss('test', defaultDerivedColors());
      expect(css).toContain('--primary:');
      expect(css).toContain('--primary-foreground:');
      expect(css).toContain('--destructive-foreground:');
      expect(css).toContain('--chart-1:');
      expect(css).toContain('--chart-5:');
      expect(css).toContain('--sidebar:');
      expect(css).toContain('--sidebar-ring:');
    });

    it('should generate only base radius variable', () => {
      const css = generateTenantCss('test', defaultDerivedColors(), '0.625rem');
      expect(css).toContain('--radius: 0.625rem;');
      expect(css).not.toContain('--radius-sm:');
      expect(css).not.toContain('--radius-md:');
      expect(css).not.toContain('--radius-lg:');
      expect(css).not.toContain('--radius-xl:');
    });

    it('should include override CSS variables', () => {
      const overrides = {
        '--bg-btn-buy': 'oklch(0.696 0.17 162.48)',
        '--text-heading': 'oklch(0.637 0.237 25.33)',
      };
      const css = generateTenantCss(
        'test',
        defaultDerivedColors(),
        null,
        overrides,
      );
      expect(css).toContain('--bg-btn-buy: oklch(0.696 0.17 162.48);');
      expect(css).toContain('--text-heading: oklch(0.637 0.237 25.33);');
    });

    it('should not include radius when null', () => {
      const css = generateTenantCss('test', defaultDerivedColors(), null);
      expect(css).not.toContain('--radius:');
    });
  });

  describe('generateOverrideCss', () => {
    it('should return empty string for null/undefined', () => {
      expect(generateOverrideCss(null)).toBe('');
      expect(generateOverrideCss(undefined)).toBe('');
    });

    it('should generate CSS from override map', () => {
      const css = generateOverrideCss({
        '--custom-var': 'red',
        '--other-var': '10px',
      });
      expect(css).toContain('--custom-var: red;');
      expect(css).toContain('--other-var: 10px;');
    });
  });

  describe('generateThemeHash', () => {
    it('should generate a consistent hash for the same theme', () => {
      const theme = createDefaultTheme('test');
      const hash1 = generateThemeHash(theme);
      const hash2 = generateThemeHash(theme);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different themes', () => {
      const theme1 = createDefaultTheme('test1');
      const theme2 = createDefaultTheme('test2');
      expect(generateThemeHash(theme1)).not.toBe(generateThemeHash(theme2));
    });

    it('should detect color changes', () => {
      const theme1 = createDefaultTheme('test');
      const theme2 = createDefaultTheme('test');
      theme2.colors.primary = 'oklch(0.5 0.1 200)';
      expect(generateThemeHash(theme1)).not.toBe(generateThemeHash(theme2));
    });

    it('should detect radius changes', () => {
      const theme1 = createDefaultTheme('test');
      const theme2 = createDefaultTheme('test');
      theme2.radius = '1rem';
      expect(generateThemeHash(theme1)).not.toBe(generateThemeHash(theme2));
    });

    it('should return a string hash', () => {
      const theme = createDefaultTheme('test');
      const hash = generateThemeHash(theme);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('mergeThemes', () => {
    it('should return base theme when updates is undefined', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, undefined);
      expect(result).toBe(base);
    });

    it('should merge top-level theme properties', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, {
        name: 'updated-name',
        displayName: 'Updated Display Name',
      });
      expect(result.name).toBe('updated-name');
      expect(result.displayName).toBe('Updated Display Name');
    });

    it('should deep merge colors', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, {
        colors: {
          primary: 'oklch(0.5 0.2 200)',
          secondary: 'oklch(0.6 0.1 100)',
        },
      });
      expect(result.colors.primary).toBe('oklch(0.5 0.2 200)');
      expect(result.colors.secondary).toBe('oklch(0.6 0.1 100)');
      expect(result.colors.background).toBe(base.colors.background);
    });

    it('should override radius', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, { radius: '1rem' });
      expect(result.radius).toBe('1rem');
    });

    it('should handle empty updates object', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, {});
      expect(result).not.toBe(base);
      expect(result.name).toBe(base.name);
      expect(result.colors.primary).toBe(base.colors.primary);
    });

    it('should preserve base properties when not in updates', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, {
        displayName: 'New Display Name',
      });
      expect(result.name).toBe(base.name);
      expect(result.displayName).toBe('New Display Name');
      expect(result.colors).toEqual(base.colors);
    });
  });

  describe('collectAllHostnames', () => {
    function createMinimalConfig(
      overrides?: Partial<TenantConfig>,
    ): TenantConfig {
      return {
        tenantId: 'tenant-a',
        hostname: 'tenant-a.litium.portal',
        geinsSettings: {
          apiKey: '',
          accountName: '',
          channel: '1',
          tld: 'se',
          locale: 'sv-SE',
          market: 'se',
          environment: 'production',
          availableLocales: ['sv-SE'],
          availableMarkets: ['se'],
        },
        mode: 'commerce',
        theme: createDefaultTheme('tenant-a'),
        branding: { name: 'Tenant A', watermark: 'full' },
        features: {},
        css: '',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
      };
    }

    it('should return hostname when no aliases', () => {
      const config = createMinimalConfig();
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(1);
      expect(hostnames.has('tenant-a.litium.portal')).toBe(true);
    });

    it('should include hostname and all aliases', () => {
      const config = createMinimalConfig({
        aliases: ['tenant-a.localhost', 'tenant-a.sales-portal.geins.dev'],
      });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(3);
      expect(hostnames.has('tenant-a.litium.portal')).toBe(true);
      expect(hostnames.has('tenant-a.localhost')).toBe(true);
      expect(hostnames.has('tenant-a.sales-portal.geins.dev')).toBe(true);
    });

    it('should deduplicate when hostname appears in aliases', () => {
      const config = createMinimalConfig({
        aliases: ['tenant-a.litium.portal', 'tenant-a.localhost'],
      });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(2);
    });

    it('should skip empty/falsy alias entries', () => {
      const config = createMinimalConfig({
        aliases: ['tenant-a.localhost', '', undefined as unknown as string],
      });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(2);
      expect(hostnames.has('tenant-a.litium.portal')).toBe(true);
      expect(hostnames.has('tenant-a.localhost')).toBe(true);
    });

    it('should return empty set when hostname is empty and no aliases', () => {
      const config = createMinimalConfig({ hostname: '' });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(0);
    });
  });
});
