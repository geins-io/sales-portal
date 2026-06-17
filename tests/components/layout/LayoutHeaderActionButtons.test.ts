import { describe, it, expect, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountComponent } from '../../utils/component';
import LayoutHeaderActionButtons from '../../../app/components/layout/header/LayoutHeaderActionButtons.vue';
import { mockIsCatalogMode } from '../../setup-components';
import { useAppStore } from '../../../app/stores/app';

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

  it('search button is a button element (not a link), so it toggles rather than navigates', () => {
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    const searchButton = wrapper.find('[data-slot="search-button"]');
    expect(searchButton.element.tagName).toBe('BUTTON');
  });

  it('clicking the search button toggles the mobile search overlay', async () => {
    setActivePinia(createPinia());
    const store = useAppStore();
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    const searchButton = wrapper.find('[data-slot="search-button"]');

    expect(store.mobileSearchOpen).toBe(false);
    await searchButton.trigger('click');
    expect(store.mobileSearchOpen).toBe(true);
    await searchButton.trigger('click');
    expect(store.mobileSearchOpen).toBe(false);
  });

  it('search button reflects open state via aria-expanded', async () => {
    setActivePinia(createPinia());
    const store = useAppStore();
    const wrapper = mountComponent(LayoutHeaderActionButtons);
    const searchButton = wrapper.find('[data-slot="search-button"]');

    expect(searchButton.attributes('aria-expanded')).toBe('false');
    store.setMobileSearchOpen(true);
    await wrapper.vm.$nextTick();
    expect(searchButton.attributes('aria-expanded')).toBe('true');
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
