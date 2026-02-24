import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import LayoutHeaderActionButtons from '../../../app/components/layout/header/LayoutHeaderActionButtons.vue';

describe('LayoutHeaderActionButtons', () => {
  it('renders cart button', () => {
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(true);
  });

  it('cart button is a button element (not a link)', () => {
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    const cartButton = wrapper.find('[data-slot="cart-button"]');
    expect(cartButton.element.tagName).toBe('BUTTON');
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
