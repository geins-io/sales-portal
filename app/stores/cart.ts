import { defineStore } from 'pinia';
import type { CartType } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { internalFetch } from '~/utils/internal-fetch';

export const useCartStore = defineStore('cart', () => {
  const cartId = useCookie<string | null>(COOKIE_NAMES.CART_ID, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  const cart = ref<CartType | null>(null);
  const isOpen = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  /**
   * How many configurable products the last bulk add left out, for the note
   * above the cart's lines. It holds until the next add or another cart, not
   * through quantity changes: the buyer reads the cart while adjusting it.
   */
  const skippedConfigurable = ref(0);
  watch(
    cartId,
    () => {
      skippedConfigurable.value = 0;
    },
    { flush: 'sync' },
  );

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
      cart.value = await internalFetch<CartType>('/api/cart', {
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
    skippedConfigurable.value = 0;
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
    skippedConfigurable.value = 0;
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
      if (answer.cart) cart.value = answer.cart;
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
      if (answer.cart) cart.value = answer.cart;
      else await fetchCart();
      isOpen.value = true;
      return { cartId: line.cartId, itemId: answer.itemId };
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * A bulk add (reorder, a saved list's "add all") that left `skipped`
   * configurable products out. The drawer opens on a skip even when nothing
   * was added, since the note in it is the only place the buyer reads why.
   */
  async function addItems(
    lines: { skuId: number; quantity: number }[],
    skipped: number,
  ) {
    for (const line of lines) {
      await addItem(line.skuId, line.quantity);
    }
    skippedConfigurable.value = skipped;
    if (skipped > 0) isOpen.value = true;
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
    skippedConfigurable,
    itemCount,
    isEmpty,
    discountAmount,
    visibleCartCampaigns,
    fetchCart,
    addItem,
    addItems,
    addConfiguredItem,
    replaceConfiguredItem,
    updateQuantity,
    removeItem,
    applyPromoCode,
    removePromoCode,
  };
});
