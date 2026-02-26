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

  it('renders gallery skeleton with main image and thumbnails', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton-gallery"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.findAll('[data-testid="pdp-skeleton-thumbnail"]').length,
    ).toBe(4);
  });

  it('renders info column skeleton', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton-info"]').exists()).toBe(
      true,
    );
  });

  it('renders tabs skeleton', () => {
    const wrapper = shallowMountComponent(ProductDetailsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="pdp-skeleton-tabs"]').exists()).toBe(
      true,
    );
  });
});
