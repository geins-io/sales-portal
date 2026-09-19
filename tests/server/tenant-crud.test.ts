import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createTenant,
  updateTenant,
  deleteTenant,
  mergeCmsConfig,
} from '../../server/utils/tenant-crud';
import {
  tenantConfigKey,
  tenantIdKey,
  defaultGeinsSettings,
} from '../../server/utils/tenant';

// Use the REAL createAppError / ErrorCode so the ownership-check test below
// verifies the actual thrown error shape, not a mock's.
const errorsModule = await import('../../server/utils/errors');
vi.stubGlobal('createAppError', errorsModule.createAppError);
vi.stubGlobal('ErrorCode', errorsModule.ErrorCode);

const {
  mockUseStorage,
  mockClearSdkCache,
  mockUseRuntimeConfig,
  kvStore,
  cacheStore,
} = vi.hoisted(() => {
  function createStatefulStorage(store: Map<string, unknown>) {
    return {
      getItem: vi.fn(async (key: string) =>
        store.has(key) ? store.get(key) : null,
      ),
      setItem: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    };
  }

  const kvStore = new Map<string, unknown>();
  const cacheStore = new Map<string, unknown>();
  const kvStorage = createStatefulStorage(kvStore);
  const cacheStorage = createStatefulStorage(cacheStore);

  return {
    mockUseStorage: vi.fn((namespace: string) =>
      namespace === 'cache' ? cacheStorage : kvStorage,
    ),
    mockClearSdkCache: vi.fn(),
    mockUseRuntimeConfig: vi.fn(() => ({
      geins: { tenantApiUrl: 'https://merchant.example/api/tenant' },
    })),
    kvStore,
    cacheStore,
  };
});

vi.stubGlobal('useStorage', mockUseStorage);
// resolveTenant() falls back to fetchTenantConfig() on a KV miss, which
// calls useRuntimeConfig(event) to read the merchant API URL before it ever
// reaches its own try/catch — needed even for tests that expect the fetch
// itself to fail, not just ones that expect it to succeed. Unlike
// useStorage (a true undefined global in this test tier), useRuntimeConfig
// resolves through a real `nuxt/app` import, so it needs mocking at the
// module level rather than vi.stubGlobal.
vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('nitropack/runtime/internal/config', async (importOriginal) => {
  const actual = (await importOriginal().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ...actual, useRuntimeConfig: mockUseRuntimeConfig };
});
vi.mock('../../server/services/_sdk', () => ({
  clearSdkCache: mockClearSdkCache,
}));
vi.mock('../../server/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const GEINS_SETTINGS = {
  apiKey: 'key-1',
  accountName: 'acct',
  channel: '1',
  tld: 'se',
  locale: 'sv-SE',
  market: 'se',
  environment: 'production' as const,
  availableLocales: ['sv-SE'],
  availableMarkets: ['se'],
};

beforeEach(() => {
  kvStore.clear();
  cacheStore.clear();
  // mockUseStorage.mockClear() only clears calls to useStorage() itself —
  // the getItem/setItem/removeItem spies on the objects it returns are
  // separate vi.fn()s that survive across tests unless cleared too.
  vi.clearAllMocks();
});

