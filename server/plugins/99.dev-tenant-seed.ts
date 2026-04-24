import type { StoreSettings } from '../schemas/store-settings';
import type { TenantConfig } from '#shared/types/tenant-config';
import {
  buildTenantConfig,
  tenantConfigKey,
  tenantIdKey,
} from '../utils/tenant';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { CMS_MENUS } from '#shared/constants/cms';

/**
 * Dev-only plugin — seeds fixture tenants into KV storage at startup
 * so local multi-tenant walkthrough is possible without relying on the
 * merchant API returning configs for test hostnames.
 *
 * Three fixtures:
 *   - tenant-a.localhost     → teal theme, full CMS slots + menus
 *   - tenant-b.localhost     → rose theme, full CMS slots + menus
 *   - tenant-blank.localhost → minimal config, NO cms — exercises fallbacks
 *
 * NO-OP in production.
 *
 * Usage:
 *   curl -H "Host: tenant-a.localhost" http://localhost:3000/se/sv/
 *   curl -H "Host: tenant-blank.localhost" http://localhost:3000/se/sv/
 *
 * Or add to /etc/hosts for browser testing:
 *   127.0.0.1 tenant-a.localhost tenant-b.localhost tenant-blank.localhost
 */
export default defineNitroPlugin(async () => {
  if (!import.meta.dev) return;

  // Run the seed synchronously at plugin init. `useStorage('kv')` is
  // available immediately in Nitro plugins — no need to wait for a
  // startup hook.
  const storage = useStorage('kv');

  const fixtures: Array<{
    settings: StoreSettings;
    withFullCms: boolean;
  }> = [
    {
      settings: makeFixture({
        tenantId: 'tenant-a',
        hostnames: ['tenant-a.localhost', 'tenant-a.litium.store'],
        brandName: 'Tenant A Store',
        primary: 'oklch(0.55 0.13 195.71)', // teal
      }),
      withFullCms: true,
    },
    {
      settings: makeFixture({
        tenantId: 'tenant-b',
        hostnames: ['tenant-b.localhost', 'tenant-b.litium.store'],
        brandName: 'Tenant B Store',
        primary: 'oklch(0.58 0.17 15.0)', // rose
      }),
      withFullCms: true,
    },
    {
      settings: makeFixture({
        tenantId: 'tenant-blank',
        hostnames: ['tenant-blank.localhost'],
        brandName: 'Tenant Blank',
        primary: 'oklch(0.205 0 0)',
      }),
      withFullCms: false,
    },
  ];

  for (const { settings, withFullCms } of fixtures) {
    const built = buildTenantConfig(settings);
    const config: TenantConfig = withFullCms
      ? { ...built, cms: FULL_CMS_CONFIG }
      : built;
    await storage.setItem(tenantConfigKey(config.tenantId), config);
    const hosts = [config.hostname, ...(config.aliases ?? [])].filter(Boolean);
    for (const host of hosts) {
      await storage.setItem(tenantIdKey(host), config.tenantId);
    }
  }

  console.info(
    `[dev-tenant-seed] Seeded ${fixtures.length} fixture tenants: ${fixtures
      .map((f) => f.settings.tenantId)
      .join(', ')}`,
  );
});

const FULL_CMS_CONFIG: NonNullable<TenantConfig['cms']> = {
  slots: {
    [CMS_SLOTS.PORTAL_HERO]: {
      family: 'Portal (Customer logged in)',
      areaName: 'Above Content',
    },
    [CMS_SLOTS.FRONTPAGE_CONTENT]: {
      family: 'Frontpage',
      areaName: 'Content',
    },
  },
  menus: {
    [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'main' },
    [CMS_MENUS.FOOTER]: { menuLocationId: 'footer' },
    [CMS_MENUS.MOBILE_DRAWER]: { menuLocationId: 'main' },
    [CMS_MENUS.SIDEBAR_FALLBACK]: { menuLocationId: 'info-pages' },
  },
};

interface FixtureInput {
  tenantId: string;
  hostnames: string[];
  brandName: string;
  primary: string;
}

function makeFixture(input: FixtureInput): StoreSettings {
  const [hostname, ...aliases] = input.hostnames;
  return {
    tenantId: input.tenantId,
    hostname: hostname!,
    aliases,
    geinsSettings: {
      apiKey: process.env.GEINS_API_KEY || 'dev',
      accountName: process.env.GEINS_ACCOUNT_NAME || 'dev',
      channel: '1',
      tld: 'se',
      locale: 'sv-SE',
      market: 'se',
      environment: 'production',
      availableLocales: ['sv-SE', 'en-GB'],
      availableMarkets: ['se'],
    },
    mode: 'commerce',
    checkoutMode: 'hosted',
    theme: {
      name: input.tenantId,
      displayName: input.brandName,
      colors: {
        primary: input.primary,
        primaryForeground: 'oklch(0.985 0 0)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.205 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.145 0 0)',
      },
      radius: '0.625rem',
    },
    branding: {
      name: input.brandName,
      watermark: 'minimal',
    },
    features: {
      search: { enabled: true },
      authentication: { enabled: true },
      registration: { enabled: true },
      cart: { enabled: true },
      wishlist: { enabled: true },
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };
}
