import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import LayoutHeaderActionButtons from '../../../app/components/layout/header/LayoutHeaderActionButtons.vue';

describe('LayoutHeaderActionButtons', () => {
  it('renders cart link with count', () => {
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('0');
  });

  it('renders search icon button on mobile', () => {
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="search-button"]').exists()).toBe(true);
  });

  it('renders hamburger button on mobile', () => {
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="menu-toggle"]').exists()).toBe(true);
  });
});
