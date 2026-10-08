import { defineStore } from 'pinia';
import { useDebounceFn } from '@vueuse/core';
import type { CartType } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { internalFetch } from '~/utils/internal-fetch';

/** The portal's own error code on a failed call to an `/api` route. */
function errorCodeOf(failure: unknown): unknown {
  return (failure as { data?: { data?: { code?: unknown } } } | null)?.data
    ?.data?.code;
}

/**
 * How long a configured line waits for the buyer to stop changing its quantity.
 * Each change is a reopen and a commit upstream, seconds long, so a run of
 * clicks is sent as one.
 */
export const CONFIGURED_QUANTITY_SETTLE_MS = 700;

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
  /**
   * The cart is there but answers only to the buyer signed in, so it is kept
   * by id and the cart asks for sign-in in place of its lines. Set by the
   * read's answer alone.
   */
  const needsSignIn = ref(false);
  watch(
    cartId,
    () => {
      skippedConfigurable.value = 0;
      needsSignIn.value = false;
    },
    { flush: 'sync' },
  );

  /** A configured line's quantity the buyer chose, until its change answers. */
  const pendingQuantities = ref(new Map<string, number>());
  /** Configured lines whose change is on its way; their controls hold. */
  const updatingItems = ref(new Set<string>());
  /** Lines whose last quantity change failed and left them as they were. */
  const quantityFailed = ref(new Set<string>());
  const isUpdatingLines = computed(
    () => pendingQuantities.value.size > 0 || updatingItems.value.size > 0,
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
      needsSignIn.value = false;
    } catch (failure) {
      cart.value = null;
      if (errorCodeOf(failure) === 'CART_LOGIN_REQUIRED') {
        needsSignIn.value = true;
        return;
      }
      error.value = 'Failed to load cart';
      cartId.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function addItem(skuId: number, quantity: number) {
    skippedConfigurable.value = 0;
    // An add would be refused too, and a new cart would orphan this one.
    if (needsSignIn.value) {
      isOpen.value = true;
      return;
    }
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
    if (needsSignIn.value) {
      isOpen.value = true;
      throw new Error('The cart needs the buyer signed in');
    }
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
    if (quantity === 0) return deleteLine(itemId);
    const line = cart.value?.items?.find((item) => item.id === itemId);
    if (line?.configuration) {
      if (updatingItems.value.has(itemId)) return;
      quantityFailed.value.delete(itemId);
      pendingQuantities.value.set(itemId, quantity);
      settledChange(itemId)();
      return;
    }
    quantityFailed.value.delete(itemId);
    await putQuantity(itemId, quantity);
  }

  const settledChanges = new Map<string, () => void>();
  function settledChange(itemId: string) {
    let change = settledChanges.get(itemId);
    if (!change) {
      change = useDebounceFn(
        () => sendConfiguredQuantity(itemId),
        CONFIGURED_QUANTITY_SETTLE_MS,
      );
      settledChanges.set(itemId, change);
    }
    return change;
  }

  async function sendConfiguredQuantity(itemId: string) {
    const quantity = pendingQuantities.value.get(itemId);
    const line = cart.value?.items?.find((item) => item.id === itemId);
    // A line that left the cart while the change settled has nothing to change.
    if (quantity === undefined || !line || line.quantity === quantity) {
      pendingQuantities.value.delete(itemId);
      return;
    }
    updatingItems.value.add(itemId);
    try {
      await putQuantity(itemId, quantity);
    } finally {
      pendingQuantities.value.delete(itemId);
      updatingItems.value.delete(itemId);
    }
  }

  async function putQuantity(itemId: string, quantity: number) {
    isLoading.value = true;
    error.value = null;
    try {
      cart.value = await $fetch<CartType>('/api/cart/items', {
        method: 'PUT',
        body: { cartId: cartId.value, itemId, quantity },
      });
    } catch {
      quantityFailed.value.add(itemId);
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteLine(itemId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      cart.value = await $fetch<CartType>('/api/cart/items', {
        method: 'DELETE',
        query: { cartId: cartId.value, itemId },
      });
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
    needsSignIn,
    pendingQuantities,
    updatingItems,
    quantityFailed,
    isUpdatingLines,
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
