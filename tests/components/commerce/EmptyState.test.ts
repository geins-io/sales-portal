import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import EmptyState from '../../../app/components/shared/EmptyState.vue';

describe('EmptyState', () => {
  it('renders title', () => {
    const wrapper = mountComponent(EmptyState, {
      props: { title: 'No results found' },
    });
    expect(wrapper.text()).toContain('No results found');
  });

  it('renders description when provided', () => {
    const wrapper = mountComponent(EmptyState, {
      props: { title: 'Empty', description: 'Try a different search' },
    });
    expect(wrapper.text()).toContain('Try a different search');
  });

  it('does not render description when not provided', () => {
    const wrapper = mountComponent(EmptyState, {
      props: { title: 'Empty' },
    });
    expect(wrapper.find('p').exists()).toBe(false);
  });

  it('renders action link when actionLabel and actionTo are provided', () => {
    const wrapper = mountComponent(EmptyState, {
      props: {
        title: 'Cart is empty',
        actionLabel: 'Browse products',
        actionTo: '/products',
      },
    });
    const link = wrapper.find('a');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain('Browse products');
    expect(link.attributes('href')).toBe('/products');
  });

  it('does not render action when actionLabel is missing', () => {
    const wrapper = mountComponent(EmptyState, {
      props: { title: 'Empty', actionTo: '/products' },
    });
    expect(wrapper.find('a').exists()).toBe(false);
  });
});
