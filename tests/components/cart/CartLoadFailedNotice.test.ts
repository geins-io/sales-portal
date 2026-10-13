import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mountComponent } from '../../utils/component';
import CartLoadFailedNotice from '../../../app/components/cart/CartLoadFailedNotice.vue';
import { useCartStore } from '../../../app/stores/cart';
import type { CartType } from '../../../shared/types/commerce';

describe('CartLoadFailedNotice', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('says the cart could not be loaded when the last read failed', () => {
    useCartStore().loadFailed = true;

    const notice = mountComponent(CartLoadFailedNotice).find(
      '[data-testid="cart-load-failed"]',
    );

    expect(notice.exists()).toBe(true);
    expect(notice.attributes('role')).toBe('alert');
    expect(notice.text()).toContain('cart.load_failed');
    expect(notice.text()).toContain('errors.retry');
  });

  it('says the lines shown may be out of date when it still shows some', () => {
    const store = useCartStore();
    store.loadFailed = true;
    store.cart = {
      id: 'cart-1',
      items: [{ id: 'line-1', quantity: 1 }],
    } as unknown as CartType;

    const notice = mountComponent(CartLoadFailedNotice).find(
      '[data-testid="cart-load-failed"]',
    );

    expect(notice.text()).toContain('cart.refresh_failed');
    expect(notice.text()).not.toContain('cart.load_failed');
  });

  it('renders nothing while the cart reads fine', () => {
    const wrapper = mountComponent(CartLoadFailedNotice);

    expect(wrapper.find('[data-testid="cart-load-failed"]').exists()).toBe(
      false,
    );
  });

  it('reads the cart again on Try again', async () => {
    const store = useCartStore();
    store.loadFailed = true;
    const fetchCart = vi.spyOn(store, 'fetchCart').mockResolvedValue();

    await mountComponent(CartLoadFailedNotice)
      .find('[data-testid="cart-load-retry"]')
      .trigger('click');

    expect(fetchCart).toHaveBeenCalledOnce();
  });

  it('holds Try again while a read is on its way', () => {
    const store = useCartStore();
    store.loadFailed = true;
    store.isLoading = true;

    const retry = mountComponent(CartLoadFailedNotice).find(
      '[data-testid="cart-load-retry"]',
    );

    expect(retry.attributes('disabled')).toBeDefined();
  });
});
