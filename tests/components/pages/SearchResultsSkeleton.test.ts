import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import SearchResultsSkeleton from '../../../app/components/pages/SearchResultsSkeleton.vue';

const stubs = {
  Skeleton: {
    template: '<div data-slot="skeleton" />',
  },
};

describe('SearchResultsSkeleton', () => {
  it('renders grid variant by default', () => {
    const wrapper = shallowMountComponent(SearchResultsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="search-skeleton"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="search-skeleton-card"]').length).toBe(
      8,
    );
  });

  it('renders list variant when viewMode is list', () => {
    const wrapper = shallowMountComponent(SearchResultsSkeleton, {
      props: { viewMode: 'list' },
      global: { stubs },
    });

    expect(wrapper.findAll('[data-testid="search-skeleton-row"]').length).toBe(
      8,
    );
  });
});
