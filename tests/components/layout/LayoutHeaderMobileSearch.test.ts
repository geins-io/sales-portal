import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountComponent } from '../../utils/component';
import LayoutHeaderMobileSearch from '../../../app/components/layout/header/LayoutHeaderMobileSearch.vue';
import { useAppStore } from '../../../app/stores/app';

// SearchBar owns the query/autocomplete logic and is exercised by its own
// suite; here we only need a stand-in that exposes the input so we can assert
// the overlay mounts it. Teleport is stubbed so the backdrop renders inline.
const stubs = {
  SearchBar: {
    name: 'SearchBar',
    template:
      '<input data-testid="search-input" :data-autofocus="autofocus" />',
    props: { autofocus: Boolean },
  },
  teleport: true,
};

describe('LayoutHeaderMobileSearch', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders nothing visible when the overlay is closed', () => {
    const wrapper = mountComponent(LayoutHeaderMobileSearch, {
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="mobile-search-panel"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="mobile-search-backdrop"]').exists(),
    ).toBe(false);
  });

  it('renders the search panel, backdrop and SearchBar when open', async () => {
    const store = useAppStore();
    const wrapper = mountComponent(LayoutHeaderMobileSearch, {
      global: { stubs },
    });
    store.setMobileSearchOpen(true);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="mobile-search-panel"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="mobile-search-backdrop"]').exists(),
    ).toBe(true);
    // The desktop SearchBar is reused (no bespoke mobile search field).
    expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true);
  });

  it('uses a white search area with 10px 20px padding', async () => {
    const store = useAppStore();
    const wrapper = mountComponent(LayoutHeaderMobileSearch, {
      global: { stubs },
    });
    store.setMobileSearchOpen(true);
    await wrapper.vm.$nextTick();

    const panel = wrapper.find('[data-testid="mobile-search-panel"]');
    expect(panel.attributes('style')).toContain('padding: 10px 20px');
    expect(panel.classes()).toContain('bg-white');
  });

  it('autofocuses the reused SearchBar', async () => {
    const store = useAppStore();
    const wrapper = mountComponent(LayoutHeaderMobileSearch, {
      global: { stubs },
    });
    store.setMobileSearchOpen(true);
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="search-input"]');
    expect(input.attributes('data-autofocus')).toBe('true');
  });

  it('closes the overlay when the backdrop is tapped', async () => {
    const store = useAppStore();
    store.setMobileSearchOpen(true);
    const wrapper = mountComponent(LayoutHeaderMobileSearch, {
      global: { stubs },
    });
    await wrapper.vm.$nextTick();

    await wrapper
      .find('[data-testid="mobile-search-backdrop"]')
      .trigger('click');
    expect(store.mobileSearchOpen).toBe(false);
  });

  it('stays hidden on desktop via the lg:hidden wrapper', () => {
    const wrapper = mountComponent(LayoutHeaderMobileSearch, {
      global: { stubs },
    });
    expect(wrapper.classes()).toContain('lg:hidden');
  });
});
