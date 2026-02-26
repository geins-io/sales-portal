import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import ProductListSkeleton from '../../../app/components/pages/ProductListSkeleton.vue';

const stubs = {
  Skeleton: {
    template: '<div data-slot="skeleton" />',
  },
};

describe('ProductListSkeleton', () => {
  it('renders grid variant by default', () => {
    const wrapper = shallowMountComponent(ProductListSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="plp-skeleton"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="plp-skeleton-toolbar"]').exists()).toBe(
      true,
    );
    expect(wrapper.findAll('[data-testid="plp-skeleton-card"]').length).toBe(8);
  });

  it('renders list variant when viewMode is list', () => {
    const wrapper = shallowMountComponent(ProductListSkeleton, {
      props: { viewMode: 'list' },
      global: { stubs },
    });

    expect(wrapper.findAll('[data-testid="plp-skeleton-row"]').length).toBe(8);
  });

  it('renders header skeleton with breadcrumb and title', () => {
    const wrapper = shallowMountComponent(ProductListSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="plp-skeleton-header"]').exists()).toBe(
      true,
    );
  });

  it('renders toolbar skeleton with two rows', () => {
    const wrapper = shallowMountComponent(ProductListSkeleton, {
      global: { stubs },
    });

    const toolbar = wrapper.find('[data-testid="plp-skeleton-toolbar"]');
    expect(toolbar.exists()).toBe(true);
    // Two rows in the toolbar (space-y-2 container)
    expect(toolbar.element.children.length).toBe(2);
  });

  it('renders pagination skeleton', () => {
    const wrapper = shallowMountComponent(ProductListSkeleton, {
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="plp-skeleton-pagination"]').exists(),
    ).toBe(true);
  });

  it('renders custom count', () => {
    const wrapper = shallowMountComponent(ProductListSkeleton, {
      props: { count: 4 },
      global: { stubs },
    });

    expect(wrapper.findAll('[data-testid="plp-skeleton-card"]').length).toBe(4);
  });
});
