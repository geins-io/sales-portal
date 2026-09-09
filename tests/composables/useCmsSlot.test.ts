import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { CMS_SLOTS } from '#shared/types/cms-slots';

import { useCmsSlot } from '../../app/composables/useCmsSlot';

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

describe('useCmsSlot', () => {
  beforeEach(() => {
    mockTenantData.value = null;
  });

  it('returns null when tenant config has not loaded yet', () => {
    mockTenantData.value = null;
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();
  });

  it('returns null when tenant has no cms config at all', () => {
    mockTenantData.value = makeTenant();
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();
  });

  it('returns null when tenant has cms but no slots map', () => {
    mockTenantData.value = makeTenant({});
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();
  });

  it('returns null when the requested slot key is not in the slots map', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.FRONTPAGE_CONTENT]: {
          family: 'Frontpage',
          areaName: 'Content',
        },
      },
    });
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();
  });

  it('returns the slot config when fully configured', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PORTAL_HERO]: {
          family: 'Portal (Customer logged in)',
          areaName: 'Above Content',
        },
      },
    });
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toEqual({
      family: 'Portal (Customer logged in)',
      areaName: 'Above Content',
    });
  });

  it('returns null when family is empty (partial config)', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PORTAL_HERO]: { family: '', areaName: 'Above Content' },
      },
    });
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();
  });

  it('returns null when areaName is empty (partial config)', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PORTAL_HERO]: { family: 'Portal', areaName: '' },
      },
    });
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();
  });

  it('reactively updates when tenant config changes', () => {
    mockTenantData.value = null;
    const slot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
    expect(slot.value).toBeNull();

    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PORTAL_HERO]: { family: 'F', areaName: 'A' },
      },
    });
    expect(slot.value).toEqual({ family: 'F', areaName: 'A' });
  });
});

/**
 * One literal `it` per slot key, the reader half of the composition the map
 * needs. Each case configures its own key and one foreign key, so a lookup
 * that ignored the argument would resolve the wrong slot and fail.
 */
describe('useCmsSlot resolves each configured slot key', () => {
  beforeEach(() => {
    mockTenantData.value = null;
  });

  it('resolves the frontpage_content slot key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.FRONTPAGE_CONTENT]: {
          family: 'Frontpage',
          areaName: 'Content',
        },
        [CMS_SLOTS.PORTAL_HERO]: { family: 'Other', areaName: 'Other' },
      },
    });
    expect(useCmsSlot(CMS_SLOTS.FRONTPAGE_CONTENT).value).toEqual({
      family: 'Frontpage',
      areaName: 'Content',
    });
  });

  it('resolves the product_list_top slot key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PRODUCT_LIST_TOP]: { family: 'PLP', areaName: 'Top' },
        [CMS_SLOTS.PORTAL_HERO]: { family: 'Other', areaName: 'Other' },
      },
    });
    expect(useCmsSlot(CMS_SLOTS.PRODUCT_LIST_TOP).value).toEqual({
      family: 'PLP',
      areaName: 'Top',
    });
  });

  it('resolves the product_list_bottom slot key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PRODUCT_LIST_BOTTOM]: { family: 'PLP', areaName: 'Bottom' },
        [CMS_SLOTS.PORTAL_HERO]: { family: 'Other', areaName: 'Other' },
      },
    });
    expect(useCmsSlot(CMS_SLOTS.PRODUCT_LIST_BOTTOM).value).toEqual({
      family: 'PLP',
      areaName: 'Bottom',
    });
  });

  it('resolves the product_detail slot key from the tenant config', () => {
    mockTenantData.value = makeTenant({
      slots: {
        [CMS_SLOTS.PRODUCT_DETAIL]: { family: 'PDP', areaName: 'Detail' },
        [CMS_SLOTS.PORTAL_HERO]: { family: 'Other', areaName: 'Other' },
      },
    });
    expect(useCmsSlot(CMS_SLOTS.PRODUCT_DETAIL).value).toEqual({
      family: 'PDP',
      areaName: 'Detail',
    });
  });
});
