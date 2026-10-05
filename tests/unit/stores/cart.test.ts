import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// Mock useCookie — must be done via module mock since Nuxt's auto-import resolves it
const mockCartIdRef = ref<string | null>(null);
vi.mock('#app/composables/cookie', () => ({
  useCookie: vi.fn(() => mockCartIdRef),
}));

// Mock $fetch, and route the SSR-aware internalFetch helper to the same mock
// so the store's calls can be asserted on one spy.
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);
vi.mock('~/utils/internal-fetch', () => ({
  internalFetch: (...args: unknown[]) => mockFetch(...args),
}));

// Must import after mocks are set up
const { useCartStore } = await import('../../../app/stores/cart');

const mockCart = {
  id: 'cart-123',
  items: [
    {
      id: 'item-1',
      skuId: 100,
      quantity: 2,
      product: {
        productId: '1',
        name: 'Test Product',
        alias: 'test-product',
        articleNumber: 'ART-001',
        brand: { name: 'Brand' },
        productImages: [{ fileName: 'img.jpg' }],
        canonicalUrl: '/test-product',
        primaryCategory: { name: 'Cat' },
        skus: [],
        unitPrice: {
          sellingPriceIncVat: 100,
          sellingPriceIncVatFormatted: '100 kr',
        },
      },
      unitPrice: {
        sellingPriceIncVat: 100,
        sellingPriceIncVatFormatted: '100 kr',
      },
      totalPrice: {
        sellingPriceIncVat: 200,
        sellingPriceIncVatFormatted: '200 kr',
      },
    },
  ],
  freeShipping: false,
  completed: false,
  fixedDiscount: 0,
  appliedCampaigns: [],
  summary: {
    total: { sellingPriceIncVat: 200, sellingPriceIncVatFormatted: '200 kr' },
    subTotal: {
      sellingPriceIncVat: 200,
      sellingPriceIncVatFormatted: '200 kr',
    },
    vats: [],
    fees: {
      paymentFeeIncVat: 0,
      paymentFeeExVat: 0,
      shippingFeeIncVat: 0,
      shippingFeeExVat: 0,
    },
    balance: {
      pending: 0,
      pendingFormatted: '0 kr',
      totalSellingPriceExBalanceExVat: 200,
      totalSellingPriceExBalanceIncVat: 200,
      totalSellingPriceExBalanceIncVatFormatted: '200 kr',
    },
    shipping: {},
    payment: {},
  },
};

