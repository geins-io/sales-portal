import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import LoadingState from '../../../app/components/shared/LoadingState.vue';

const skeletonStub = {
  template: '<div data-slot="skeleton" />',
};

const stubs = {
  Skeleton: skeletonStub,
  UiSkeleton: skeletonStub,
};

describe('LoadingState', () => {
  it('renders correct number of skeleton cards for card-grid', () => {
    const wrapper = mountComponent(LoadingState, {
      props: { variant: 'card-grid', count: 4 },
      global: { stubs },
    });
    expect(wrapper.findAll('[data-testid="skeleton-card"]')).toHaveLength(4);
  });

  it('defaults to 6 items for card-grid', () => {
    const wrapper = mountComponent(LoadingState, {
      props: { variant: 'card-grid' },
      global: { stubs },
    });
    expect(wrapper.findAll('[data-testid="skeleton-card"]')).toHaveLength(6);
  });

  it('renders card-list variant with horizontal layout', () => {
    const wrapper = mountComponent(LoadingState, {
      props: { variant: 'card-list', count: 3 },
      global: { stubs },
    });
    expect(wrapper.findAll('[data-testid="skeleton-row"]')).toHaveLength(3);
  });

  it('renders detail variant', () => {
    const wrapper = mountComponent(LoadingState, {
      props: { variant: 'detail' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="skeleton-detail"]').exists()).toBe(true);
  });

  it('renders text variant', () => {
    const wrapper = mountComponent(LoadingState, {
      props: { variant: 'text' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="skeleton-text"]').exists()).toBe(true);
  });
});
