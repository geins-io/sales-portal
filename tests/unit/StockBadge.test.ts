// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';

// ---------------------------------------------------------------------------
// Mock dependencies
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
const StockBadge = await import('../../app/components/shared/StockBadge.vue');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const badgeStub = {
  template: '<span class="badge"><slot /></span>',
  props: ['variant'],
};

const stubs = {
  Badge: badgeStub,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StockBadge (unit)', () => {
  beforeEach(() => {
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  describe('stock feature not configured (fail-open)', () => {
    it('shows the badge when stock feature is absent', () => {
      mockHasFeature = () => false;
      const wrapper = mount(StockBadge.default, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });

    it('shows the badge even when canAccess would return false', () => {
      mockHasFeature = () => false;
      mockCanAccess = () => false;
      const wrapper = mount(StockBadge.default, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });
  });

  describe('stock feature enabled', () => {
    it('hides badge when canAccess returns false', () => {
      mockHasFeature = (name) => name === 'stock';
      mockCanAccess = () => false;
      const wrapper = mount(StockBadge.default, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toBe('');
    });

    it('shows badge when canAccess returns true', () => {
      mockHasFeature = (name) => name === 'stock';
      mockCanAccess = (name) => name === 'stock';
      const wrapper = mount(StockBadge.default, {
        props: { stock: makeStock() },
        global: { stubs },
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
      const wrapper = mount(StockBadge.default, {
        props: { stock: makeStock({ totalStock: 100, inStock: 100 }) },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });

    it('renders low-stock state', () => {
      const wrapper = mount(StockBadge.default, {
        props: {
          stock: makeStock({ totalStock: 3, inStock: 3 }),
          threshold: 5,
        },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('product.low_stock');
    });

    it('renders nothing when no stock prop provided', () => {
      const wrapper = mount(StockBadge.default, {
        props: {},
        global: { stubs },
      });
      expect(wrapper.text()).toBe('');
    });
  });
});
