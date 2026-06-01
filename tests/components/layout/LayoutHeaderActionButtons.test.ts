import { describe, it, expect, afterEach, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import LayoutHeaderActionButtons from '../../../app/components/layout/header/LayoutHeaderActionButtons.vue';
import { mockIsCatalogMode } from '../../setup-components';

// useTenant is mocked globally in setup-components.ts.
// Use mockIsCatalogMode to toggle catalog mode in individual tests.

const mockCanAccess = vi.fn(() => true);
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

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

  it('does not render cart button when catalog mode is active', () => {
    mockIsCatalogMode.value = true;
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(false);
  });

  it('does not render cart button when orderPlacement access is denied', () => {
    mockCanAccess.mockImplementation(
      (name: string) => name !== 'orderPlacement',
    );
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(false);
  });

  it('renders cart button when orderPlacement access is granted', () => {
    mockCanAccess.mockImplementation(
      (name: string) => name === 'orderPlacement',
    );
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    expect(wrapper.find('[data-slot="cart-button"]').exists()).toBe(true);
  });

  afterEach(() => {
    mockIsCatalogMode.value = false;
    mockCanAccess.mockReset();
    mockCanAccess.mockReturnValue(true);
  });
});
