import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import StockBadge from '../../../app/components/shared/StockBadge.vue';

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
});
