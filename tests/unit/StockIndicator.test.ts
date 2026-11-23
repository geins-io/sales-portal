// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
let mockIsFeatureConfigured = (_name: string): boolean => false;
let mockHasFeature = (_name: string): boolean => false;
let mockCanAccess = (_name: string): boolean => false;

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref(null),
    isFeatureConfigured: (name: string) => mockIsFeatureConfigured(name),
    hasFeature: (name: string) => mockHasFeature(name),
    features: computed(() => ({})),
    branding: computed(() => null),
    theme: computed(() => null),
    mode: computed(() => 'commerce'),
    availableLocales: computed(() => []),
    availableMarkets: computed(() => []),
    market: computed(() => ''),
  }),
}));

vi.mock('../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: (name: string) => mockCanAccess(name),
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
const StockIndicator =
  await import('../../app/components/shared/StockIndicator.vue');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeStock(overrides: Record<string, number> = {}) {
  return {
    inStock: 100,
    oversellable: 0,
    totalStock: 100,
    static: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StockIndicator (unit)', () => {
  beforeEach(() => {
    mockIsFeatureConfigured = () => false;
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  describe('stock feature not configured (fail-open)', () => {
    it('shows the indicator when stock feature is absent', () => {
      mockIsFeatureConfigured = () => false;
      mockHasFeature = () => false;
      const wrapper = mount(StockIndicator.default, {
        props: { stock: makeStock() },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });

    it('shows the indicator even when canAccess would return false', () => {
      mockHasFeature = () => false;
      mockCanAccess = () => false;
      const wrapper = mount(StockIndicator.default, {
        props: { stock: makeStock() },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });
  });

  describe('stock feature enabled', () => {
    it('hides the indicator when canAccess returns false', () => {
      mockIsFeatureConfigured = (name) => name === 'stockStatus';
      mockHasFeature = (name) => name === 'stockStatus';
      mockCanAccess = () => false;
      const wrapper = mount(StockIndicator.default, {
        props: { stock: makeStock() },
      });
      expect(wrapper.text()).toBe('');
    });

    it('shows the indicator when canAccess returns true for stockStatus', () => {
      mockIsFeatureConfigured = (name) => name === 'stockStatus';
      mockHasFeature = (name) => name === 'stockStatus';
      mockCanAccess = (name) => name === 'stockStatus';
      const wrapper = mount(StockIndicator.default, {
        props: { stock: makeStock() },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });
  });

  describe('stock status rendering', () => {
    beforeEach(() => {
      // Ensure showStock=true for these tests
      mockHasFeature = () => false;
    });

    it('renders in-stock state', () => {
      const wrapper = mount(StockIndicator.default, {
        props: { stock: makeStock({ totalStock: 100, inStock: 100 }) },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });

    it('renders low-stock state', () => {
      const wrapper = mount(StockIndicator.default, {
        props: {
          stock: makeStock({ totalStock: 3, inStock: 3 }),
          threshold: 5,
        },
      });
      expect(wrapper.text()).toContain('product.low_stock');
    });

    it('renders nothing when no stock prop provided', () => {
      const wrapper = mount(StockIndicator.default, {
        props: {},
      });
      expect(wrapper.text()).toBe('');
    });
  });
});
