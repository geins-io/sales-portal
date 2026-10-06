import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mountComponent } from '../../utils/component';
import CartSignInPrompt from '../../../app/components/cart/CartSignInPrompt.vue';
import { useAuthStore } from '../../../app/stores/auth';
import { useCartStore } from '../../../app/stores/cart';

describe('CartSignInPrompt', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('says the cart shows once the buyer signs in', () => {
    const wrapper = mountComponent(CartSignInPrompt);

    expect(wrapper.text()).toContain('cart.sign_in_to_see_cart');
    expect(wrapper.find('button').text()).toBe('auth.sign_in');
  });

  it('opens sign-in in place of the cart drawer', async () => {
    const cart = useCartStore();
    cart.isOpen = true;
    const wrapper = mountComponent(CartSignInPrompt);

    await wrapper.find('button').trigger('click');

    const auth = useAuthStore();
    expect(auth.sheetOpen).toBe(true);
    expect(auth.sheetView).toBe('login');
    expect(cart.isOpen).toBe(false);
  });
});
