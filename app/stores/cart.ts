import { defineStore } from 'pinia';
import type { CartType } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { internalFetch } from '~/utils/internal-fetch';

/**
 * The new cart with its lines in the order the buyer has seen: lines already
 * shown keep their place by id, new ones follow in the API's order. On a
 * CPQ-enabled account the cart answers an updated line last, which would move
 * the row under the buyer's click. Another cart id is a different cart, taken
 * as answered.
 */
function keepLineOrder(shown: CartType | null, next: CartType): CartType {
  if (!shown || shown.id !== next.id) return next;
  const items = next.items ?? [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const kept = (shown.items ?? []).flatMap((item) => {
    const line = item.id === undefined ? undefined : byId.get(item.id);
    return line ? [line] : [];
  });
  const added = items.filter((item) => !kept.includes(item));
  return { ...next, items: [...kept, ...added] };
}

export const useCartStore = defineStore('cart', () => {
  const cartId = useCookie<string | null>(COOKIE_NAMES.CART_ID, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  const cart = ref<CartType | null>(null);
  function setCart(next: CartType) {
    cart.value = keepLineOrder(cart.value, next);
  }
  const isOpen = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const itemCount = computed(
    () =>
      cart.value?.items?.reduce((sum, item) => sum + (item.quantity ?? 1), 0) ??
      0,
  );
  const isEmpty = computed(() => itemCount.value === 0);

  const discountAmount = computed(
    () => cart.value?.summary?.fixedAmountDiscountIncVat ?? 0,
  );

  const visibleCartCampaigns = computed(() =>
    filterVisibleCampaigns(cart.value?.appliedCampaigns ?? []),
  );

  async function fetchCart() {
    if (!cartId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      setCart(
        await internalFetch<CartType>('/api/cart', {
          query: { cartId: cartId.value },
        }),
      );
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
      setCart(
        await $fetch<CartType>('/api/cart/items', {
          method: 'POST',
          body: { cartId: cartId.value, skuId, quantity },
        }),
      );
      isOpen.value = true;
    } catch {
      error.value = 'Failed to add item';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * A committed configuration as a cart line, answering the line it landed on.
   * Unlike `addItem` it throws: the configurator says at its own action why the
   * add failed, and offers a retry.
   */
  async function addConfiguredItem(
    committedConfigurationId: string,
    skuId: number,
    quantity: number,
  ): Promise<{ cartId: string; itemId: string } | null> {
    isLoading.value = true;
    try {
      let id = cartId.value;
      if (!id) {
        id = (await $fetch<CartType>('/api/cart', { method: 'POST' })).id;
        cartId.value = id;
      }
      const answer = await $fetch<{
        cart: CartType | null;
        itemId: string | null;
      }>(`/api/configurations/${committedConfigurationId}/cart`, {
        method: 'POST',
        body: { cartId: id, skuId, quantity },
      });
      // The line is in even when the route could not read the cart back.
      if (answer.cart) setCart(answer.cart);
      else await fetchCart();
      isOpen.value = true;
      return answer.itemId ? { cartId: id, itemId: answer.itemId } : null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * A committed configuration onto a configured line, which keeps its id. It
   * throws like `addConfiguredItem`: the configurator says at its own action
   * that the line kept its old choices.
   */
  async function replaceConfiguredItem(
    committedConfigurationId: string,
    line: { cartId: string; itemId: string },
  ): Promise<{ cartId: string; itemId: string }> {
    isLoading.value = true;
    try {
      const answer = await $fetch<{
        cart: CartType | null;
        itemId: string;
      }>(`/api/configurations/${committedConfigurationId}/cart`, {
        method: 'PUT',
        body: line,
      });
      // The line is swapped even when the route could not read the cart back.
      if (answer.cart) setCart(answer.cart);
      else await fetchCart();
      isOpen.value = true;
      return { cartId: line.cartId, itemId: answer.itemId };
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
        setCart(
          await $fetch<CartType>('/api/cart/items', {
            method: 'DELETE',
            query: { cartId: cartId.value, itemId },
          }),
        );
      } else {
        setCart(
          await $fetch<CartType>('/api/cart/items', {
            method: 'PUT',
            body: { cartId: cartId.value, itemId, quantity },
          }),
        );
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
      setCart(
        await $fetch<CartType>('/api/cart/promo', {
          method: 'POST',
          body: { cartId: cartId.value, promoCode: code },
        }),
      );
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
      setCart(
        await $fetch<CartType>('/api/cart/promo', {
          method: 'DELETE',
          query: { cartId: cartId.value },
        }),
      );
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
    discountAmount,
    visibleCartCampaigns,
    fetchCart,
    addItem,
    addConfiguredItem,
    replaceConfiguredItem,
    updateQuantity,
    removeItem,
    applyPromoCode,
    removePromoCode,
  };
});
