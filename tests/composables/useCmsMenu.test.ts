import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { CMS_MENUS } from '#shared/constants/cms';

import { useCmsMenu } from '../../app/composables/useCmsMenu';

const mockTenantData = ref<PublicTenantConfig | null>(null);

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({ tenant: mockTenantData }),
}));

vi.stubGlobal('computed', (await import('vue')).computed);

function makeTenant(cms?: PublicTenantConfig['cms']): PublicTenantConfig {
  return {
    tenantId: 'monitor',
    hostname: 'localhost',
    mode: 'commerce',
    checkoutMode: 'hosted',
    theme: { name: 'monitor', colors: {} },
    branding: { name: 'monitor', watermark: 'full' },
    features: {},
    cms,
    css: '',
    isActive: true,
    availableLocales: ['sv'],
    availableMarkets: ['se'],
    imageBaseUrl: '',
  };
}

describe('useCmsMenu', () => {
  beforeEach(() => {
    mockTenantData.value = null;
  });

  it('returns null when tenant config has not loaded yet', () => {
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toBeNull();
  });

  it('returns null when tenant has no cms config', () => {
    mockTenantData.value = makeTenant();
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toBeNull();
  });

  it('returns null when tenant has cms but no menus map', () => {
    mockTenantData.value = makeTenant({});
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toBeNull();
  });

  it('returns null when the requested menu key is not in the menus map', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.FOOTER]: { menuLocationId: 'footer' },
      },
    });
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toBeNull();
  });

  it('returns the menu config when present', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'main' },
      },
    });
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toEqual({ menuLocationId: 'main' });
  });

  it('returns null when menuLocationId is empty string (partial config)', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: '' },
      },
    });
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toBeNull();
  });

  it('reactively updates when tenant config changes', () => {
    const menu = useCmsMenu(CMS_MENUS.HEADER_MAIN);
    expect(menu.value).toBeNull();

    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'primary' },
      },
    });
    expect(menu.value).toEqual({ menuLocationId: 'primary' });
  });
});

/**
 * One literal `it` per menu key. `useCmsMenu` is key-agnostic — it is a lookup
 * in `tenant.cms.menus` — but the coverage map needs a reader reference bound
 * to each key, because a consumer test that stubs the menu data proves only
 * decision → behaviour. These are the other half of that composition.
 *
 * Each case configures its own key and one foreign key, so a lookup that
 * ignored the argument would return the wrong config and fail.
 */
describe('useCmsMenu resolves each configured menu key', () => {
  beforeEach(() => {
    mockTenantData.value = null;
  });

  it('resolves the footer menu key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.FOOTER]: { menuLocationId: 'footer-loc' },
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'other' },
      },
    });
    expect(useCmsMenu(CMS_MENUS.FOOTER).value).toEqual({
      menuLocationId: 'footer-loc',
    });
  });

  it('resolves the footer_2 menu key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.FOOTER_2]: { menuLocationId: 'footer-2-loc' },
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'other' },
      },
    });
    expect(useCmsMenu(CMS_MENUS.FOOTER_2).value).toEqual({
      menuLocationId: 'footer-2-loc',
    });
  });

  it('resolves the footer_3 menu key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.FOOTER_3]: { menuLocationId: 'footer-3-loc' },
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'other' },
      },
    });
    expect(useCmsMenu(CMS_MENUS.FOOTER_3).value).toEqual({
      menuLocationId: 'footer-3-loc',
    });
  });

  it('resolves the mobile_drawer menu key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.MOBILE_DRAWER]: { menuLocationId: 'drawer-loc' },
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'other' },
      },
    });
    expect(useCmsMenu(CMS_MENUS.MOBILE_DRAWER).value).toEqual({
      menuLocationId: 'drawer-loc',
    });
  });

  it('resolves the sidebar_fallback menu key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      menus: {
        [CMS_MENUS.SIDEBAR_FALLBACK]: { menuLocationId: 'sidebar-loc' },
        [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'other' },
      },
    });
    expect(useCmsMenu(CMS_MENUS.SIDEBAR_FALLBACK).value).toEqual({
      menuLocationId: 'sidebar-loc',
    });
  });
});
