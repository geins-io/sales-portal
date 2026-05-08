// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockHasFeature = (_name: string): boolean => false;
let mockCanAccess = (_name: string): boolean => false;

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref(null),
    hasFeature: (name: string) => mockHasFeature(name),
    features: computed(() => ({})),
    branding: computed(() => null),
    theme: computed(() => null),
    isCatalogMode: computed(() => false),
    availableLocales: computed(() => []),
    availableMarkets: computed(() => []),
  }),
}));

vi.mock('../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: (name: string) => mockCanAccess(name),
  }),
}));

vi.mock('../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({
    showPrice: computed(() => {
      if (!mockHasFeature('pricing')) return true;
      return mockCanAccess('pricing');
    }),
  }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
  locale: ref('en'),
}));

vi.stubGlobal('computed', computed);

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------
const PriceDisplay =
  await import('../../app/components/shared/PriceDisplay.vue');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const globalMounts = {
  global: {
    mocks: {
      $t: (key: string) => key,
    },
  },
};

function makePrice(overrides: Record<string, unknown> = {}) {
  return {
    sellingPriceIncVat: 100,
    sellingPriceExVat: 80,
    regularPriceIncVat: 100,
    regularPriceExVat: 80,
    sellingPriceIncVatFormatted: '100 kr',
    sellingPriceExVatFormatted: '80 kr',
    regularPriceIncVatFormatted: '100 kr',
    regularPriceExVatFormatted: '80 kr',
    isDiscounted: false,
    discountPercentage: 0,
    currency: { code: 'SEK' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PriceDisplay (unit)', () => {
  beforeEach(() => {
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  describe('price visibility', () => {
    it('shows login message when pricing feature is enabled and user cannot access', () => {
      mockHasFeature = (name) => name === 'pricing';
      mockCanAccess = () => false;
      const wrapper = mount(PriceDisplay.default, {
        props: { price: makePrice() },
        ...globalMounts,
      });
      expect(wrapper.text()).toContain('product.login_for_prices');
      expect(wrapper.text()).not.toContain('100 kr');
    });

    it('shows price when pricing feature is not configured (fail-open)', () => {
      mockHasFeature = () => false;
      const wrapper = mount(PriceDisplay.default, {
        props: { price: makePrice() },
        ...globalMounts,
      });
      expect(wrapper.text()).toContain('100 kr');
      expect(wrapper.text()).not.toContain('product.login_for_prices');
    });

    it('shows price when pricing feature is enabled and user has access', () => {
      mockHasFeature = (name) => name === 'pricing';
      mockCanAccess = (name) => name === 'pricing';
      const wrapper = mount(PriceDisplay.default, {
        props: { price: makePrice() },
        ...globalMounts,
      });
      expect(wrapper.text()).toContain('100 kr');
      expect(wrapper.text()).not.toContain('product.login_for_prices');
    });
  });

  describe('price rendering', () => {
    beforeEach(() => {
      mockHasFeature = () => false;
    });

    it('renders nothing when no price prop provided', () => {
      const wrapper = mount(PriceDisplay.default, {
        props: {},
        ...globalMounts,
      });
      expect(wrapper.text()).toBe('');
    });

    it('renders selling price for non-discounted product', () => {
      const wrapper = mount(PriceDisplay.default, {
        props: { price: makePrice() },
        ...globalMounts,
      });
      expect(wrapper.text()).toContain('100 kr');
    });
  });
});
