// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed, readonly } from 'vue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const showPriceRef = ref(true);
const canUnlockByAuthRef = ref(true);

vi.mock('../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({
    showPrice: readonly(showPriceRef),
    canUnlockByAuth: readonly(canUnlockByAuthRef),
  }),
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref(null),
    hasFeature: (_name: string) => false,
    features: computed(() => ({})),
    branding: computed(() => null),
    theme: computed(() => null),
    isCatalogMode: computed(() => false),
    availableLocales: computed(() => []),
    availableMarkets: computed(() => []),
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
    showPriceRef.value = true;
    canUnlockByAuthRef.value = true;
  });

  describe('price visibility', () => {
    it('shows login message when price is hidden and auth can unlock it', () => {
      showPriceRef.value = false;
      canUnlockByAuthRef.value = true;
      const wrapper = mount(PriceDisplay.default, {
        props: { price: makePrice() },
        ...globalMounts,
      });
      expect(wrapper.text()).toContain('product.login_for_prices');
      expect(wrapper.text()).not.toContain('100 kr');
    });

    it('shows nothing when price is hidden and auth will not unlock it', () => {
      showPriceRef.value = false;
      canUnlockByAuthRef.value = false;
      const wrapper = mount(PriceDisplay.default, {
        props: { price: makePrice() },
        ...globalMounts,
      });
      expect(wrapper.text()).not.toContain('product.login_for_prices');
      expect(wrapper.text()).not.toContain('100 kr');
    });

    it('shows price when showPrice is true', () => {
      showPriceRef.value = true;
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
      showPriceRef.value = true;
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
