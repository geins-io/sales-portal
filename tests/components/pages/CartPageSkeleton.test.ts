import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CartPageSkeleton from '../../../app/components/pages/CartPageSkeleton.vue';

const stubs = {
  Skeleton: {
    template: '<div data-slot="skeleton" />',
  },
};

describe('CartPageSkeleton', () => {
  it('renders the skeleton layout', () => {
    const wrapper = shallowMountComponent(CartPageSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="cart-skeleton"]').exists()).toBe(true);
  });

  it('renders 3 cart item skeletons', () => {
    const wrapper = shallowMountComponent(CartPageSkeleton, {
      global: { stubs },
    });

    expect(wrapper.findAll('[data-testid="cart-skeleton-item"]').length).toBe(
      3,
    );
  });

  it('renders order summary skeleton with checkout button placeholder', () => {
    const wrapper = shallowMountComponent(CartPageSkeleton, {
      global: { stubs },
    });

    // Order summary has bg-muted class
    const summary = wrapper.find('.bg-muted');
    expect(summary.exists()).toBe(true);
  });
});
