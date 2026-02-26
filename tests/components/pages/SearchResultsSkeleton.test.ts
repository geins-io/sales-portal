import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import SearchResultsSkeleton from '../../../app/components/pages/SearchResultsSkeleton.vue';

const stubs = {
  Skeleton: {
    template: '<div data-slot="skeleton" />',
  },
  ProductListSkeleton: {
    template: '<div data-testid="plp-skeleton" />',
    props: ['viewMode', 'count'],
  },
  PagesProductListSkeleton: {
    template: '<div data-testid="plp-skeleton" />',
    props: ['viewMode', 'count'],
  },
};

describe('SearchResultsSkeleton', () => {
  it('renders search header skeleton', () => {
    const wrapper = shallowMountComponent(SearchResultsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="search-skeleton"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="search-skeleton-header"]').exists(),
    ).toBe(true);
  });

  it('renders ProductListSkeleton for results grid', () => {
    const wrapper = shallowMountComponent(SearchResultsSkeleton, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="plp-skeleton"]').exists()).toBe(true);
  });
});
