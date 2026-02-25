import { defineStore } from 'pinia';
import type { CartType } from '#shared/types/commerce';
import { COOKIE_NAMES } from '#shared/constants/storage';

export const useCartStore = defineStore('cart', () => {
  const cartId = useCookie<string | null>(COOKIE_NAMES.CART_ID, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  const cart = ref<CartType | null>(null);
  const isOpen = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const itemCount = computed(
    () =>
      cart.value?.items?.reduce((sum, item) => sum + (item.quantity ?? 1), 0) ??
      0,
  );
  const isEmpty = computed(() => itemCount.value === 0);

  async function fetchCart() {
    if (!cartId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      cart.value = await $fetch<CartType>('/api/cart', {
        query: { cartId: cartId.value },
      });
    } catch {
      error.value = 'Failed to load cart';
      cart.value = null;
      cartId.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function addItem(skuId: number, quantity: number) {
    isLoading.value = true;
    error.value = null;
    try {
      if (!cartId.value) {
        const newCart = await $fetch<CartType>('/api/cart', { method: 'POST' });
        cartId.value = newCart.id;
      }
      cart.value = await $fetch<CartType>('/api/cart/items', {
        method: 'POST',
        body: { cartId: cartId.value, skuId, quantity },
      });
      isOpen.value = true;
    } catch {
      error.value = 'Failed to add item';
    } finally {
      isLoading.value = false;
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (!cartId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      if (quantity === 0) {
        cart.value = await $fetch<CartType>('/api/cart/items', {
          method: 'DELETE',
          query: { cartId: cartId.value, itemId },
        });
      } else {
        cart.value = await $fetch<CartType>('/api/cart/items', {
          method: 'PUT',
          body: { cartId: cartId.value, itemId, quantity },
        });
      }
    } catch {
      error.value = 'Failed to update item';
    } finally {
      isLoading.value = false;
    }
  }

  async function removeItem(itemId: string) {
    return updateQuantity(itemId, 0);
  }

  async function applyPromoCode(code: string) {
    if (!cartId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      cart.value = await $fetch<CartType>('/api/cart/promo', {
        method: 'POST',
        body: { cartId: cartId.value, promoCode: code },
      });
    } catch {
      error.value = 'Invalid promo code';
    } finally {
      isLoading.value = false;
    }
  }

  async function removePromoCode() {
    if (!cartId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      cart.value = await $fetch<CartType>('/api/cart/promo', {
        method: 'DELETE',
        query: { cartId: cartId.value },
      });
    } catch {
      error.value = 'Failed to remove promo code';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    cart,
    cartId,
    isOpen,
    isLoading,
    error,
    itemCount,
    isEmpty,
    fetchCart,
    addItem,
    updateQuantity,
    removeItem,
    applyPromoCode,
    removePromoCode,
  };
});