describe('createTenant', () => {
  it('creates a fresh tenant with sane defaults when no config is given', async () => {
    const tenant = await createTenant({ hostname: 'a.example.com' });

    expect(tenant.tenantId).toBe('a.example.com');
    expect(tenant.mode).toBe('commerce');
    expect(tenant.checkoutMode).toBe('hosted');
    expect(tenant.branding).toEqual({
      name: 'a.example.com',
      watermark: 'full',
    });
    expect(tenant.geinsSettings).toEqual(defaultGeinsSettings());
    expect(tenant.isActive).toBe(false);
    // Never OS timezone — see docs/adr/024-tenant-operating-timezone.md.
    expect(tenant.timezone).toBe('UTC');
    expect(kvStore.get(tenantConfigKey('a.example.com'))).toEqual(tenant);
  });

  it('backfills timezone on a stored config from before the field existed', async () => {
    // Simulate a KV record written before `timezone` was added to
    // TenantConfig — a raw storage read wouldn't re-run schema defaults.
    const legacy = {
      tenantId: 'legacy-tenant',
      hostname: 'legacy.example.com',
      geinsSettings: defaultGeinsSettings(),
      mode: 'commerce',
      checkoutMode: 'hosted',
      theme: {},
      branding: { name: 'Legacy', watermark: 'full' },
      features: {},
      isActive: true,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    kvStore.set(tenantConfigKey('legacy-tenant'), legacy);

    const tenant = await createTenant({
      hostname: 'legacy.example.com',
      tenantId: 'legacy-tenant',
    });

    expect(tenant.timezone).toBe('UTC');
  });

  it('applies partial config over the defaults on fresh create', async () => {
    const tenant = await createTenant({
      hostname: 'boattools.example.com',
      tenantId: 'boattools',
      config: {
        isActive: true,
        branding: { name: 'Boat Tools', watermark: 'none' },
        geinsSettings: {
          ...GEINS_SETTINGS,
          imageBaseUrl: 'https://cdn.example.com',
        },
        timezone: 'Europe/Stockholm',
      },
    });

    expect(tenant.tenantId).toBe('boattools');
    expect(tenant.isActive).toBe(true);
    expect(tenant.branding).toEqual({ name: 'Boat Tools', watermark: 'none' });
    expect(tenant.geinsSettings.imageBaseUrl).toBe('https://cdn.example.com');
    expect(tenant.timezone).toBe('Europe/Stockholm');
  });

  it('does not leak theme-internal keys (colors, radius, typography) onto the top-level config', async () => {
    // mergeThemes() returns a full theme object shaped { name, displayName,
    // colors, radius, typography } — none of those are TenantConfig's own
    // top-level keys (theme.colors lives under `theme`, not the config
    // root). Spreading that theme object directly into the returned
    // TenantConfig would pollute it with keys that don't belong there.
    const tenant = await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: {
        theme: { name: 'custom', colors: { primary: 'oklch(0.5 0.1 200)' } },
        geinsSettings: GEINS_SETTINGS,
      },
    });

    expect(tenant).not.toHaveProperty('colors');
    expect(tenant).not.toHaveProperty('radius');
    expect(tenant).not.toHaveProperty('typography');
    expect(tenant).not.toHaveProperty('displayName');
    // theme.name is legitimate; a top-level `name` is not.
    expect(tenant).not.toHaveProperty('name');
    expect(tenant.theme.name).toBe('custom');
  });

  it('maps every alias hostname to the tenant, alongside the primary hostname', async () => {
    await createTenant({
      hostname: 'www.boattools.store',
      tenantId: 'boattools',
      config: {
        isActive: true,
        aliases: ['boattools.localhost'],
        geinsSettings: GEINS_SETTINGS,
      },
    });

    expect(kvStore.get(tenantIdKey('www.boattools.store'))).toBe('boattools');
    expect(kvStore.get(tenantIdKey('boattools.localhost'))).toBe('boattools');
  });

  it("rejects a hostname that is not already one of the existing tenant's hostnames", async () => {
    await createTenant({
      hostname: 'www.boattools.store',
      tenantId: 'boattools',
      config: { isActive: true, geinsSettings: GEINS_SETTINGS },
    });

    await expect(
      createTenant({
        hostname: 'attacker-controlled.example',
        tenantId: 'boattools',
        config: { branding: { name: 'Hijacked', watermark: 'none' } },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows a request whose hostname is an existing alias, not just the primary', async () => {
    await createTenant({
      hostname: 'www.boattools.store',
      tenantId: 'boattools',
      config: {
        isActive: true,
        aliases: ['boattools.localhost'],
        geinsSettings: GEINS_SETTINGS,
      },
    });

    const updated = await createTenant({
      hostname: 'boattools.localhost',
      tenantId: 'boattools',
      config: { branding: { name: 'Renamed', watermark: 'none' } },
    });

    expect(updated.branding).toEqual({ name: 'Renamed', watermark: 'none' });
  });

  it('preserves fields the update omits instead of blanking them (regression: undefined-spread clobber)', async () => {
    await createTenant({
      hostname: 'boattools.example.com',
      tenantId: 'boattools',
      config: {
        isActive: true,
        branding: { name: 'Boat Tools', watermark: 'none' },
        mode: 'commerce',
        checkoutMode: 'hosted',
        geinsSettings: GEINS_SETTINGS,
      },
    });

    // Second call omits branding/mode/checkoutMode entirely — as
    // tenants.post.ts does when the caller's request body doesn't include
    // them, producing `{ branding: undefined, mode: undefined, ... }`.
    const updated = await createTenant({
      hostname: 'boattools.example.com',
      tenantId: 'boattools',
      config: {
        isActive: true,
        branding: undefined,
        mode: undefined,
        checkoutMode: undefined,
        geinsSettings: {
          ...GEINS_SETTINGS,
          imageBaseUrl: 'https://cdn.example.com',
        },
      },
    });

    expect(updated.branding).toEqual({ name: 'Boat Tools', watermark: 'none' });
    expect(updated.mode).toBe('commerce');
    expect(updated.checkoutMode).toBe('hosted');
    expect(updated.geinsSettings.imageBaseUrl).toBe('https://cdn.example.com');
  });

  it('is a true no-op when called for an existing tenant with no config', async () => {
    const created = await createTenant({
      hostname: 'a.example.com',
      config: { geinsSettings: GEINS_SETTINGS },
    });
    const kvStorage = mockUseStorage('kv');
    kvStorage.setItem.mockClear();

    const result = await createTenant({ hostname: 'a.example.com' });

    expect(result).toEqual(created);
    expect(kvStorage.setItem).not.toHaveBeenCalled();
  });

  it('invalidates SDK, negative, and response caches on every write', async () => {
    await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: { geinsSettings: GEINS_SETTINGS },
    });

    expect(mockClearSdkCache).toHaveBeenCalledWith('a-tenant');
    const escaped = tenantConfigKey('a-tenant').replace(/\W/g, '');
    expect(cacheStore.has(`nitro/handlers:_:${escaped}.json`)).toBe(false);
    // removeItem was called (deleting a key that was never set is a no-op,
    // so absence from the store *is* the assertion — confirm the call too).
    const cacheStorage = mockUseStorage('cache');
    expect(cacheStorage.removeItem).toHaveBeenCalledWith(
      `nitro/handlers:_:${escaped}.json`,
    );
  });

  it('actually clears a stale cached /api/config response on update', async () => {
    await createTenant({
      hostname: 'boattools.example.com',
      tenantId: 'boattools',
      config: { geinsSettings: GEINS_SETTINGS },
    });

    const escaped = tenantConfigKey('boattools').replace(/\W/g, '');
    const nitroCacheKey = `nitro/handlers:_:${escaped}.json`;
    cacheStore.set(nitroCacheKey, { stale: true });

    await createTenant({
      hostname: 'boattools.example.com',
      tenantId: 'boattools',
      config: {
        geinsSettings: {
          ...GEINS_SETTINGS,
          imageBaseUrl: 'https://cdn.example.com',
        },
      },
    });

    expect(cacheStore.has(nitroCacheKey)).toBe(false);
  });
});

