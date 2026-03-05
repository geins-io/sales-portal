import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import { mountComponent } from '../../utils/component';
import StockBadge from '../../../app/components/shared/StockBadge.vue';

const mockCanAccess = vi.fn(() => true);
const mockHasFeature = vi.fn((_name: string) => false);

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

const tenant = ref({
  tenantId: 'test-tenant',
  hostname: 'test.example.com',
  locale: 'sv-SE',
  theme: {
    colors: {
      primary: 'oklch(0.205 0 0)',
      secondary: 'oklch(0.97 0 0)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
    },
    radius: '0.625rem',
  },
  branding: {
    name: 'Test Store',
    logoUrl: '/logo.svg',
    faviconUrl: '/favicon.ico',
  },
  features: {},
});

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant,
    tenantId: computed(() => tenant.value?.tenantId ?? ''),
    hostname: computed(() => tenant.value?.hostname ?? ''),
    isLoading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    theme: computed(() => tenant.value?.theme),
    branding: computed(() => tenant.value?.branding),
    logoUrl: computed(() => '/logo.svg'),
    logoDarkUrl: computed(() => null),
    logoSymbolUrl: computed(() => null),
    faviconUrl: computed(() => '/favicon.ico'),
    ogImageUrl: computed(() => null),
    brandName: computed(() => 'Test Store'),
    mode: computed(() => 'commerce'),
    watermark: computed(() => 'full'),
    availableLocales: computed(() => ['sv']),
    availableMarkets: computed(() => []),
    market: computed(() => ''),
    imageBaseUrl: computed(() => 'https://monitor.commerce.services'),
    features: computed(() => tenant.value?.features),
    hasFeature: mockHasFeature,
    suspense: () => Promise.resolve(),
  }),
  useTenantTheme: () => ({
    colors: computed(() => tenant.value?.theme?.colors),
    typography: computed(() => undefined),
    radius: computed(() => tenant.value?.theme?.radius),
    getColor: () => '',
    primaryColor: computed(() => 'oklch(0.205 0 0)'),
    secondaryColor: computed(() => 'oklch(0.97 0 0)'),
    backgroundColor: computed(() => 'oklch(1 0 0)'),
    foregroundColor: computed(() => 'oklch(0.145 0 0)'),
  }),
}));

const badgeStub = {
  template: '<span class="badge" :class="$attrs.class"><slot /></span>',
  props: ['variant'],
};

const stubs = {
  Badge: badgeStub,
  UiBadge: badgeStub,
};

function makeStock(overrides: Record<string, number> = {}) {
  return {
    inStock: 100,
    oversellable: 0,
    totalStock: 100,
    static: 0,
    ...overrides,
  };
}

describe('StockBadge', () => {
  it('renders in-stock state', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('In stock');
  });

  it('renders low-stock state when totalStock <= threshold', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 3, inStock: 3 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Low stock');
  });

  it('renders out-of-stock state', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Out of stock');
  });

  it('renders on-demand state when static > 0 and inStock === 0', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0, static: 10 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('On demand');
  });

  it('respects custom threshold', () => {
    const wrapper = mountComponent(StockBadge, {
      props: {
        stock: makeStock({ totalStock: 8, inStock: 8 }),
        threshold: 10,
      },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Low stock');
  });

  it('renders nothing when stock is undefined', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: undefined },
      global: { stubs },
    });
    expect(wrapper.text()).toBe('');
  });

  describe('feature flags', () => {
    it('shows stock when stock feature is not configured', () => {
      mockHasFeature.mockReturnValue(false);
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('In stock');
    });

    it('hides stock when stock feature denies access', () => {
      mockHasFeature.mockReturnValue(true);
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toBe('');
    });

    it('shows stock when stock feature allows access', () => {
      mockHasFeature.mockReturnValue(true);
      mockCanAccess.mockReturnValue(true);
      const wrapper = mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('In stock');
    });
  });
});
