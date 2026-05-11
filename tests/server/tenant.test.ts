import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  tenantIdKey,
  tenantConfigKey,
  collectAllHostnames,
  buildTenantConfig,
  writeHostnameMappings,
  parseStoreSettingsResilient,
  adaptMerchantApiResponse,
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
import type {
  ThemeColors,
  StoreSettings,
} from '../../server/schemas/store-settings';
import { KV_STORAGE_KEYS } from '../../shared/constants/storage';

// Mock logger BEFORE importing tenant utils so the defensive-code
// warn() calls go to our spy. vi.hoisted so the ref exists when
// vi.mock's factory runs (factories are hoisted above module imports).
const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));
vi.mock('../../server/utils/logger', () => ({
  logger: {
    warn: mockLoggerWarn,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

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

  describe('buildTenantConfig theme.name fallback', () => {
    const baseSettings: StoreSettings = {
      tenantId: 'boattools',
      hostname: 'boattools.litium.store',
      geinsSettings: {
        apiKey: 'k',
        accountName: 'boattools',
        channel: '1',
        tld: 'se',
        locale: 'sv-SE',
        market: 'se',
        environment: 'production',
        availableLocales: ['sv-SE'],
        availableMarkets: ['se'],
      },
      mode: 'commerce',
      checkoutMode: 'hosted',
      theme: {
        colors: {
          primary: 'oklch(0.55 0.03 235)',
          primaryForeground: 'oklch(0.985 0 0)',
          secondary: 'oklch(0.93 0.05 90)',
          secondaryForeground: 'oklch(0.25 0.02 235)',
          background: 'oklch(1 0 0)',
          foreground: 'oklch(0.145 0 0)',
        },
      },
      branding: { name: 'BoatTools', watermark: 'minimal' },
      features: {},
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('uses tenantId when theme.name is missing', () => {
      const built = buildTenantConfig(baseSettings);
      expect(built.theme.name).toBe('boattools');
      expect(built.css).toContain("[data-theme='boattools']");
    });

    it('preserves explicit theme.name when provided', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        theme: { ...baseSettings.theme, name: 'ocean' },
      });
      expect(built.theme.name).toBe('ocean');
      expect(built.css).toContain("[data-theme='ocean']");
    });
  });

  describe('buildTenantConfig override.features resolution', () => {
    const baseSettings: StoreSettings = {
      tenantId: 'tenant-x',
      hostname: 'tenant-x.litium.store',
      geinsSettings: {
        apiKey: 'k',
        accountName: 'tenant-x',
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
      theme: {
        colors: {
          primary: 'oklch(0.55 0.03 235)',
          primaryForeground: 'oklch(0.985 0 0)',
          secondary: 'oklch(0.93 0.05 90)',
          secondaryForeground: 'oklch(0.25 0.02 235)',
          background: 'oklch(1 0 0)',
          foreground: 'oklch(0.145 0 0)',
        },
      },
      branding: { name: 'Tenant X', watermark: 'minimal' },
      features: {},
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('lets override disable a base-enabled feature', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        features: { b2bQuotes: { enabled: true } },
        overrides: {
          features: { b2bQuotes: { enabled: false } },
        },
      });
      expect(built.features.b2bQuotes?.enabled).toBe(false);
    });

    it('passes the base entry through when no override exists for that key', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        features: { search: { enabled: true } },
      });
      expect(built.features.search?.enabled).toBe(true);
    });

    it('creates an entry when only the override has it', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        features: {},
        overrides: {
          features: { newThing: { enabled: true } },
        },
      });
      expect(built.features.newThing?.enabled).toBe(true);
    });
  });

  describe('writeHostnameMappings — duplicate hostname guard', () => {
    // In-memory storage shim that mimics the subset of useStorage
    // actually used by writeHostnameMappings (getItem + setItem).
    function makeStorage() {
      const data = new Map<string, unknown>();
      return {
        getItem: <T = unknown>(k: string) =>
          Promise.resolve((data.get(k) ?? null) as T | null),
        setItem: (k: string, v: unknown) => {
          data.set(k, v);
          return Promise.resolve();
        },
        data,
      };
    }

    function makeConfigWithHostnames(
      tenantId: string,
      hostname: string,
      aliases: string[] = [],
    ): TenantConfig {
      return {
        tenantId,
        hostname,
        aliases,
        mode: 'commerce',
        checkoutMode: 'hosted',
        theme: { name: tenantId, colors: {} as ThemeColors },
        css: '',
        branding: { name: tenantId, watermark: 'minimal' },
        features: {},
        isActive: true,
        createdAt: '',
        updatedAt: '',
        // geinsSettings omitted (not used here)
      } as unknown as TenantConfig;
    }

    beforeEach(() => {
      mockLoggerWarn.mockClear();
    });

    it('writes mappings for every hostname + alias in the config', async () => {
      const storage = makeStorage();
      const config = makeConfigWithHostnames('tenant-a', 'a.example.com', [
        'a.alt.com',
      ]);
      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        config,
      );
      expect(storage.data.get(tenantIdKey('a.example.com'))).toBe('tenant-a');
      expect(storage.data.get(tenantIdKey('a.alt.com'))).toBe('tenant-a');
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('does NOT warn when re-writing the same tenantId to the same hostname', async () => {
      const storage = makeStorage();
      const config = makeConfigWithHostnames('tenant-a', 'a.example.com');
      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        config,
      );
      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        config,
      );
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('warns when a hostname is remapped to a DIFFERENT tenantId', async () => {
      const storage = makeStorage();
      const configA = makeConfigWithHostnames('tenant-a', 'shared.example.com');
      const configB = makeConfigWithHostnames('tenant-b', 'shared.example.com');

      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        configA,
      );
      expect(mockLoggerWarn).not.toHaveBeenCalled();

      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        configB,
      );
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
      const [msg, meta] = mockLoggerWarn.mock.calls[0]!;
      expect(msg).toContain('shared.example.com');
      expect(msg).toContain('tenant-a');
      expect(msg).toContain('tenant-b');
      expect(meta).toMatchObject({
        hostname: 'shared.example.com',
        previousTenantId: 'tenant-a',
        newTenantId: 'tenant-b',
      });

      // Last-writer-wins: the KV is now pointing at tenant-b.
      expect(storage.data.get(tenantIdKey('shared.example.com'))).toBe(
        'tenant-b',
      );
    });
  });

  describe('parseStoreSettingsResilient', () => {
    function fullCandidate(): Record<string, unknown> {
      return {
        tenantId: 'tenant-a',
        hostname: 'tenant-a.example.com',
        geinsSettings: {
          apiKey: 'k',
          accountName: 'a',
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
          colors: {
            primary: 'oklch(0.5 0.1 200)',
            primaryForeground: 'oklch(0.9 0 0)',
            secondary: 'oklch(0.8 0 0)',
            secondaryForeground: 'oklch(0.2 0 0)',
            background: 'oklch(1 0 0)',
            foreground: 'oklch(0.1 0 0)',
          },
        },
        branding: { name: 'A', watermark: 'full' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
    }

    it('returns the strict-parsed value on a clean candidate', () => {
      const out = parseStoreSettingsResilient(fullCandidate(), 'h');
      expect(out).not.toBeNull();
      expect(out?.tenantId).toBe('tenant-a');
    });

    it('salvages a candidate with an unknown mode value by defaulting to commerce', () => {
      const candidate = fullCandidate();
      candidate.mode = 'museum';
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out?.mode).toBe('commerce');
    });

    it('returns null when a fatal field (geinsSettings) is unparseable', () => {
      const candidate = fullCandidate();
      candidate.geinsSettings = { apiKey: '', accountName: '' };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).toBeNull();
    });

    it('returns null when candidate is not an object', () => {
      expect(parseStoreSettingsResilient(null, 'h')).toBeNull();
      expect(parseStoreSettingsResilient('nope', 'h')).toBeNull();
    });

    it('salvages a candidate with missing theme by applying a neutral default', () => {
      const candidate = fullCandidate();
      delete candidate.theme;
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      expect(out?.theme.colors.primary).toBe('oklch(0.5 0.2 260)');
    });

    it('salvages a candidate with missing branding by applying a neutral default', () => {
      const candidate = fullCandidate();
      delete candidate.branding;
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      expect(out?.branding.name).toBe('Store');
      expect(out?.branding.watermark).toBe('full');
    });

    it('preserves surface colors when core OKLCH colors are missing from theme', () => {
      const candidate = fullCandidate();
      candidate.theme = {
        colors: {
          topBarBackground: '#79a07d',
          footerBackground: '#333333',
          navBarBackground: '#ffffff',
        },
      };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      expect(out?.theme.colors.primary).toBe('oklch(0.5 0.2 260)');
      expect(out?.theme.colors.topBarBackground).toBe('#79a07d');
      expect(out?.theme.colors.footerBackground).toBe('#333333');
      expect(out?.theme.colors.navBarBackground).toBe('#ffffff');
    });
  });

  describe('adaptMerchantApiResponse', () => {
    function rawApiResponse(overrides: Record<string, unknown> = {}) {
      return {
        geinsSettings: {
          defaultHostName: 'tenant-b.sales-portal.geins.dev',
          additionalHostNames: ['tenant-b.litium.portal'],
          apiKey: 'C10CF115',
          accountName: 'monitor',
          channelId: '2|se',
          defaultLocale: 'sv-SE',
          defaultMarket: 'se',
          locales: ['sv-SE', 'en-US'],
          markets: ['se', 'fi'],
        },
        appSettings: {
          mode: 'catalogue',
          features: { priceVisibility: { enabled: false } },
          id: 'store',
        },
        tenantId: 'monitor',
        isActive: true,
        updatedAt: '2026-05-07T08:41:44+00:00',
        ...overrides,
      };
    }

    it('extracts root-level tenantId when absent from appSettings', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      expect(result.tenantId).toBe('monitor');
    });

    it('extracts root-level isActive when absent from appSettings', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      expect(result.isActive).toBe(true);
    });

    it('derives hostname from geinsSettings.defaultHostName when absent from appSettings', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      expect(result.hostname).toBe('tenant-b.sales-portal.geins.dev');
    });

    it('lets appSettings.tenantId override root-level tenantId', () => {
      const raw = rawApiResponse();
      (raw.appSettings as Record<string, unknown>).tenantId =
        'from-app-settings';
      const result = adaptMerchantApiResponse(raw);
      expect(result.tenantId).toBe('from-app-settings');
    });

    it('merges additionalHostNames into aliases', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      expect(result.aliases).toContain('tenant-b.litium.portal');
    });

    it('strips the id field from appSettings', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      expect(result.id).toBeUndefined();
    });

    it('transforms channelId into channel + tld in geinsSettings', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      const gs = result.geinsSettings as Record<string, unknown>;
      expect(gs.channel).toBe('2');
      expect(gs.tld).toBe('se');
    });
  });
});
