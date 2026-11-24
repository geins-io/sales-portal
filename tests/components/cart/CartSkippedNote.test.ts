import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mountComponent } from '../../utils/component';
import CartSkippedNote from '../../../app/components/cart/CartSkippedNote.vue';
import { useCartStore } from '../../../app/stores/cart';

// The shared passthrough drops a count the key does not spell out; this one
// keeps it visible.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    locale: ref('en'),
  }),
}));

describe('CartSkippedNote', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('says how many products a bulk add left out', () => {
    useCartStore().skippedConfigurable = 2;

    const note = mountComponent(CartSkippedNote).find(
      '[data-testid="cart-skipped-configurable"]',
    );

    expect(note.text()).toBe('cart.skipped_configurable {"count":2}');
  });

  it('renders nothing when nothing was left out', () => {
    const wrapper = mountComponent(CartSkippedNote);

    expect(
      wrapper.find('[data-testid="cart-skipped-configurable"]').exists(),
    ).toBe(false);
  });

  it('goes away when the count is cleared', async () => {
    const store = useCartStore();
    store.skippedConfigurable = 1;
    const wrapper = mountComponent(CartSkippedNote);

    store.skippedConfigurable = 0;
    await nextTick();

    expect(
      wrapper.find('[data-testid="cart-skipped-configurable"]').exists(),
    ).toBe(false);
  });

  it('says how many products in several SKUs a bulk add left out', () => {
    useCartStore().skippedMultiSku = 3;

    const wrapper = mountComponent(CartSkippedNote);

    expect(wrapper.find('[data-testid="cart-skipped-multi-sku"]').text()).toBe(
      'cart.skipped_multi_sku {"count":3}',
    );
    expect(
      wrapper.find('[data-testid="cart-skipped-configurable"]').exists(),
    ).toBe(false);
  });

  it('shows both counts when a bulk add left out both kinds', () => {
    const store = useCartStore();
    store.skippedConfigurable = 1;
    store.skippedMultiSku = 2;

    const wrapper = mountComponent(CartSkippedNote);

    expect(
      wrapper.find('[data-testid="cart-skipped-configurable"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="cart-skipped-multi-sku"]').exists(),
    ).toBe(true);
  });

  it('renders no multi-SKU line when none was left out', () => {
    useCartStore().skippedConfigurable = 1;

    expect(
      mountComponent(CartSkippedNote)
        .find('[data-testid="cart-skipped-multi-sku"]')
        .exists(),
    ).toBe(false);
  });
});
