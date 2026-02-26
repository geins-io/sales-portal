import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import ContentPageSkeleton from '../../../app/components/pages/ContentPageSkeleton.vue';

const stubs = {
  Skeleton: {
    template: '<div data-slot="skeleton" />',
  },
};

describe('ContentPageSkeleton', () => {
  it('renders full-width variant by default', () => {
    const wrapper = shallowMountComponent(ContentPageSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="content-skeleton"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="content-skeleton-sidebar"]').exists(),
    ).toBe(false);
  });

  it('renders sidebar variant when sidebar prop is true', () => {
    const wrapper = shallowMountComponent(ContentPageSkeleton, {
      props: { sidebar: true },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="content-skeleton-sidebar"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="content-skeleton-body"]').exists()).toBe(
      true,
    );
  });

  it('renders content body with heading and paragraph skeletons', () => {
    const wrapper = shallowMountComponent(ContentPageSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="content-skeleton-body"]').exists()).toBe(
      true,
    );
  });
});