describe('useCartStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCartIdRef.value = null;
    mockFetch.mockReset();
  });

  describe('fetchCart', () => {
    it('calls $fetch with correct params', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(mockCart);

      const store = useCartStore();
      await store.fetchCart();

      expect(mockFetch).toHaveBeenCalledWith('/api/cart', {
        query: { cartId: 'cart-123' },
      });
      expect(store.cart).toEqual(mockCart);
      expect(store.itemCount).toBe(2);
    });

    it('does nothing when no cartId', async () => {
      const store = useCartStore();
      await store.fetchCart();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('early-returns when cartId.value is null without touching $fetch (regression guard)', async () => {
      mockCartIdRef.value = null;
      const store = useCartStore();
      await store.fetchCart();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(store.cart).toBeNull();
      expect(store.isLoading).toBe(false);
    });

    it('clears cartId on error', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const store = useCartStore();
      await store.fetchCart();

      expect(store.error).toBe('Failed to load cart');
      expect(store.cart).toBeNull();
      expect(mockCartIdRef.value).toBeNull();
    });
  });

  describe('SSR payload hydration', () => {
    it('derives itemCount and isEmpty from $state patched via Pinia payload bridging', () => {
      const store = useCartStore();
      // Simulate what @pinia/nuxt does on the client: the SSR-serialized
      // pinia.state is patched into the fresh store before any component
      // renders. We assert the computeds read from that patched state.
      store.$patch({
        cart: {
          id: 'c1',
          items: [
            { id: 'i1', quantity: 2 },
            { id: 'i2', quantity: 3 },
          ],
          // The rest of CartType is required at the type-level but ignored
          // by the computeds under test.
        } as unknown as typeof store.cart,
        cartId: 'c1',
      });

      expect(store.itemCount).toBe(5);
      expect(store.isEmpty).toBe(false);
    });
  });

  describe('addItem', () => {
    it('creates cart first if no cartId', async () => {
      const newCart = { ...mockCart, id: 'new-cart' };
      mockFetch
        .mockResolvedValueOnce(newCart) // POST /api/cart
        .mockResolvedValueOnce(mockCart); // POST /api/cart/items

      const store = useCartStore();
      await store.addItem(100, 1);

      expect(mockFetch).toHaveBeenCalledWith('/api/cart', { method: 'POST' });
      expect(mockFetch).toHaveBeenCalledWith('/api/cart/items', {
        method: 'POST',
        body: { cartId: 'new-cart', skuId: 100, quantity: 1 },
      });
    });

    it('opens drawer after success', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(mockCart);

      const store = useCartStore();
      expect(store.isOpen).toBe(false);

      await store.addItem(100, 1);
      expect(store.isOpen).toBe(true);
    });

    it('sets error on failure', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockRejectedValueOnce(new Error('fail'));

      const store = useCartStore();
      await store.addItem(100, 1);

      expect(store.error).toBe('Failed to add item');
    });
  });

  describe('addConfiguredItem', () => {
    const COMMITTED_ID = 'committed-1';

    it('creates a cart first when there is none, then adds by the committed id', async () => {
      const newCart = { ...mockCart, id: 'new-cart' };
      mockFetch
        .mockResolvedValueOnce(newCart) // POST /api/cart
        .mockResolvedValueOnce({ cart: mockCart, itemId: 'item-1' }); // POST the configured line

      const store = useCartStore();
      await store.addConfiguredItem(COMMITTED_ID, 1652, 2);

      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/cart', {
        method: 'POST',
      });
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `/api/configurations/${COMMITTED_ID}/cart`,
        {
          method: 'POST',
          body: { cartId: 'new-cart', skuId: 1652, quantity: 2 },
        },
      );
      expect(mockCartIdRef.value).toBe('new-cart');
    });

    it('keeps the cart it has, takes the answer as the cart and opens the drawer', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce({ cart: mockCart, itemId: 'item-1' });

      const store = useCartStore();
      await expect(
        store.addConfiguredItem(COMMITTED_ID, 1652, 1),
      ).resolves.toEqual({ cartId: 'cart-123', itemId: 'item-1' });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(store.cart).toEqual(mockCart);
      expect(store.isOpen).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('reads the cart itself when the add went through without one, and opens the drawer', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch
        .mockResolvedValueOnce({ cart: null, itemId: 'item-1' }) // POST the configured line
        .mockResolvedValueOnce(mockCart); // GET /api/cart

      const store = useCartStore();
      await store.addConfiguredItem(COMMITTED_ID, 1652, 1);

      expect(mockFetch).toHaveBeenLastCalledWith('/api/cart', {
        query: { cartId: 'cart-123' },
      });
      expect(store.cart).toEqual(mockCart);
      expect(store.isOpen).toBe(true);
    });

    it('answers no line when the route names none', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce({ cart: mockCart, itemId: null });

      const store = useCartStore();

      await expect(
        store.addConfiguredItem(COMMITTED_ID, 1652, 1),
      ).resolves.toBeNull();
      expect(store.isOpen).toBe(true);
    });

    it('is loading while the add is in flight', async () => {
      mockCartIdRef.value = 'cart-123';
      let answer!: (cart: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((settle) => {
          answer = settle;
        }),
      );

      const store = useCartStore();
      const adding = store.addConfiguredItem(COMMITTED_ID, 1652, 1);

      expect(store.isLoading).toBe(true);
      answer({ cart: mockCart, itemId: 'item-1' });
      await adding;
      expect(store.isLoading).toBe(false);
    });

    it('throws the failure to its caller and leaves the drawer and the cart as they were', async () => {
      mockCartIdRef.value = 'cart-123';
      const failure = Object.assign(new Error('not added'), {
        statusCode: 409,
      });
      mockFetch.mockRejectedValueOnce(failure);

      const store = useCartStore();
      await expect(store.addConfiguredItem(COMMITTED_ID, 1652, 1)).rejects.toBe(
        failure,
      );

      expect(store.isOpen).toBe(false);
      expect(store.cart).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(mockCartIdRef.value).toBe('cart-123');
    });
  });

  describe('updateQuantity', () => {
    it('calls DELETE when quantity is 0', async () => {
      mockCartIdRef.value = 'cart-123';
      const emptyCart = { ...mockCart, items: [] };
      mockFetch.mockResolvedValueOnce(emptyCart);

      const store = useCartStore();
      await store.updateQuantity('item-1', 0);

      expect(mockFetch).toHaveBeenCalledWith('/api/cart/items', {
        method: 'DELETE',
        query: { cartId: 'cart-123', itemId: 'item-1' },
      });
    });

    it('calls PUT when quantity > 0', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(mockCart);

      const store = useCartStore();
      await store.updateQuantity('item-1', 3);

      expect(mockFetch).toHaveBeenCalledWith('/api/cart/items', {
        method: 'PUT',
        body: { cartId: 'cart-123', itemId: 'item-1', quantity: 3 },
      });
    });

    it('does nothing when no cartId', async () => {
      const store = useCartStore();
      await store.updateQuantity('item-1', 2);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('delegates to updateQuantity with 0', async () => {
      mockCartIdRef.value = 'cart-123';
      const emptyCart = { ...mockCart, items: [] };
      mockFetch.mockResolvedValueOnce(emptyCart);

      const store = useCartStore();
      await store.removeItem('item-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/cart/items', {
        method: 'DELETE',
        query: { cartId: 'cart-123', itemId: 'item-1' },
      });
    });
  });

  describe('applyPromoCode', () => {
    it('calls correct endpoint', async () => {
      mockCartIdRef.value = 'cart-123';
      const cartWithPromo = { ...mockCart, promoCode: 'SAVE10' };
      mockFetch.mockResolvedValueOnce(cartWithPromo);

      const store = useCartStore();
      await store.applyPromoCode('SAVE10');

      expect(mockFetch).toHaveBeenCalledWith('/api/cart/promo', {
        method: 'POST',
        body: { cartId: 'cart-123', promoCode: 'SAVE10' },
      });
    });

    it('does nothing when no cartId', async () => {
      const store = useCartStore();
      await store.applyPromoCode('SAVE10');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sets error on invalid code', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockRejectedValueOnce(new Error('invalid'));

      const store = useCartStore();
      await store.applyPromoCode('BAD');

      expect(store.error).toBe('Invalid promo code');
    });
  });

  describe('removePromoCode', () => {
    it('calls correct endpoint', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(mockCart);

      const store = useCartStore();
      await store.removePromoCode();

      expect(mockFetch).toHaveBeenCalledWith('/api/cart/promo', {
        method: 'DELETE',
        query: { cartId: 'cart-123' },
      });
    });

    it('does nothing when no cartId', async () => {
      const store = useCartStore();
      await store.removePromoCode();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('line order', () => {
    // On a CPQ-enabled account the cart answers an updated line last; the
    // store keeps the order the buyer has seen. Lines are told apart by id.
    const line = (id: string | undefined, quantity = 1) => ({
      ...mockCart.items[0]!,
      id,
      quantity,
    });
    const cartOf = (cartId: string, items: ReturnType<typeof line>[]) => ({
      ...mockCart,
      id: cartId,
      items,
    });
    const ids = (store: ReturnType<typeof useCartStore>) =>
      store.cart?.items?.map((item) => item.id);

    async function shownWith(items: ReturnType<typeof line>[]) {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(cartOf('cart-123', items));
      const store = useCartStore();
      await store.fetchCart();
      return store;
    }

    it('keeps an updated line where it was', async () => {
      const store = await shownWith([line('a'), line('b')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('b'), line('a', 2)]),
      );
      await store.updateQuantity('a', 2);
      expect(ids(store)).toEqual(['a', 'b']);
      expect(store.cart?.items?.[0]?.quantity).toBe(2);
    });

    it('puts an added line last, after the lines already shown', async () => {
      const store = await shownWith([line('a'), line('b')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('c'), line('b'), line('a')]),
      );
      await store.addItem(100, 1);
      expect(ids(store)).toEqual(['a', 'b', 'c']);
    });

    it('keeps the API order among several new lines', async () => {
      const store = await shownWith([line('a')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('d'), line('a'), line('c')]),
      );
      await store.fetchCart();
      expect(ids(store)).toEqual(['a', 'd', 'c']);
    });

    it('drops a removed line and keeps the rest in place', async () => {
      const store = await shownWith([line('a'), line('b'), line('c')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('c'), line('a')]),
      );
      await store.removeItem('b');
      expect(ids(store)).toEqual(['a', 'c']);
    });

    it('takes the API order for a cart replaced wholesale', async () => {
      const store = await shownWith([line('a'), line('b')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-456', [line('b'), line('a')]),
      );
      await store.fetchCart();
      expect(ids(store)).toEqual(['b', 'a']);
    });

    it('appends a line without an id in the API order', async () => {
      const store = await shownWith([line('a'), line('b')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line(undefined), line('b'), line('a')]),
      );
      await store.fetchCart();
      expect(ids(store)).toEqual(['a', 'b', undefined]);
    });

    it('never matches a shown line without an id to a new one', async () => {
      const store = await shownWith([line(undefined), line('a')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('a'), line(undefined)]),
      );
      await store.fetchCart();
      expect(ids(store)).toEqual(['a', undefined]);
    });

    // The type says `items` is always there; the API has answered without it.
    const withoutItems = (cartId: string) =>
      ({ ...mockCart, id: cartId, items: undefined }) as unknown as ReturnType<
        typeof cartOf
      >;

    it('takes the API order after a cart shown without items', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(withoutItems('cart-123'));
      const store = useCartStore();
      await store.fetchCart();
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('b'), line('a')]),
      );
      await store.fetchCart();
      expect(ids(store)).toEqual(['b', 'a']);
    });

    it('shows no lines for an answer without items', async () => {
      const store = await shownWith([line('a')]);
      mockFetch.mockResolvedValueOnce(withoutItems('cart-123'));
      await store.fetchCart();
      expect(store.cart?.items).toEqual([]);
    });

    it('takes the answer as is when nothing was shown', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('b'), line('a')]),
      );
      const store = useCartStore();
      await store.fetchCart();
      expect(ids(store)).toEqual(['b', 'a']);
    });

    it('keeps the order through a configured add', async () => {
      const store = await shownWith([line('a'), line('b')]);
      mockFetch.mockResolvedValueOnce({
        cart: cartOf('cart-123', [line('c'), line('b'), line('a')]),
        itemId: 'c',
      });
      await store.addConfiguredItem('conf-1', 100, 1);
      expect(ids(store)).toEqual(['a', 'b', 'c']);
    });

    it.each([
      [
        'applying',
        (s: ReturnType<typeof useCartStore>) => s.applyPromoCode('X'),
      ],
      ['removing', (s: ReturnType<typeof useCartStore>) => s.removePromoCode()],
    ])('keeps the order when %s a promo code', async (_label, act) => {
      const store = await shownWith([line('a'), line('b')]);
      mockFetch.mockResolvedValueOnce(
        cartOf('cart-123', [line('b'), line('a')]),
      );
      await act(store);
      expect(ids(store)).toEqual(['a', 'b']);
    });
  });
});
