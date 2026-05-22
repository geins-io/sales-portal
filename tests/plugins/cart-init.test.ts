import { describe, it, expect, vi } from 'vitest';
import { initCart } from '../../app/plugins/cart-init';

type CartLike = { id: string; items: unknown[] } | null;

interface MockStore {
  cartId: string | null;
  cart: CartLike;
  fetchCart: ReturnType<typeof vi.fn>;
}

function makeStore(overrides: Partial<MockStore> = {}): MockStore {
  return {
    cartId: 'cid-1',
    cart: null,
    fetchCart: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('cart-init plugin / initCart', () => {
  it('short-circuits when cartId is null (server)', async () => {
    const store = makeStore({ cartId: null });
    await initCart(store, 'server');
    expect(store.fetchCart).not.toHaveBeenCalled();
  });

  it('short-circuits when cartId is null (client)', async () => {
    const store = makeStore({ cartId: null });
    await initCart(store, 'client');
    expect(store.fetchCart).not.toHaveBeenCalled();
  });

  it('awaits fetchCart exactly once on the server when cart is null', async () => {
    const store = makeStore();
    let resolved = false;
    store.fetchCart.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            resolved = true;
            resolve();
          }, 5);
        }),
    );

    await initCart(store, 'server');
    expect(store.fetchCart).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(true);
  });

  it('skips fetchCart on the client when cart is already populated (payload hydrated)', async () => {
    const store = makeStore({
      cart: { id: 'cid-1', items: [] },
    });
    await initCart(store, 'client');
    expect(store.fetchCart).not.toHaveBeenCalled();
  });

  it('fires fetchCart without awaiting on the client when cart is null', async () => {
    const store = makeStore();
    let resolveFetch: (() => void) | null = null;
    store.fetchCart.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    await initCart(store, 'client');

    // fetchCart was invoked but the promise has not yet resolved, which
    // proves the plugin did not block hydration on the network round-trip.
    expect(store.fetchCart).toHaveBeenCalledTimes(1);
    expect(resolveFetch).not.toBeNull();
    resolveFetch?.();
  });
});
