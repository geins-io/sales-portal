import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  tenantIdKey,
  tenantConfigKey,
  collectAllHostnames,
  buildTenantConfig,
  writeHostnameMappings,
  parseStoreSettingsResilient,
  adaptMerchantApiResponse,
  deleteAtPath,
  backfillCoreColors,
  mergeDeep,
  resolvePreviewTenant,
} from '../../server/utils/tenant';
import partialPayloadFixture from '../fixtures/store-settings/partial-payload.json';
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
const { mockLoggerWarn, mockUseRuntimeConfig, mockUseStorage } = vi.hoisted(
  () => ({
    mockLoggerWarn: vi.fn(),
    mockUseRuntimeConfig: vi.fn(() => ({
      geins: { tenantApiUrl: 'https://merchant.example/api/tenant' },
    })),
    mockUseStorage: vi.fn(() => ({
      getItem: vi.fn(() => Promise.resolve(null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      hasItem: vi.fn(() => Promise.resolve(false)),
    })),
  }),
);
vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRuntimeConfig: mockUseRuntimeConfig,
    useStorage: mockUseStorage,
  };
});
vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRuntimeConfig: mockUseRuntimeConfig,
  };
});
vi.mock('nitropack/runtime/internal/config', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    useRuntimeConfig: mockUseRuntimeConfig,
  };
});
vi.mock('nitropack/runtime/internal/storage', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    useStorage: mockUseStorage,
  };
});
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

    it('includes portal-only feature defaults even when settings.features is empty', () => {
      const built = buildTenantConfig({ ...baseSettings, features: {} });
      expect(built.features.registration?.enabled).toBe(true);
      expect(built.features.applyForAccount?.enabled).toBe(true);
    });

    it('lets settings.features override portal defaults', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        features: { registration: { enabled: false } },
      });
      expect(built.features.registration?.enabled).toBe(false);
      expect(built.features.applyForAccount?.enabled).toBe(true);
    });

    it('lets overrides.features take final precedence over portal defaults', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        features: {},
        overrides: { features: { applyForAccount: { enabled: false } } },
      });
      expect(built.features.applyForAccount?.enabled).toBe(false);
    });
  });

  describe('buildTenantConfig storefront-settings defaults integration', () => {
    function minimalSettings(): StoreSettings {
      return {
        tenantId: 'tenant-defaults',
        hostname: 'tenant-defaults.litium.store',
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
        checkoutMode: 'custom',
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
        branding: { name: 'X', watermark: 'full' },
        features: {},
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
    }

    it('empty appSettings applies canonical defaults (Studio-managed flags off)', () => {
      const built = buildTenantConfig(minimalSettings());
      expect(built.features.stockStatus?.enabled).toBe(false);
      expect(built.features.priceVisibility).toMatchObject({
        enabled: false,
        access: 'authenticated',
      });
      expect(built.features.cart?.enabled).toBe(true);
      expect(built.theme.radius).toBe('0');
    });

    it('partial features merges per-key (api wins on present, default fills missing)', () => {
      const built = buildTenantConfig({
        ...minimalSettings(),
        features: {
          priceVisibility: { enabled: false, access: 'authenticated' },
        },
      });
      expect(built.features.priceVisibility?.enabled).toBe(false);
      // Studio-managed siblings without an explicit API value default off
      expect(built.features.orderPlacement?.enabled).toBe(false);
      expect(built.features.stockStatus?.enabled).toBe(false);
      // Baseline storefront flags remain on by default
      expect(built.features.cart?.enabled).toBe(true);
    });

    it('partial payload fixture: missing stockStatus key resolves to default-off', () => {
      const candidate = adaptMerchantApiResponse(
        partialPayloadFixture as unknown as Record<string, unknown>,
      );
      const settings = parseStoreSettingsResilient(
        candidate,
        'partial.example.com',
      );
      expect(settings).not.toBeNull();
      const built = buildTenantConfig(settings as StoreSettings);
      // Absent from payload, resolves to the default-off rule for Studio-managed flags
      expect(built.features.stockStatus?.enabled).toBe(false);
      // Explicit false from the payload
      expect(built.features.priceVisibility?.enabled).toBe(false);
      expect(built.features.orderPlacement?.enabled).toBe(false);
    });

    it('full payload preserves every explicit api value over defaults', () => {
      const built = buildTenantConfig({
        ...minimalSettings(),
        mode: 'catalog',
        theme: {
          ...minimalSettings().theme,
          radius: '1rem',
        },
        features: {
          stockStatus: { enabled: true, access: 'authenticated' },
          priceVisibility: { enabled: false, access: 'all' },
          orderPlacement: { enabled: false, access: 'authenticated' },
        },
        seo: { robots: 'noindex, nofollow' },
        branding: {
          name: 'Explicit',
          watermark: 'minimal',
          logoUrl: 'https://example.com/logo.png',
        },
      });
      expect(built.mode).toBe('catalog');
      expect(built.theme.radius).toBe('1rem');
      expect(built.features.stockStatus?.enabled).toBe(true);
      expect(built.features.priceVisibility?.enabled).toBe(false);
      expect(built.features.orderPlacement?.enabled).toBe(false);
      expect(built.seo?.robots).toBe('noindex, nofollow');
      expect(built.branding.logoUrl).toBe('https://example.com/logo.png');
    });

    it('fills branding.name from geinsSettings.accountName when name is empty', () => {
      const settings = minimalSettings();
      settings.branding = { name: '', watermark: 'full' };
      settings.geinsSettings.accountName = 'acme-merchant';
      const built = buildTenantConfig(settings);
      expect(built.branding.name).toBe('acme-merchant');
    });

    it('falls back to hostname when both branding.name and accountName are empty', () => {
      const settings = minimalSettings();
      settings.branding = { name: '   ', watermark: 'full' };
      settings.geinsSettings.accountName = '';
      settings.hostname = 'fallback.example.com';
      const built = buildTenantConfig(settings);
      expect(built.branding.name).toBe('fallback.example.com');
    });

    it('preserves an explicit branding.name', () => {
      const settings = minimalSettings();
      settings.branding = { name: 'Tenant A Store', watermark: 'full' };
      settings.geinsSettings.accountName = 'tenant-a';
      const built = buildTenantConfig(settings);
      expect(built.branding.name).toBe('Tenant A Store');
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
      // The salvage theme is now computed lazily from
      // `createDefaultTheme(hostname).colors`, so the palette matches the
      // canonical default for this hostname (zinc for non-localhost).
      expect(out?.theme.colors.primary).toBe('oklch(0.205 0 0)');
    });

    it('salvages a candidate with missing branding by using geinsSettings.accountName', () => {
      const candidate = fullCandidate();
      delete candidate.branding;
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      // accountName in fullCandidate() is 'a'
      expect(out?.branding.name).toBe('a');
      expect(out?.branding.watermark).toBe('full');
    });

    it('salvages branding without leaving a literal "Store" name', () => {
      const candidate = fullCandidate();
      delete candidate.branding;
      const out = parseStoreSettingsResilient(candidate, 'store-fallback.host');
      expect(out).not.toBeNull();
      expect(out?.branding.name).not.toBe('Store');
    });

    it('salvages a freshly provisioned tenant with empty appSettings end-to-end', () => {
      // Merchant API shape for a newly set-up customer system: identity
      // fields at the root, empty appSettings, and the standard
      // geinsSettings credentials block. Previously 500'd because
      // `features` was a fatal path. Now the resilient parser salvages
      // it and buildTenantConfig overlays the PORTAL_FEATURE_DEFAULTS.
      const raw = {
        geinsSettings: {
          defaultHostName: 'tinatest1.litium.store',
          additionalHostNames: [],
          apiKey: 'E0EB51F2-B663-457F-A7F9-A75693FD8469',
          accountName: 'tinatest1',
          channelId: '1|se',
          defaultLocale: 'sv-SE',
          defaultMarket: 'se',
          locales: ['sv-SE'],
          markets: ['se'],
        },
        appSettings: {},
        tenantId: 'tinatest1',
        isActive: true,
        updatedAt: '0001-01-01T00:00:00+00:00',
      };
      const candidate = adaptMerchantApiResponse(raw);
      const out = parseStoreSettingsResilient(
        candidate,
        'tinatest1.litium.store',
      );
      expect(out).not.toBeNull();
      expect(out?.tenantId).toBe('tinatest1');
      expect(out?.features).toEqual({});
      const cfg = buildTenantConfig(out as StoreSettings);
      expect(cfg.features.registration?.enabled).toBe(true);
      expect(cfg.features.applyForAccount?.enabled).toBe(true);
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
      // Core colors stay verbatim, surface colors are now coerced to oklch.
      const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
      expect(out?.theme.colors.primary).toMatch(oklchPattern);
      expect(out?.theme.colors.topBarBackground).toMatch(oklchPattern);
      expect(out?.theme.colors.footerBackground).toMatch(oklchPattern);
      expect(out?.theme.colors.navBarBackground).toMatch(oklchPattern);
    });

    it('parses the partial payload fixture (no core colors, surface-only palette) without blanking', () => {
      // Regression artifact: this exact payload caused production blanking
      // before the salvager learned to leaf-strip and core-backfill. The
      // fixture intentionally has zero core OKLCH keys and only surface
      // colors (one with 8-digit alpha hex). Reverting the fix should make
      // this test fail loudly.
      const candidate = adaptMerchantApiResponse(
        partialPayloadFixture as unknown as Record<string, unknown>,
      );
      const out = parseStoreSettingsResilient(candidate, 'partial.example.com');
      expect(out).not.toBeNull();
      const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
      const withAlphaPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+ \/ [\d.]+\)$/;
      for (const key of [
        'primary',
        'primaryForeground',
        'secondary',
        'secondaryForeground',
        'background',
        'foreground',
      ] as const) {
        expect(out?.theme.colors[key]).toMatch(oklchPattern);
      }
      // The 8-digit alpha hex `#eae8dc99` is coerced AND alpha is preserved
      // (the admin's saved value is the truth).
      expect(out?.theme.colors.topBarBackground).toMatch(withAlphaPattern);
    });

    it('every theme.colors value garbage still returns a non-null config', () => {
      const candidate = fullCandidate();
      candidate.theme = {
        colors: {
          primary: 'banana',
          primaryForeground: 'not-a-color',
          secondary: '',
          secondaryForeground: '???',
          background: 'rgb(banana, 0, 0)',
          foreground: 'oklch(broken)',
          topBarBackground: 'nope',
          footerBackground: 'also-nope',
        },
      };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
      for (const key of [
        'primary',
        'primaryForeground',
        'secondary',
        'secondaryForeground',
        'background',
        'foreground',
      ] as const) {
        expect(out?.theme.colors[key]).toMatch(oklchPattern);
      }
    });

    it('theme.colors as an empty object returns a non-null config', () => {
      const candidate = fullCandidate();
      candidate.theme = { colors: {} };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
      for (const key of [
        'primary',
        'primaryForeground',
        'secondary',
        'secondaryForeground',
        'background',
        'foreground',
      ] as const) {
        expect(out?.theme.colors[key]).toMatch(oklchPattern);
      }
    });

    it('theme.colors entirely missing returns a non-null config', () => {
      const candidate = fullCandidate();
      candidate.theme = {};
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
      for (const key of [
        'primary',
        'primaryForeground',
        'secondary',
        'secondaryForeground',
        'background',
        'foreground',
      ] as const) {
        expect(out?.theme.colors[key]).toMatch(oklchPattern);
      }
    });

    it('many bad leaves do not cause an infinite loop', () => {
      // Forge a candidate with every declared color key set to garbage,
      // plus a handful of unknown keys that Zod strips silently. The total
      // exceeds the old 32-strip budget but stays under the new 64 cap, so
      // the hard guarantee holds: no combination of color values can blank
      // a tenant. We assert non-null directly here, not the soft if-branch.
      const candidate = fullCandidate();
      const declaredColorKeys = [
        'primary',
        'primaryForeground',
        'secondary',
        'secondaryForeground',
        'background',
        'foreground',
        'card',
        'cardForeground',
        'popover',
        'popoverForeground',
        'muted',
        'mutedForeground',
        'accent',
        'accentForeground',
        'destructive',
        'destructiveForeground',
        'border',
        'input',
        'ring',
        'sidebar',
        'sidebarForeground',
        'sidebarPrimary',
        'sidebarPrimaryForeground',
        'sidebarAccent',
        'sidebarAccentForeground',
        'sidebarBorder',
        'sidebarRing',
        'topBarBackground',
        'footerBackground',
        'navBarBackground',
        'siteBackground',
        'buttonBackground',
        'buttonPurchaseBackground',
        'topBarText',
        'footerText',
      ];
      const colors: Record<string, string> = {};
      for (const key of declaredColorKeys) {
        colors[key] = 'not-a-color';
      }
      // Pad to 50 garbage entries total to exercise the path comfortably
      // beyond the previous 32-strip ceiling.
      for (let i = 0; declaredColorKeys.length + i < 50; i++) {
        colors[`unknownColor${i}`] = 'still-not-a-color';
      }
      candidate.theme = { colors };
      const start = Date.now();
      const out = parseStoreSettingsResilient(candidate, 'h');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
      expect(out).not.toBeNull();
      const oklchPattern = /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/;
      expect(out?.theme.colors.primary).toMatch(oklchPattern);
    });

    it('strips multiple bad leaves and logs each one', () => {
      mockLoggerWarn.mockClear();
      const candidate = fullCandidate();
      candidate.theme = {
        colors: {
          primary: 'oklch(0.5 0.2 200)',
          primaryForeground: 'oklch(0.95 0.01 200)',
          secondary: 'oklch(0.9 0.05 200)',
          secondaryForeground: 'oklch(0.2 0.02 200)',
          background: 'oklch(1 0 0)',
          foreground: 'oklch(0.1 0 0)',
          topBarBackground: 'banana',
          footerBackground: 'not-a-color',
          navBarBackground: 'nope',
          siteBackground: '???',
          buttonBackground: 'broken',
        },
      };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out).not.toBeNull();
      // The salvager rolls every stripped leaf into one summary warn at
      // the end: `... N leaf-strip(s): path1; path2; ...`. Find the
      // rollup line, then assert the count plus every expected path.
      const rollup = mockLoggerWarn.mock.calls.find(
        (args) => typeof args[0] === 'string' && args[0].includes('leaf-strip'),
      );
      expect(rollup).toBeDefined();
      const message = rollup?.[0] as string;
      expect(message).toContain('5 leaf-strip(s)');
      for (const key of [
        'topBarBackground',
        'footerBackground',
        'navBarBackground',
        'siteBackground',
        'buttonBackground',
      ]) {
        expect(message).toContain(`theme.colors.${key}`);
      }
    });
  });

  describe('deleteAtPath', () => {
    it('removes a nested object key in place', () => {
      const obj = { a: { b: { c: 1, d: 2 } } };
      const removed = deleteAtPath(obj, ['a', 'b', 'c']);
      expect(removed).toBe(true);
      expect(obj).toEqual({ a: { b: { d: 2 } } });
    });

    it('removes an array index without leaving a hole', () => {
      const obj = { items: ['x', 'y', 'z'] };
      const removed = deleteAtPath(obj, ['items', 1]);
      expect(removed).toBe(true);
      expect(obj.items).toEqual(['x', 'z']);
      expect(obj.items.length).toBe(2);
    });

    it('returns false when the path is empty or root is not an object', () => {
      expect(deleteAtPath(null, ['a'])).toBe(false);
      expect(deleteAtPath({ a: 1 }, [])).toBe(false);
    });

    it('returns false when the key is not present', () => {
      const obj = { a: { b: 1 } };
      expect(deleteAtPath(obj, ['a', 'missing'])).toBe(false);
      expect(obj).toEqual({ a: { b: 1 } });
    });

    it('returns false on out-of-range array index', () => {
      const obj = { items: ['x'] };
      expect(deleteAtPath(obj, ['items', 5])).toBe(false);
      expect(obj.items).toEqual(['x']);
    });

    it('refuses to walk dangerous prototype-pollution segments', () => {
      const obj: Record<string, unknown> = { real: 'value' };
      expect(deleteAtPath(obj, ['__proto__', 'isAdmin'])).toBe(false);
      expect(deleteAtPath(obj, ['constructor', 'prototype'])).toBe(false);
      expect(deleteAtPath(obj, ['prototype'])).toBe(false);
      expect(obj.real).toBe('value');
    });
  });

  describe('backfillCoreColors', () => {
    it('fills only undefined core keys and leaves existing values alone', () => {
      const theme = {
        colors: {
          primary: 'oklch(0.3 0.1 50)',
          // secondary, etc. missing
        },
      } as unknown as StoreSettings['theme'];
      const filled = backfillCoreColors(theme, 'h');
      expect(theme.colors.primary).toBe('oklch(0.3 0.1 50)');
      expect(theme.colors.secondary).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(filled).toContain('secondary');
      expect(filled).not.toContain('primary');
    });

    it('returns an empty list when all core keys are already present', () => {
      const theme = {
        colors: {
          primary: 'oklch(0 0 0)',
          primaryForeground: 'oklch(1 0 0)',
          secondary: 'oklch(0.5 0 0)',
          secondaryForeground: 'oklch(0.2 0 0)',
          background: 'oklch(1 0 0)',
          foreground: 'oklch(0.1 0 0)',
        },
      } as unknown as StoreSettings['theme'];
      const filled = backfillCoreColors(theme, 'h');
      expect(filled).toEqual([]);
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

  describe('resolvePreviewTenant', () => {
    function rawApiPayload(
      overrides: {
        primary?: string;
        brandingName?: string;
      } = {},
    ): Record<string, unknown> {
      return {
        tenantId: 'tenant-a',
        isActive: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
        geinsSettings: {
          defaultHostName: 'tenant-a.example.com',
          additionalHostNames: [],
          apiKey: 'E0EB51F2-B663-457F-A7F9-A75693FD8469',
          accountName: 'tenant-a',
          channelId: '1|se',
          defaultLocale: 'sv-SE',
          defaultMarket: 'se',
          locales: ['sv-SE'],
          markets: ['se'],
        },
        appSettings: {
          mode: 'commerce',
          theme: {
            colors: {
              primary: overrides.primary ?? 'oklch(0.5 0.1 200)',
              primaryForeground: 'oklch(0.9 0 0)',
              secondary: 'oklch(0.8 0 0)',
              secondaryForeground: 'oklch(0.2 0 0)',
              background: 'oklch(1 0 0)',
              foreground: 'oklch(0.1 0 0)',
            },
          },
          branding: {
            name: overrides.brandingName ?? 'Live Brand',
            watermark: 'full',
          },
          features: {},
        },
      };
    }

    function okResponse(body: Record<string, unknown>): Response {
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as unknown as Response;
    }

    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      mockLoggerWarn.mockClear();
      mockUseRuntimeConfig.mockReturnValue({
        geins: { tenantApiUrl: 'https://merchant.example/api/tenant' },
      });
      mockUseStorage.mockReturnValue({
        getItem: vi.fn(() => Promise.resolve(null)),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        hasItem: vi.fn(() => Promise.resolve(false)),
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('merges preview values over live (overlay wins, missing inherit)', async () => {
      const live = rawApiPayload({
        primary: 'oklch(0.5 0.1 200)',
        brandingName: 'Live Brand',
      });
      const preview = rawApiPayload({
        primary: 'oklch(0.7 0.2 300)',
      });
      // Remove branding.name from preview so it inherits from live.
      delete (preview.appSettings as Record<string, unknown>).branding;

      const fetchSpy = vi.fn(async (url: string) => {
        return url.includes('previewKey=preview')
          ? okResponse(preview)
          : okResponse(live);
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const result = await resolvePreviewTenant('tenant-a.example.com');
      expect(result).not.toBeNull();
      // Preview primary wins
      expect(result?.theme.colors.primary).toBe('oklch(0.7 0.2 300)');
      // Branding name inherited from live
      expect(result?.branding.name).toBe('Live Brand');
    });

    it('fires both fetches in parallel', async () => {
      const live = rawApiPayload();
      const preview = rawApiPayload({ primary: 'oklch(0.7 0.2 300)' });

      let resolveLive: (r: Response) => void = () => {};
      let resolvePreview: (r: Response) => void = () => {};
      const livePromise = new Promise<Response>((r) => {
        resolveLive = r;
      });
      const previewPromise = new Promise<Response>((r) => {
        resolvePreview = r;
      });

      const fetchSpy = vi.fn((url: string) => {
        return url.includes('previewKey=preview')
          ? previewPromise
          : livePromise;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const pending = resolvePreviewTenant('tenant-a.example.com');

      // Both fetches must have been called before either resolved.
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const calledUrls = fetchSpy.mock.calls.map((c) => c[0] as string);
      expect(calledUrls.some((u) => u.includes('previewKey=preview'))).toBe(
        true,
      );
      expect(calledUrls.some((u) => !u.includes('previewKey=preview'))).toBe(
        true,
      );

      resolveLive(okResponse(live));
      resolvePreview(okResponse(preview));
      const result = await pending;
      expect(result).not.toBeNull();
    });

    it('falls back to live when preview fetch rejects (logs warn)', async () => {
      const live = rawApiPayload({ brandingName: 'Live Brand' });
      const fetchSpy = vi.fn(async (url: string) => {
        if (url.includes('previewKey=preview')) {
          throw new Error('preview unavailable');
        }
        return okResponse(live);
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const result = await resolvePreviewTenant('tenant-a.example.com');
      expect(result).not.toBeNull();
      expect(result?.branding.name).toBe('Live Brand');
      const previewWarnCalls = mockLoggerWarn.mock.calls.filter(
        ([msg]) =>
          typeof msg === 'string' &&
          msg.includes('STORE_SETTINGS_PREVIEW_FETCH_FAILED'),
      );
      expect(previewWarnCalls).toHaveLength(1);
      expect(previewWarnCalls[0]![0]).toContain('tenant-a.example.com');
    });

    it('returns null when both fetches reject', async () => {
      const fetchSpy = vi.fn(async () => {
        throw new Error('network down');
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const result = await resolvePreviewTenant('tenant-a.example.com');
      expect(result).toBeNull();
    });

    it('never writes to KV storage', async () => {
      const live = rawApiPayload();
      const preview = rawApiPayload({ primary: 'oklch(0.7 0.2 300)' });
      const fetchSpy = vi.fn(async (url: string) => {
        return url.includes('previewKey=preview')
          ? okResponse(preview)
          : okResponse(live);
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const setItemSpy = vi.fn();
      const removeItemSpy = vi.fn();
      mockUseStorage.mockReturnValue({
        getItem: vi.fn(() => Promise.resolve(null)),
        setItem: setItemSpy,
        removeItem: removeItemSpy,
        hasItem: vi.fn(() => Promise.resolve(false)),
      });

      const result = await resolvePreviewTenant('tenant-a.example.com');
      expect(result).not.toBeNull();
      expect(setItemSpy).not.toHaveBeenCalled();
      expect(removeItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('mergeDeep', () => {
    it('overlays override values on top of base recursively', () => {
      const base = { a: 1, nested: { x: 1, y: 2 } };
      const override = { nested: { y: 99, z: 3 }, b: 'extra' };
      expect(mergeDeep(base, override)).toEqual({
        a: 1,
        nested: { x: 1, y: 99, z: 3 },
        b: 'extra',
      });
    });

    it('keeps falsy override values (empty string, false, null) as winning', () => {
      const base = { a: 'live', b: true, c: 'keep-me' };
      const override = { a: '', b: false, c: null };
      expect(mergeDeep(base, override)).toEqual({ a: '', b: false, c: null });
    });
  });
});
