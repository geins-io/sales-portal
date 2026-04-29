import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import ProductDetailsSkeleton from '../../../app/components/pages/ProductDetailsSkeleton.vue';

const stubs = {
  Skeleton: {
    template: '<div data-slot="skeleton" />',
  },
};

describe('ProductDetailsSkeleton', () => {
  it('renders the skeleton layout', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton"]').exists()).toBe(true);
  });

  it('renders gallery skeleton', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton-gallery"]').exists()).toBe(
      true,
    );
  });

  it('renders info column skeleton', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton-info"]').exists()).toBe(
      true,
    );
  });

  it('renders tabs skeleton with 4 tabs', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    const tabs = wrapper.find('[data-testid="pdp-skeleton-tabs"]');
    expect(tabs.exists()).toBe(true);
    // 4 tab placeholders in the tab bar (first child div)
    const tabBar = tabs.element.children[0];
    expect(tabBar.children.length).toBe(4);
  });

  it('renders related products skeleton', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton-related"]').exists()).toBe(
      true,
    );
  });
});
