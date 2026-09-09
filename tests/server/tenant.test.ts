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
  DEFAULT_CMS_CONFIG,
} from '../../server/utils/tenant';
import { canAccessFeature } from '../../shared/utils/feature-access';
import { CMS_MENUS } from '../../shared/constants/cms';
import { CMS_SLOTS } from '../../shared/types/cms-slots';
import partialPayloadFixture from '../fixtures/store-settings/partial-payload.json';
import {
  createDefaultTheme,
  generateTenantCss,
  generateThemeHash,
  generateOverrideCss,
  mergeThemes,
} from '../../server/utils/tenant-css';
import type { FeatureAccess, TenantConfig } from '#shared/types/tenant-config';
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
        tenantId: 'alpha',
        hostname: 'alpha.example',
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
        checkoutMode: 'custom',
        theme: createDefaultTheme('alpha'),
        branding: { name: 'Alpha', watermark: 'full' },
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
      expect(hostnames.has('alpha.example')).toBe(true);
    });

    it('should include hostname and all aliases', () => {
      const config = createMinimalConfig({
        aliases: ['alpha.localhost', 'alpha.sales-portal.geins.dev'],
      });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(3);
      expect(hostnames.has('alpha.example')).toBe(true);
      expect(hostnames.has('alpha.localhost')).toBe(true);
      expect(hostnames.has('alpha.sales-portal.geins.dev')).toBe(true);
    });

    it('should deduplicate when hostname appears in aliases', () => {
      const config = createMinimalConfig({
        aliases: ['alpha.example', 'alpha.localhost'],
      });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(2);
    });

    it('should skip empty/falsy alias entries', () => {
      const config = createMinimalConfig({
        aliases: ['alpha.localhost', '', undefined as unknown as string],
      });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(2);
      expect(hostnames.has('alpha.example')).toBe(true);
      expect(hostnames.has('alpha.localhost')).toBe(true);
    });

    it('should return empty set when hostname is empty and no aliases', () => {
      const config = createMinimalConfig({ hostname: '' });
      const hostnames = collectAllHostnames(config);
      expect(hostnames.size).toBe(0);
    });
  });

  describe('buildTenantConfig theme.name fallback', () => {
    const baseSettings: StoreSettings = {
      tenantId: 'delta',
      hostname: 'delta.litium.store',
      geinsSettings: {
        apiKey: 'k',
        accountName: 'delta',
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
      branding: { name: 'Delta', watermark: 'minimal' },
      features: {},
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('uses tenantId when theme.name is missing', () => {
      const built = buildTenantConfig(baseSettings);
      expect(built.theme.name).toBe('delta');
      expect(built.css).toContain("[data-theme='delta']");
    });

    it('preserves explicit theme.name when provided', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        theme: { ...baseSettings.theme, name: 'ocean' },
      });
      expect(built.theme.name).toBe('ocean');
      expect(built.css).toContain("[data-theme='ocean']");
    });

    /**
     * The group tests in tests/unit/server/utils/tenant-css.test.ts call the
     * emitter directly. This one covers the hop above it: a configured value
     * survives `mergeStorefrontSettings`, which deep-merges the canonical
     * defaults *under* the API response, and still reaches `config.css`.
     * One test, not 34 — the per-key discrimination is the group tests' job.
     *
     * `mergeStorefrontSettings` is the merge in this path, not
     * `createDefaultTheme`: that one is reached through `backfillCoreColors`
     * (tenant.ts:771 and :885), which runs inside the resilient parse and
     * fills only core colours that arrived undefined.
     */
    it('carries a configured colour, surface and font family through the merge into config.css', () => {
      const built = buildTenantConfig({
        ...baseSettings,
        theme: {
          ...baseSettings.theme,
          colors: {
            ...baseSettings.theme.colors,
            primary: 'oklch(0.20 0 0)',
            card: 'oklch(0.50 0 0)',
            topBarText: 'oklch(0.55 0 0)',
          },
          typography: { fontFamily: 'Sentinel Body' },
        },
      });

      // A required core colour, an optional one the server would otherwise
      // derive, a surface, and a typography family: four different code paths
      // through the merge, all landing in the same emitted stylesheet.
      expect(built.css, 'primary').toContain('--primary: #161616;');
      expect(built.css, 'card').toContain('--card: #636363;');
      expect(built.css, 'topBarText').toContain('--top-bar-text: #717171;');
      expect(built.css, 'fontFamily').toContain(
        "--font-family: 'Sentinel Body', ui-sans-serif, system-ui, sans-serif;",
      );
      // The merge must not rewrite the value it was handed.
      expect(built.theme.colors.primary).toBe('oklch(0.20 0 0)');
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

  describe('buildTenantConfig retired access rules', () => {
    const retiredSettings: StoreSettings = {
      tenantId: 'tenant-r',
      hostname: 'tenant-r.litium.store',
      geinsSettings: {
        apiKey: 'k',
        accountName: 'tenant-r',
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
      branding: { name: 'Tenant R', watermark: 'minimal' },
      features: {},
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    // Still valid on the wire — FeatureAccessSchema accepts all four.
    const retiredRules = [
      ['group', { group: 'staff' }],
      ['accountType', { accountType: 'enterprise' }],
      ['permission', { permission: 'orders:create' }],
      ['role', { role: 'order_placer' }],
    ] as const;

    beforeEach(() => {
      mockLoggerWarn.mockClear();
    });

    for (const [key, rule] of retiredRules) {
      it(`disables a feature carrying { ${key} } and says why`, () => {
        const built = buildTenantConfig({
          ...retiredSettings,
          features: { staffPricing: { enabled: true, access: rule } },
        });

        expect(built.features.staffPricing).toEqual({ enabled: false });
        expect(built.features.staffPricing).not.toHaveProperty('access');

        const warned = mockLoggerWarn.mock.calls.map(String).join('\n');
        expect(warned).toContain('staffPricing');
        expect(warned).toContain(key);
        expect(warned).toContain('tenant-r.litium.store');
      });

      it(`denies { ${key} } for anonymous and signed-in alike after normalisation`, () => {
        const built = buildTenantConfig({
          ...retiredSettings,
          features: { staffPricing: { enabled: true, access: rule } },
        });
        const feature = built.features.staffPricing;

        // hasFeature() reads .enabled only, so it flips to false: UI gated on
        // it alone is hidden rather than rendered and then denied.
        expect(feature?.enabled).toBe(false);
        expect(canAccessFeature(feature, { authenticated: false })).toBe(false);
        expect(canAccessFeature(feature, { authenticated: true })).toBe(false);
      });

      it(`parses a raw candidate carrying { ${key} } without stripping the leaf`, () => {
        // The regression guard for the whole design: FeatureAccessSchema still
        // accepts the rule, so the parse succeeds on the first attempt and
        // stage 2 of the salvage never deletes features.<name>.access. A
        // stripped leaf would leave { enabled: true } with no access, which
        // canAccessFeature treats as "everyone".
        const candidate: Record<string, unknown> = {
          ...retiredSettings,
          features: { staffPricing: { enabled: true, access: rule } },
        };

        const parsed = parseStoreSettingsResilient(candidate, 'tenant-r');
        expect(parsed).not.toBeNull();
        expect(parsed?.features.staffPricing).toEqual({
          enabled: true,
          access: rule,
        });
        expect(
          mockLoggerWarn.mock.calls.some((call) =>
            String(call[0]).includes('leaf-strip'),
          ),
        ).toBe(false);

        const built = buildTenantConfig(parsed as StoreSettings);
        expect(built.features.staffPricing).toEqual({ enabled: false });
      });

      it(`retires { ${key} } arriving through overrides.features`, () => {
        const built = buildTenantConfig({
          ...retiredSettings,
          features: { staffPricing: { enabled: true } },
          overrides: {
            features: { staffPricing: { enabled: true, access: rule } },
          },
        });

        expect(built.features.staffPricing).toEqual({ enabled: false });
        expect(built.overrides?.features?.staffPricing).toEqual({
          enabled: false,
        });
      });
    }

    it('retires a string rule outside the evaluable set and names it', () => {
      // FeatureAccessSchema is a separate source of truth from FeatureAccess, so
      // a literal added only to the schema would arrive as a string the app
      // cannot evaluate. The cast constructs that state ahead of time: it must
      // be retired like an object rule, not treated as evaluable.
      const built = buildTenantConfig({
        ...retiredSettings,
        features: {
          staffPricing: {
            enabled: true,
            access: 'staff' as unknown as FeatureAccess,
          },
        },
      });

      expect(built.features.staffPricing).toEqual({ enabled: false });
      expect(built.features.staffPricing).not.toHaveProperty('access');

      const warned = mockLoggerWarn.mock.calls.map(String).join('\n');
      expect(warned).toContain('staffPricing');
      // The rule's own name, not the character indices of the string.
      expect(warned).toContain('"staff"');
    });

    it('leaves the evaluable rules and a rule-less feature untouched', () => {
      const built = buildTenantConfig({
        ...retiredSettings,
        features: {
          openToAll: { enabled: true, access: 'all' },
          signedIn: { enabled: true, access: 'authenticated' },
          plain: { enabled: true },
        },
      });

      expect(built.features.openToAll).toEqual({
        enabled: true,
        access: 'all',
      });
      expect(built.features.signedIn).toEqual({
        enabled: true,
        access: 'authenticated',
      });
      expect(built.features.plain).toEqual({ enabled: true });
      expect(mockLoggerWarn).not.toHaveBeenCalled();
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
        seo: { robots: 'noindex, nofollow', defaultKeywords: undefined },
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
      settings.branding = { name: 'Alpha Store', watermark: 'full' };
      settings.geinsSettings.accountName = 'alpha';
      const built = buildTenantConfig(settings);
      expect(built.branding.name).toBe('Alpha Store');
    });
  });

  describe('buildTenantConfig cms config deep-merge', () => {
    // Both sections are optional on the type. Reading them through `?.` on the
    // expected side too would make a missing default compare undefined to
    // undefined and pass, so resolve them here and fail loudly instead.
    function defaultMenu(
      key: keyof NonNullable<typeof DEFAULT_CMS_CONFIG.menus>,
    ) {
      const menu = DEFAULT_CMS_CONFIG.menus?.[key];
      if (!menu) throw new Error(`DEFAULT_CMS_CONFIG has no menu '${key}'`);
      return menu;
    }

    function defaultSlot(
      key: keyof NonNullable<typeof DEFAULT_CMS_CONFIG.slots>,
    ) {
      const slot = DEFAULT_CMS_CONFIG.slots?.[key];
      if (!slot) throw new Error(`DEFAULT_CMS_CONFIG has no slot '${key}'`);
      return slot;
    }

    function settingsWithCms(cms?: StoreSettings['cms']): StoreSettings {
      return {
        tenantId: 'tenant-cms',
        hostname: 'tenant-cms.litium.store',
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
        cms,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
    }

    it('unconfigured tenant resolves to the full code defaults', () => {
      const built = buildTenantConfig(settingsWithCms(undefined));
      expect(built.cms).toEqual(DEFAULT_CMS_CONFIG);
    });

    it('tenant cms that omits footer_2/footer_3 still inherits them from defaults', () => {
      // The kickback scenario: a tenant whose cms block configures only the
      // primary footer menu used to lose every default, so footer-2/footer-3
      // never reached the storefront. Deep-merge restores them.
      const built = buildTenantConfig(
        settingsWithCms({
          menus: { [CMS_MENUS.FOOTER]: { menuLocationId: 'footer' } },
        }),
      );
      expect(built.cms?.menus?.[CMS_MENUS.FOOTER_2]?.menuLocationId).toBe(
        defaultMenu(CMS_MENUS.FOOTER_2).menuLocationId,
      );
      expect(built.cms?.menus?.[CMS_MENUS.FOOTER_3]?.menuLocationId).toBe(
        defaultMenu(CMS_MENUS.FOOTER_3).menuLocationId,
      );
    });

    it('an explicit tenant menu override wins over the default for that key', () => {
      const built = buildTenantConfig(
        settingsWithCms({
          menus: { [CMS_MENUS.FOOTER]: { menuLocationId: 'custom-footer' } },
        }),
      );
      // Overridden key takes the tenant value
      expect(built.cms?.menus?.[CMS_MENUS.FOOTER]?.menuLocationId).toBe(
        'custom-footer',
      );
      // Sibling defaults remain intact
      expect(built.cms?.menus?.[CMS_MENUS.FOOTER_2]?.menuLocationId).toBe(
        'footer-2',
      );
    });

    it('configuring only menus still leaves the default slots present', () => {
      const built = buildTenantConfig(
        settingsWithCms({
          menus: { [CMS_MENUS.FOOTER]: { menuLocationId: 'footer' } },
        }),
      );
      expect(built.cms?.slots).toEqual(DEFAULT_CMS_CONFIG.slots);
    });

    it('a tenant slot override wins while sibling default slots are kept', () => {
      const built = buildTenantConfig(
        settingsWithCms({
          slots: {
            [CMS_SLOTS.FRONTPAGE_CONTENT]: {
              family: 'Custom Family',
              areaName: 'Custom Area',
            },
          },
        }),
      );
      expect(built.cms?.slots?.[CMS_SLOTS.FRONTPAGE_CONTENT]).toEqual({
        family: 'Custom Family',
        areaName: 'Custom Area',
      });
      // A sibling default slot the tenant did not touch is still present
      expect(built.cms?.slots?.[CMS_SLOTS.PORTAL_HERO]).toEqual(
        defaultSlot(CMS_SLOTS.PORTAL_HERO),
      );
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
      const config = makeConfigWithHostnames('alpha', 'a.example.com', [
        'a.alt.com',
      ]);
      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        config,
      );
      expect(storage.data.get(tenantIdKey('a.example.com'))).toBe('alpha');
      expect(storage.data.get(tenantIdKey('a.alt.com'))).toBe('alpha');
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('does NOT warn when re-writing the same tenantId to the same hostname', async () => {
      const storage = makeStorage();
      const config = makeConfigWithHostnames('alpha', 'a.example.com');
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
      const configA = makeConfigWithHostnames('alpha', 'shared.example.com');
      const configB = makeConfigWithHostnames('beta', 'shared.example.com');

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
      expect(msg).toContain('alpha');
      expect(msg).toContain('beta');
      expect(meta).toMatchObject({
        hostname: 'shared.example.com',
        previousTenantId: 'alpha',
        newTenantId: 'beta',
      });

      // Last-writer-wins: the KV is now pointing at beta.
      expect(storage.data.get(tenantIdKey('shared.example.com'))).toBe('beta');
    });
  });

  describe('parseStoreSettingsResilient', () => {
    function fullCandidate(): Record<string, unknown> {
      return {
        tenantId: 'alpha',
        hostname: 'alpha.example',
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
      expect(out?.tenantId).toBe('alpha');
    });

    it('salvages a candidate with an unknown mode value by defaulting to commerce', () => {
      const candidate = fullCandidate();
      candidate.mode = 'museum';
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out?.mode).toBe('commerce');
    });

    it('keeps the seo block intact when defaultKeywords is a comma string', () => {
      // Regression: the merchant API sends defaultKeywords as a comma string.
      // The seo block (title/description) must survive and keywords must
      // normalise to an array rather than the leaf being stripped as a type
      // mismatch.
      const candidate = fullCandidate();
      candidate.seo = {
        defaultTitle: 'Alpha Store',
        titleTemplate: '%s | Alpha Store',
        defaultDescription: 'B2B sales portal for Alpha',
        defaultKeywords: 'shoes,boots,sneakers',
        robots: 'noindex, nofollow',
      };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out?.seo?.defaultTitle).toBe('Alpha Store');
      expect(out?.seo?.defaultKeywords).toEqual(['shoes', 'boots', 'sneakers']);
    });

    it('keeps the seo block intact when verification is a flat token string', () => {
      // Regression: the merchant API sends verification as a flat Google Search
      // Console token string. It must survive on the seo block (and render as
      // the google-site-verification meta) rather than the leaf being stripped
      // as a type mismatch.
      const candidate = fullCandidate();
      candidate.seo = {
        defaultTitle: 'Alpha Store',
        verification: 'test-verify-abc123',
      };
      const out = parseStoreSettingsResilient(candidate, 'h');
      expect(out?.seo?.defaultTitle).toBe('Alpha Store');
      expect(out?.seo?.verification).toBe('test-verify-abc123');
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
          defaultHostName: 'gamma.litium.store',
          additionalHostNames: [],
          apiKey: 'k',
          accountName: 'gamma',
          channelId: '1|se',
          defaultLocale: 'sv-SE',
          defaultMarket: 'se',
          locales: ['sv-SE'],
          markets: ['se'],
        },
        appSettings: {},
        tenantId: 'gamma',
        isActive: true,
        updatedAt: '0001-01-01T00:00:00+00:00',
      };
      const candidate = adaptMerchantApiResponse(raw);
      const out = parseStoreSettingsResilient(candidate, 'gamma.litium.store');
      expect(out).not.toBeNull();
      expect(out?.tenantId).toBe('gamma');
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

    /**
     * `SafeUrlSchema` rejects `''`, so a merchant who clears a logo in the
     * admin sends a value the schema refuses. What the tenant then gets is
     * decided here rather than by the schema: `branding` and `contact` are
     * outside `FATAL_PATHS`, and the issue path is more than one segment
     * deep, so the salvager strips the single bad leaf instead of replacing
     * the whole block with `SALVAGE_DEFAULTS`.
     *
     * That distinction is the whole point of the cases below. Swap
     * leaf-stripping for top-level substitution and every assertion on the
     * *survivors* goes red, which is what stops a cleared logo from taking
     * the tenant's brand name with it.
     */
    describe('a cleared url is stripped as a leaf and takes nothing with it', () => {
      const BRANDING_URLS = {
        logoUrl: 'https://cdn.example.com/logo.svg',
        logoDarkUrl: 'https://cdn.example.com/logo-dark.svg',
        logoSymbolUrl: 'https://cdn.example.com/symbol.svg',
        faviconUrl: 'https://cdn.example.com/favicon.ico',
        ogImageUrl: 'https://cdn.example.com/og.png',
      } as const;

      const SOCIAL_URLS = {
        facebook: 'https://facebook.com/alpha',
        instagram: 'https://instagram.com/alpha',
        twitter: 'https://twitter.com/alpha',
        linkedin: 'https://linkedin.com/company/alpha',
        youtube: 'https://youtube.com/@alpha',
      } as const;

      /** Every branding url set, so the survivors can be asserted by name. */
      function brandedCandidate(): Record<string, unknown> {
        const candidate = fullCandidate();
        candidate.branding = { name: 'A', watermark: 'full', ...BRANDING_URLS };
        return candidate;
      }

      function socialCandidate(): Record<string, unknown> {
        const candidate = fullCandidate();
        candidate.contact = {
          email: 'hello@alpha.example',
          social: { ...SOCIAL_URLS },
        };
        return candidate;
      }

      it('clears branding.logoUrl and keeps the name and the other urls', () => {
        const candidate = brandedCandidate();
        (candidate.branding as Record<string, unknown>).logoUrl = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.branding).not.toHaveProperty('logoUrl');
        expect(out?.branding?.name).toBe('A');
        expect(out?.branding?.logoDarkUrl).toBe(BRANDING_URLS.logoDarkUrl);
        expect(out?.branding?.logoSymbolUrl).toBe(BRANDING_URLS.logoSymbolUrl);
        expect(out?.branding?.faviconUrl).toBe(BRANDING_URLS.faviconUrl);
        expect(out?.branding?.ogImageUrl).toBe(BRANDING_URLS.ogImageUrl);
      });

      it('clears branding.logoDarkUrl and keeps the name and the other urls', () => {
        const candidate = brandedCandidate();
        (candidate.branding as Record<string, unknown>).logoDarkUrl = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.branding).not.toHaveProperty('logoDarkUrl');
        expect(out?.branding?.name).toBe('A');
        expect(out?.branding?.logoUrl).toBe(BRANDING_URLS.logoUrl);
        expect(out?.branding?.logoSymbolUrl).toBe(BRANDING_URLS.logoSymbolUrl);
        expect(out?.branding?.faviconUrl).toBe(BRANDING_URLS.faviconUrl);
        expect(out?.branding?.ogImageUrl).toBe(BRANDING_URLS.ogImageUrl);
      });

      it('clears branding.logoSymbolUrl and keeps the name and the other urls', () => {
        const candidate = brandedCandidate();
        (candidate.branding as Record<string, unknown>).logoSymbolUrl = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.branding).not.toHaveProperty('logoSymbolUrl');
        expect(out?.branding?.name).toBe('A');
        expect(out?.branding?.logoUrl).toBe(BRANDING_URLS.logoUrl);
        expect(out?.branding?.logoDarkUrl).toBe(BRANDING_URLS.logoDarkUrl);
        expect(out?.branding?.faviconUrl).toBe(BRANDING_URLS.faviconUrl);
        expect(out?.branding?.ogImageUrl).toBe(BRANDING_URLS.ogImageUrl);
      });

      it('clears branding.faviconUrl and keeps the name and the other urls', () => {
        const candidate = brandedCandidate();
        (candidate.branding as Record<string, unknown>).faviconUrl = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.branding).not.toHaveProperty('faviconUrl');
        expect(out?.branding?.name).toBe('A');
        expect(out?.branding?.logoUrl).toBe(BRANDING_URLS.logoUrl);
        expect(out?.branding?.logoDarkUrl).toBe(BRANDING_URLS.logoDarkUrl);
        expect(out?.branding?.logoSymbolUrl).toBe(BRANDING_URLS.logoSymbolUrl);
        expect(out?.branding?.ogImageUrl).toBe(BRANDING_URLS.ogImageUrl);
      });

      it('clears branding.ogImageUrl and keeps the name and the other urls', () => {
        const candidate = brandedCandidate();
        (candidate.branding as Record<string, unknown>).ogImageUrl = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.branding).not.toHaveProperty('ogImageUrl');
        expect(out?.branding?.name).toBe('A');
        expect(out?.branding?.logoUrl).toBe(BRANDING_URLS.logoUrl);
        expect(out?.branding?.logoDarkUrl).toBe(BRANDING_URLS.logoDarkUrl);
        expect(out?.branding?.logoSymbolUrl).toBe(BRANDING_URLS.logoSymbolUrl);
        expect(out?.branding?.faviconUrl).toBe(BRANDING_URLS.faviconUrl);
      });

      it('clears both logo urls at once and keeps the name and the rest', () => {
        // Two cleared fields in one payload is what a merchant swapping a
        // brand actually sends, and it is the case a single-strip
        // implementation would get wrong: the loop has to converge, not
        // strip once and give up.
        const candidate = brandedCandidate();
        const branding = candidate.branding as Record<string, unknown>;
        branding.logoUrl = '';
        branding.logoDarkUrl = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.branding).not.toHaveProperty('logoUrl');
        expect(out?.branding).not.toHaveProperty('logoDarkUrl');
        expect(out?.branding?.name).toBe('A');
        expect(out?.branding?.logoSymbolUrl).toBe(BRANDING_URLS.logoSymbolUrl);
        expect(out?.branding?.faviconUrl).toBe(BRANDING_URLS.faviconUrl);
        expect(out?.branding?.ogImageUrl).toBe(BRANDING_URLS.ogImageUrl);
      });

      it('clears contact.social.facebook and keeps the other social urls', () => {
        const candidate = socialCandidate();
        const social = (
          candidate.contact as { social: Record<string, unknown> }
        ).social;
        social.facebook = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.contact?.social).not.toHaveProperty('facebook');
        expect(out?.contact?.email).toBe('hello@alpha.example');
        expect(out?.contact?.social?.instagram).toBe(SOCIAL_URLS.instagram);
        expect(out?.contact?.social?.twitter).toBe(SOCIAL_URLS.twitter);
        expect(out?.contact?.social?.linkedin).toBe(SOCIAL_URLS.linkedin);
        expect(out?.contact?.social?.youtube).toBe(SOCIAL_URLS.youtube);
      });

      it('clears contact.social.instagram and keeps the other social urls', () => {
        const candidate = socialCandidate();
        const social = (
          candidate.contact as { social: Record<string, unknown> }
        ).social;
        social.instagram = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.contact?.social).not.toHaveProperty('instagram');
        expect(out?.contact?.email).toBe('hello@alpha.example');
        expect(out?.contact?.social?.facebook).toBe(SOCIAL_URLS.facebook);
        expect(out?.contact?.social?.twitter).toBe(SOCIAL_URLS.twitter);
        expect(out?.contact?.social?.linkedin).toBe(SOCIAL_URLS.linkedin);
        expect(out?.contact?.social?.youtube).toBe(SOCIAL_URLS.youtube);
      });

      it('clears contact.social.twitter and keeps the other social urls', () => {
        const candidate = socialCandidate();
        const social = (
          candidate.contact as { social: Record<string, unknown> }
        ).social;
        social.twitter = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.contact?.social).not.toHaveProperty('twitter');
        expect(out?.contact?.email).toBe('hello@alpha.example');
        expect(out?.contact?.social?.facebook).toBe(SOCIAL_URLS.facebook);
        expect(out?.contact?.social?.instagram).toBe(SOCIAL_URLS.instagram);
        expect(out?.contact?.social?.linkedin).toBe(SOCIAL_URLS.linkedin);
        expect(out?.contact?.social?.youtube).toBe(SOCIAL_URLS.youtube);
      });

      it('clears contact.social.linkedin and keeps the other social urls', () => {
        const candidate = socialCandidate();
        const social = (
          candidate.contact as { social: Record<string, unknown> }
        ).social;
        social.linkedin = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.contact?.social).not.toHaveProperty('linkedin');
        expect(out?.contact?.email).toBe('hello@alpha.example');
        expect(out?.contact?.social?.facebook).toBe(SOCIAL_URLS.facebook);
        expect(out?.contact?.social?.instagram).toBe(SOCIAL_URLS.instagram);
        expect(out?.contact?.social?.twitter).toBe(SOCIAL_URLS.twitter);
        expect(out?.contact?.social?.youtube).toBe(SOCIAL_URLS.youtube);
      });

      it('clears contact.social.youtube and keeps the other social urls', () => {
        const candidate = socialCandidate();
        const social = (
          candidate.contact as { social: Record<string, unknown> }
        ).social;
        social.youtube = '';

        const out = parseStoreSettingsResilient(candidate, 'h');

        expect(out).not.toBeNull();
        expect(out?.contact?.social).not.toHaveProperty('youtube');
        expect(out?.contact?.email).toBe('hello@alpha.example');
        expect(out?.contact?.social?.facebook).toBe(SOCIAL_URLS.facebook);
        expect(out?.contact?.social?.instagram).toBe(SOCIAL_URLS.instagram);
        expect(out?.contact?.social?.twitter).toBe(SOCIAL_URLS.twitter);
        expect(out?.contact?.social?.linkedin).toBe(SOCIAL_URLS.linkedin);
      });
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
          defaultHostName: 'beta.sales-portal.geins.dev',
          additionalHostNames: ['beta.example'],
          apiKey: 'k',
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
      expect(result.hostname).toBe('beta.sales-portal.geins.dev');
    });

    it('lets appSettings.tenantId override root-level tenantId', () => {
      const raw = rawApiResponse();
      (raw.appSettings as Record<string, unknown>).tenantId =
        'from-app-settings';
      const result = adaptMerchantApiResponse(raw);
      expect(result.tenantId).toBe('from-app-settings');
    });

    it('takes aliases from additionalHostNames', () => {
      const result = adaptMerchantApiResponse(rawApiResponse());
      expect(result.aliases).toEqual(['beta.example']);
    });

    // Routing truth is geinsSettings alone: appSettings is free text the
    // tenant saved, and every name that reaches the config becomes a routing
    // entry.
    it('ignores appSettings.aliases', () => {
      const raw = rawApiResponse();
      (raw.appSettings as Record<string, unknown>).aliases = [
        'claimed.example.com',
      ];
      const result = adaptMerchantApiResponse(raw);
      expect(result.aliases).toEqual(['beta.example']);
      expect(result.aliases).not.toContain('claimed.example.com');
    });

    it('does not let appSettings.hostname override defaultHostName', () => {
      const raw = rawApiResponse();
      (raw.appSettings as Record<string, unknown>).hostname =
        'claimed.example.com';
      const result = adaptMerchantApiResponse(raw);
      expect(result.hostname).toBe('beta.sales-portal.geins.dev');
    });

    // `hostname` is required and fatal, so a tenant whose Geins record carries
    // no defaultHostName would resolve to nothing without this fallback.
    it('falls back to appSettings.hostname when Geins carries no defaultHostName', () => {
      const raw = rawApiResponse();
      delete (raw.geinsSettings as Record<string, unknown>).defaultHostName;
      (raw.appSettings as Record<string, unknown>).hostname =
        'only.example.com';
      const result = adaptMerchantApiResponse(raw);
      expect(result.hostname).toBe('only.example.com');
    });

    // The clause this ticket exists for: a hostname a tenant claims only in
    // appSettings must not become a routing entry, so it never resolves.
    it('writes no routing entry for a hostname claimed only in appSettings', async () => {
      const raw = rawApiResponse();
      (raw.appSettings as Record<string, unknown>).aliases = [
        'claimed.example.com',
      ];
      const adapted = adaptMerchantApiResponse(raw);

      const data = new Map<string, unknown>();
      const storage = {
        getItem: <T = unknown>(k: string) =>
          Promise.resolve((data.get(k) ?? null) as T | null),
        setItem: (k: string, v: unknown) => {
          data.set(k, v);
          return Promise.resolve();
        },
      };

      await writeHostnameMappings(
        storage as unknown as ReturnType<
          typeof import('nitropack/runtime').useStorage
        >,
        {
          tenantId: 'beta',
          hostname: adapted.hostname,
          aliases: adapted.aliases,
        } as unknown as TenantConfig,
      );

      expect(data.get(tenantIdKey('beta.sales-portal.geins.dev'))).toBe('beta');
      expect(data.get(tenantIdKey('beta.example'))).toBe('beta');
      expect(data.has(tenantIdKey('claimed.example.com'))).toBe(false);
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
        tenantId: 'alpha',
        isActive: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
        geinsSettings: {
          defaultHostName: 'alpha.example',
          additionalHostNames: [],
          apiKey: 'k',
          accountName: 'alpha',
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

      const result = await resolvePreviewTenant('alpha.example');
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

      const pending = resolvePreviewTenant('alpha.example');

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

      const result = await resolvePreviewTenant('alpha.example');
      expect(result).not.toBeNull();
      expect(result?.branding.name).toBe('Live Brand');
      const previewWarnCalls = mockLoggerWarn.mock.calls.filter(
        ([msg]) =>
          typeof msg === 'string' &&
          msg.includes('STORE_SETTINGS_PREVIEW_FETCH_FAILED'),
      );
      expect(previewWarnCalls).toHaveLength(1);
      expect(previewWarnCalls[0]![0]).toContain('alpha.example');
    });

    it('returns null when both fetches reject', async () => {
      const fetchSpy = vi.fn(async () => {
        throw new Error('network down');
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const result = await resolvePreviewTenant('alpha.example');
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

      const result = await resolvePreviewTenant('alpha.example');
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
