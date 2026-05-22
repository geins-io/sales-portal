import { useCartStore } from '~/stores/cart';

/**
 * Cart Init Plugin (universal)
 *
 * Hydrates the cart store during SSR so the first paint of every route
 * (including /checkout) renders with cart data already populated. Pinia's
 * Nuxt module auto-serializes store state into the Nuxt payload, so once
 * the server populates `cart` the client rehydrates it without a flash.
 *
 * Server: awaits the /api/cart round-trip, required so SSR HTML is correct.
 * Client: skips when the payload already filled `cart`; otherwise fires
 *   fetchCart() WITHOUT awaiting so hydration is never blocked on the wire.
 *
 * See: docs/patterns/cart-hydration.md
 */

type Mode = 'server' | 'client';

interface CartStoreInitContract {
  cartId: string | null;
  cart: unknown;
  fetchCart: () => Promise<void>;
}

/**
 * Pure init function, exported for unit testing without booting Nuxt.
 * The plugin below is a thin wrapper that picks the mode from `import.meta`.
 */
export async function initCart(
  store: CartStoreInitContract,
  mode: Mode,
): Promise<void> {
  if (!store.cartId) return;

  if (mode === 'server') {
    await store.fetchCart();
    return;
  }

  // Client: payload-hydrated path. If the SSR-serialized state already
  // includes the cart, do nothing. Otherwise (SPA-only navigations, cookie
  // set after initial paint), fire-and-forget so we don't stall hydration.
  if (store.cart) return;
  void store.fetchCart();
}

export default defineNuxtPlugin(async () => {
  const cartStore = useCartStore();
  await initCart(cartStore, import.meta.server ? 'server' : 'client');
});
