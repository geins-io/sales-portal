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
});