describe('updateTenant', () => {
  it('returns null when the hostname does not resolve to a tenant', async () => {
    const stub = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('no network in test'));

    const result = await updateTenant('unknown.example.com', {
      branding: { name: 'X', watermark: 'full' },
    });

    expect(result).toBeNull();
    stub.mockRestore();
  });

  it('merges updates onto the resolved tenant and invalidates its caches', async () => {
    await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: {
        // isActive: true — resolveTenant()/getTenantById() only resolve
        // active tenants (see the isActive comment in tenants.post.ts).
        isActive: true,
        branding: { name: 'Original', watermark: 'full' },
        geinsSettings: GEINS_SETTINGS,
      },
    });
    mockClearSdkCache.mockClear();

    const updated = await updateTenant('a.example.com', {
      branding: { name: 'Renamed', watermark: 'none' },
    });

    expect(updated?.branding).toEqual({ name: 'Renamed', watermark: 'none' });
    // geinsSettings wasn't part of this update — must survive untouched.
    expect(updated?.geinsSettings).toEqual(GEINS_SETTINGS);
    expect(mockClearSdkCache).toHaveBeenCalledWith('a-tenant');
  });

  it('updating one cms slot through the real update path does not wipe sibling slots or menus', async () => {
    await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: {
        isActive: true,
        geinsSettings: GEINS_SETTINGS,
        cms: {
          slots: {
            frontpage_content: { family: 'Frontpage', areaName: 'Content' },
            product_detail: { family: 'Product', areaName: 'Below Details' },
          },
          menus: { header_main: { menuLocationId: 'main' } },
        },
      },
    });

    const updated = await updateTenant('a.example.com', {
      cms: {
        slots: {
          frontpage_content: {
            family: 'Frontpage',
            areaName: 'The front page area',
          },
        },
      },
    });

    expect(updated?.cms?.slots).toEqual({
      frontpage_content: {
        family: 'Frontpage',
        areaName: 'The front page area',
      },
      product_detail: { family: 'Product', areaName: 'Below Details' },
    });
    // menus wasn't part of this update — must survive untouched, same as
    // geinsSettings does for the plain-field case above.
    expect(updated?.cms?.menus).toEqual({
      header_main: { menuLocationId: 'main' },
    });
  });

  it('setting a cms slot to null through the real update path removes just that key', async () => {
    await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: {
        isActive: true,
        geinsSettings: GEINS_SETTINGS,
        cms: {
          slots: {
            frontpage_content: { family: 'Frontpage', areaName: 'Content' },
            product_detail: { family: 'Product', areaName: 'Below Details' },
          },
        },
      },
    });

    const updated = await updateTenant('a.example.com', {
      cms: { slots: { product_detail: null } },
    });

    expect(updated?.cms?.slots).toEqual({
      frontpage_content: { family: 'Frontpage', areaName: 'Content' },
    });
  });
});

