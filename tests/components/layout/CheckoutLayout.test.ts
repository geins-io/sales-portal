import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CheckoutLayout from '../../../app/layouts/checkout.vue';

describe('checkout layout', () => {
  it('shows the text VAT switcher right after "Back to store"', () => {
    const wrapper = shallowMountComponent(CheckoutLayout);
    const switcher = wrapper.findComponent({ name: 'VatDisplaySwitcher' });

    expect(switcher.exists()).toBe(true);
    expect(switcher.props('variant')).toBe('text');

    const backLink = wrapper.find('[data-testid="checkout-back-link"]');
    expect(backLink.element.nextElementSibling).toBe(switcher.element);
    expect(wrapper.find('header').element.contains(switcher.element)).toBe(
      true,
    );
  });

  it('shows the back link as the arrow alone below sm, named by its aria-label', () => {
    const backLink = shallowMountComponent(CheckoutLayout).find(
      '[data-testid="checkout-back-link"]',
    );

    expect(backLink.attributes('aria-label')).toBe('checkout.back_to_store');
    const label = backLink.find('span');
    expect(label.text()).toBe('checkout.back_to_store');
    expect(label.classes()).toEqual(['hidden', 'sm:inline']);
  });

  it('centres the title between two equal columns and shows no buyer name', () => {
    const wrapper = shallowMountComponent(CheckoutLayout);
    const row = wrapper.find('header > div');
    const title = wrapper.find('[data-testid="checkout-header-title"]');

    expect(row.classes()).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-[1fr_auto_1fr]']),
    );
    expect(title.element.parentElement).toBe(row.element);
    expect(title.element.previousElementSibling).toBe(
      row.element.firstElementChild,
    );
    expect(wrapper.find('[data-testid="checkout-user-name"]').exists()).toBe(
      false,
    );
  });
});
