import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import StockBadge from '../../../app/components/shared/StockBadge.vue';
import { useTenant } from '../../../app/composables/useTenant';

// useTenant mock is provided by setup-components.ts — access tenant ref to control features
const { tenant } = useTenant();

const mockCanAccess = vi.fn(() => true);

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
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
  beforeEach(() => {
    tenant.value.features = {};
    mockCanAccess.mockReturnValue(true);
  });

  it('renders in-stock state', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.in_stock');
  });

  it('renders low-stock state when totalStock <= threshold', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 3, inStock: 3 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.low_stock');
  });

  it('renders out-of-stock state', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.out_of_stock');
  });

  it('renders on-demand state when static > 0 and inStock === 0', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0, static: 10 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.on_demand');
  });

  it('respects custom threshold', () => {
    const wrapper = mountComponent(StockBadge, {
      props: {
        stock: makeStock({ totalStock: 8, inStock: 8 }),
        threshold: 10,
      },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.low_stock');
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
      tenant.value.features = {};
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });

    it('hides stock when stock feature denies access', () => {
      tenant.value.features = { stock: { enabled: true } };
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toBe('');
    });

    it('shows stock when stock feature allows access', () => {
      tenant.value.features = { stock: { enabled: true } };
      mockCanAccess.mockReturnValue(true);
      const wrapper = mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
      expect(wrapper.text()).toContain('product.in_stock');
    });
  });
});
