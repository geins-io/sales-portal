import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import { mountComponent } from '../../utils/component';
import PriceDisplay from '../../../app/components/shared/PriceDisplay.vue';

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

function makePrice(overrides: Record<string, unknown> = {}) {
  return {
    sellingPriceIncVat: 199,
    sellingPriceExVat: 159.2,
    regularPriceIncVat: 299,
    regularPriceExVat: 239.2,
    sellingPriceIncVatFormatted: '199,00 kr',
    sellingPriceExVatFormatted: '159,20 kr',
    regularPriceIncVatFormatted: '299,00 kr',
    regularPriceExVatFormatted: '239,20 kr',
    discountPercentage: 33,
    isDiscounted: true,
    currency: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    ...overrides,
  };
}

describe('PriceDisplay', () => {
  it('renders selling price inc VAT by default', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice() },
    });
    expect(wrapper.text()).toContain('199,00 kr');
  });

  it('renders selling price ex VAT when showVat is false', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice(), showVat: false },
    });
    expect(wrapper.text()).toContain('159,20 kr');
  });

  it('shows crossed-out regular price when discounted', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice() },
    });
    const lineThrough = wrapper.find('.line-through');
    expect(lineThrough.exists()).toBe(true);
    expect(lineThrough.text()).toContain('299,00 kr');
  });

  it('does not show regular price when not discounted', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice({ isDiscounted: false }) },
    });
    expect(wrapper.find('.line-through').exists()).toBe(false);
  });

  it('hides discount when showDiscount is false', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice(), showDiscount: false },
    });
    expect(wrapper.find('.line-through').exists()).toBe(false);
  });

  it('shows discount percentage badge when discounted', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice() },
    });
    expect(wrapper.text()).toContain('-33%');
  });

  it('shows "From" prefix when fromPrice is true', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: makePrice(), fromPrice: true },
    });
    expect(wrapper.text()).toContain('From');
  });

  it('falls back to Intl.NumberFormat when formatted strings are missing', () => {
    const price = makePrice({
      sellingPriceIncVatFormatted: undefined,
      sellingPriceExVatFormatted: undefined,
      regularPriceIncVatFormatted: undefined,
      regularPriceExVatFormatted: undefined,
    });
    const wrapper = mountComponent(PriceDisplay, {
      props: { price },
    });
    expect(wrapper.text()).toMatch(/\d/);
  });

  it('renders nothing when price is undefined', () => {
    const wrapper = mountComponent(PriceDisplay, {
      props: { price: undefined },
    });
    expect(wrapper.text()).toBe('');
  });

  describe('lowest price (EU compliance)', () => {
    function makeLowestPrice(overrides: Record<string, unknown> = {}) {
      return {
        lowestPriceIncVat: 149,
        lowestPriceIncVatFormatted: '149,00 kr',
        lowestPriceExVat: 119.2,
        lowestPriceExVatFormatted: '119,20 kr',
        comparisonPriceIncVat: 299,
        comparisonPriceIncVatFormatted: '299,00 kr',
        comparisonPriceExVat: 239.2,
        comparisonPriceExVatFormatted: '239,20 kr',
        isDiscounted: true,
        discountPercentage: 50,
        ...overrides,
      };
    }

    it('shows lowest price when lowestPrice is provided and discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice(), lowestPrice: makeLowestPrice() },
      });
      const lowestEl = wrapper.find('[data-testid="lowest-price"]');
      expect(lowestEl.exists()).toBe(true);
      expect(lowestEl.text()).toContain('product.lowest_price_30d');
    });

    it('hides lowest price when lowestPrice is not discounted', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: {
          price: makePrice(),
          lowestPrice: makeLowestPrice({ isDiscounted: false }),
        },
      });
      expect(wrapper.find('[data-testid="lowest-price"]').exists()).toBe(false);
    });

    it('hides lowest price when lowestPrice is not provided', () => {
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.find('[data-testid="lowest-price"]').exists()).toBe(false);
    });
  });

  describe('feature flags', () => {
    it('shows price when pricing feature is not configured', () => {
      mockHasFeature.mockReturnValue(false);
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('199,00 kr');
    });

    it('shows price when pricing feature allows access', () => {
      mockHasFeature.mockReturnValue(true);
      mockCanAccess.mockReturnValue(true);
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('199,00 kr');
    });

    it('shows login message when pricing feature denies access', () => {
      mockHasFeature.mockReturnValue(true);
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(PriceDisplay, {
        props: { price: makePrice() },
      });
      expect(wrapper.text()).toContain('product.login_for_prices');
      expect(wrapper.text()).not.toContain('199,00 kr');
    });
  });
});