describe('mergeCmsConfig', () => {
  it('returns undefined when neither base nor partial has a cms config', () => {
    expect(mergeCmsConfig(undefined, undefined)).toBeUndefined();
  });

  it('returns base unchanged when partial is undefined', () => {
    const base = {
      slots: { frontpage_content: { family: 'F', areaName: 'A' } },
    };
    expect(mergeCmsConfig(base, undefined)).toBe(base);
  });

  it('creates a slots map from nothing when base is undefined', () => {
    const result = mergeCmsConfig(undefined, {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
    });
    expect(result).toEqual({
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
    });
  });

  it('adds a new key without touching existing keys', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
    };
    const result = mergeCmsConfig(base, {
      slots: {
        product_detail: { family: 'Product', areaName: 'Below Details' },
      },
    });
    expect(result?.slots).toEqual({
      frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      product_detail: { family: 'Product', areaName: 'Below Details' },
    });
  });

  it('overwrites an existing key without touching others', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
        product_detail: { family: 'Product', areaName: 'Below Details' },
      },
    };
    const result = mergeCmsConfig(base, {
      slots: {
        frontpage_content: {
          family: 'Frontpage',
          areaName: 'The front page area',
        },
      },
    });
    expect(result?.slots).toEqual({
      frontpage_content: {
        family: 'Frontpage',
        areaName: 'The front page area',
      },
      product_detail: { family: 'Product', areaName: 'Below Details' },
    });
  });

  it('removes a key when its update value is null, leaving siblings intact', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
        product_detail: { family: 'Product', areaName: 'Below Details' },
      },
    };
    const result = mergeCmsConfig(base, { slots: { product_detail: null } });
    expect(result?.slots).toEqual({
      frontpage_content: { family: 'Frontpage', areaName: 'Content' },
    });
  });

  it('deleting a key that was never present is a no-op, not an error', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
    };
    const result = mergeCmsConfig(base, { slots: { product_detail: null } });
    expect(result?.slots).toEqual({
      frontpage_content: { family: 'Frontpage', areaName: 'Content' },
    });
  });

  it('an empty slots object in partial changes nothing', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
    };
    const result = mergeCmsConfig(base, { slots: {} });
    expect(result?.slots).toEqual(base.slots);
  });

  it('updating slots leaves menus untouched, and vice versa', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
      menus: { header_main: { menuLocationId: 'main' } },
    };
    const slotsUpdated = mergeCmsConfig(base, {
      slots: {
        product_detail: { family: 'Product', areaName: 'Below Details' },
      },
    });
    expect(slotsUpdated?.menus).toEqual(base.menus);

    const menusUpdated = mergeCmsConfig(base, {
      menus: { footer: { menuLocationId: 'footer-1' } },
    });
    expect(menusUpdated?.slots).toEqual(base.slots);
  });

  it('handles add, overwrite, and delete together in one call', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
        product_list_top: { family: 'Productlist', areaName: 'Above List' },
        product_detail: { family: 'Product', areaName: 'Below Details' },
      },
    };
    const result = mergeCmsConfig(base, {
      slots: {
        // overwrite
        frontpage_content: {
          family: 'Frontpage',
          areaName: 'The front page area',
        },
        // delete
        product_list_top: null,
        // add
        product_list_bottom: {
          family: 'Productlist',
          areaName: 'The bottom part of the product list',
        },
      },
    });
    expect(result?.slots).toEqual({
      frontpage_content: {
        family: 'Frontpage',
        areaName: 'The front page area',
      },
      product_detail: { family: 'Product', areaName: 'Below Details' },
      product_list_bottom: {
        family: 'Productlist',
        areaName: 'The bottom part of the product list',
      },
    });
  });

  it('deleting every key leaves an empty slots object, not undefined', () => {
    const base = {
      slots: {
        frontpage_content: { family: 'Frontpage', areaName: 'Content' },
      },
    };
    const result = mergeCmsConfig(base, { slots: { frontpage_content: null } });
    expect(result?.slots).toEqual({});
  });
});

describe('deleteTenant', () => {
  it('removes the tenant config and its hostname mappings', async () => {
    await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: { geinsSettings: GEINS_SETTINGS },
    });

    const ok = await deleteTenant('a.example.com');

    expect(ok).toBe(true);
    expect(kvStore.has(tenantConfigKey('a-tenant'))).toBe(false);
    expect(kvStore.has(tenantIdKey('a.example.com'))).toBe(false);
  });

  it('invalidates caches for the deleted tenant', async () => {
    await createTenant({
      hostname: 'a.example.com',
      tenantId: 'a-tenant',
      config: { geinsSettings: GEINS_SETTINGS },
    });
    mockClearSdkCache.mockClear();

    await deleteTenant('a.example.com');

    expect(mockClearSdkCache).toHaveBeenCalledWith('a-tenant');
  });
});
