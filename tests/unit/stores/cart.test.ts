import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
const { useCartStore, CONFIGURED_QUANTITY_SETTLE_MS } =
  await import('../../../app/stores/cart');

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

    it('is loading while a removal is on its way, and not after', async () => {
      mockCartIdRef.value = 'cart-123';
      const store = useCartStore();
      let loadingDuring: boolean | undefined;
      mockFetch.mockImplementationOnce(async () => {
        loadingDuring = store.isLoading;
        return { ...mockCart, items: [] };
      });

      await store.updateQuantity('item-1', 0);

      expect(loadingDuring).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('says so on the cart when a removal fails', async () => {
      mockCartIdRef.value = 'cart-123';
      const store = useCartStore();
      mockFetch.mockRejectedValueOnce(new Error('502'));

      await store.updateQuantity('item-1', 0);

      expect(store.error).toBe('Failed to update item');
      expect(store.isLoading).toBe(false);
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

  /** What `$fetch` throws for `/api/cart` answering 401 with a code. */
  function refused(code: string) {
    return Object.assign(new Error('[GET] "/api/cart": 401'), {
      statusCode: 401,
      data: { statusCode: 401, data: { code } },
    });
  }

  describe('a cart that needs the buyer signed in', () => {
    async function readRefused() {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockRejectedValueOnce(refused('CART_LOGIN_REQUIRED'));
      const store = useCartStore();
      await store.fetchCart();
      return store;
    }

    it('keeps the cart id and says sign-in is needed, not that the read failed', async () => {
      const store = await readRefused();

      expect(mockCartIdRef.value).toBe('cart-123');
      expect(store.needsSignIn).toBe(true);
      expect(store.cart).toBeNull();
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });

    it('drops the cart id on any other 401, as on any other failure', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockRejectedValueOnce(refused('UNAUTHORIZED'));
      const store = useCartStore();
      await store.fetchCart();

      expect(mockCartIdRef.value).toBeNull();
      expect(store.needsSignIn).toBe(false);
      expect(store.error).toBe('Failed to load cart');
    });

    it('drops the cart id on a failure with no code to read', async () => {
      const store = useCartStore();
      for (const failure of [
        undefined,
        Object.assign(new Error('[GET] "/api/cart": 502'), {
          data: 'Bad Gateway',
        }),
      ]) {
        mockCartIdRef.value = 'cart-123';
        mockFetch.mockRejectedValueOnce(failure);

        await store.fetchCart();

        expect(mockCartIdRef.value).toBeNull();
        expect(store.needsSignIn).toBe(false);
      }
    });

    it('is not needed once a read answers the cart', async () => {
      const store = await readRefused();
      mockFetch.mockResolvedValueOnce(mockCart);

      await store.fetchCart();

      expect(store.needsSignIn).toBe(false);
      expect(store.cart).toEqual(mockCart);
    });

    it('is not needed for another cart', async () => {
      const store = await readRefused();

      mockCartIdRef.value = 'cart-456';

      expect(store.needsSignIn).toBe(false);
    });

    it('turns an add into the sign-in prompt and sends nothing', async () => {
      const store = await readRefused();
      mockFetch.mockClear();

      await store.addItem(100, 1);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(store.isOpen).toBe(true);
      expect(store.error).toBeNull();
      expect(mockCartIdRef.value).toBe('cart-123');
    });

    it('turns a configured add into the sign-in prompt, sends nothing and fails to its caller', async () => {
      const store = await readRefused();
      mockFetch.mockClear();

      await expect(
        store.addConfiguredItem('committed-1', 1652, 1),
      ).rejects.toThrow('The cart needs the buyer signed in');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(store.isOpen).toBe(true);
      expect(store.isLoading).toBe(false);
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

  describe('replaceConfiguredItem', () => {
    const COMMITTED_ID = 'committed-2';
    const LINE = { cartId: 'cart-123', itemId: 'item-1' };

    it('puts the committed id on the line, takes the answer as the cart and opens the drawer', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch.mockResolvedValueOnce({ cart: mockCart, itemId: 'item-1' });

      const store = useCartStore();
      await expect(
        store.replaceConfiguredItem(COMMITTED_ID, LINE),
      ).resolves.toEqual(LINE);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/configurations/${COMMITTED_ID}/cart`,
        { method: 'PUT', body: LINE },
      );
      expect(store.cart).toEqual(mockCart);
      expect(store.isOpen).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('reads the cart itself when the swap went through without one', async () => {
      mockCartIdRef.value = 'cart-123';
      mockFetch
        .mockResolvedValueOnce({ cart: null, itemId: 'item-1' })
        .mockResolvedValueOnce(mockCart);

      const store = useCartStore();
      await store.replaceConfiguredItem(COMMITTED_ID, LINE);

      expect(mockFetch).toHaveBeenLastCalledWith('/api/cart', {
        query: { cartId: 'cart-123' },
      });
      expect(store.cart).toEqual(mockCart);
      expect(store.isOpen).toBe(true);
    });

    it('is loading while the swap is in flight', async () => {
      mockCartIdRef.value = 'cart-123';
      let answer!: (cart: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((settle) => {
          answer = settle;
        }),
      );

      const store = useCartStore();
      const swapping = store.replaceConfiguredItem(COMMITTED_ID, LINE);

      expect(store.isLoading).toBe(true);
      answer({ cart: mockCart, itemId: 'item-1' });
      await swapping;
      expect(store.isLoading).toBe(false);
    });

    it('throws the failure to its caller and leaves the drawer and the cart as they were', async () => {
      mockCartIdRef.value = 'cart-123';
      const failure = Object.assign(new Error('not updated'), {
        statusCode: 409,
      });
      mockFetch.mockRejectedValueOnce(failure);

      const store = useCartStore();
      await expect(
        store.replaceConfiguredItem(COMMITTED_ID, LINE),
      ).rejects.toBe(failure);

      expect(store.isOpen).toBe(false);
      expect(store.cart).toBeNull();
      expect(store.isLoading).toBe(false);
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

  describe('updateQuantity on a configured line', () => {
    const configuredLine = (id: string, quantity: number) => ({
      ...mockCart.items[0]!,
      id,
      quantity,
      configuration: { configurationId: `committed-${id}`, summary: [] },
    });
    const configuredCart = (quantity = 1) => ({
      ...mockCart,
      items: [
        mockCart.items[0]!,
        configuredLine('item-c', quantity),
        configuredLine('item-d', 1),
      ],
    });
    const puts = () =>
      mockFetch.mock.calls.filter(
        ([url, options]) =>
          url === '/api/cart/items' &&
          (options as { method?: string }).method === 'PUT',
      );

    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      return { promise, resolve, reject };
    }

    function storeWithCart() {
      mockCartIdRef.value = 'cart-123';
      const store = useCartStore();
      store.cart = configuredCart() as never;
      return store;
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sends rapid changes as one request carrying the last value, once they settle', async () => {
      const store = storeWithCart();
      mockFetch.mockResolvedValue(configuredCart(4));

      store.updateQuantity('item-c', 2);
      store.updateQuantity('item-c', 3);
      store.updateQuantity('item-c', 4);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS - 1);

      expect(puts()).toHaveLength(0);
      expect(store.pendingQuantities.get('item-c')).toBe(4);
      expect(store.isUpdatingLines).toBe(true);

      await vi.advanceTimersByTimeAsync(1);

      expect(puts()).toEqual([
        [
          '/api/cart/items',
          {
            method: 'PUT',
            body: { cartId: 'cart-123', itemId: 'item-c', quantity: 4 },
          },
        ],
      ]);
    });

    it('marks the line as updating until the answer, then shows the answered cart', async () => {
      const store = storeWithCart();
      const answer = deferred<unknown>();
      mockFetch.mockReturnValue(answer.promise);

      store.updateQuantity('item-c', 4);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);

      expect(store.updatingItems.has('item-c')).toBe(true);
      expect(store.updatingItems.has('item-d')).toBe(false);
      expect(store.isUpdatingLines).toBe(true);

      answer.resolve(configuredCart(4));
      await vi.advanceTimersByTimeAsync(0);

      expect(store.updatingItems.has('item-c')).toBe(false);
      expect(store.pendingQuantities.has('item-c')).toBe(false);
      expect(store.isUpdatingLines).toBe(false);
      expect(store.cart?.items[1]?.quantity).toBe(4);
    });

    it('starts no second change on a line while one is on its way', async () => {
      const store = storeWithCart();
      const answer = deferred<unknown>();
      mockFetch.mockReturnValue(answer.promise);

      store.updateQuantity('item-c', 4);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);
      store.updateQuantity('item-c', 7);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS * 2);

      expect(puts()).toHaveLength(1);
      expect(store.pendingQuantities.get('item-c')).toBe(4);
      answer.resolve(configuredCart(4));
      await vi.advanceTimersByTimeAsync(0);
    });

    it('settles each line on its own', async () => {
      const store = storeWithCart();
      mockFetch.mockResolvedValue(configuredCart());

      store.updateQuantity('item-c', 2);
      store.updateQuantity('item-d', 3);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);

      expect(
        puts().map(([, options]) => (options as { body: unknown }).body),
      ).toEqual([
        { cartId: 'cart-123', itemId: 'item-c', quantity: 2 },
        { cartId: 'cart-123', itemId: 'item-d', quantity: 3 },
      ]);
    });

    it('sends nothing when the changes settle back on the quantity the line has', async () => {
      const store = storeWithCart();

      store.updateQuantity('item-c', 2);
      store.updateQuantity('item-c', 1);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(store.pendingQuantities.has('item-c')).toBe(false);
      expect(store.isUpdatingLines).toBe(false);
    });

    it('marks the line as failed and shows its own quantity again when the change is refused', async () => {
      const store = storeWithCart();
      mockFetch.mockRejectedValue(new Error('422'));

      store.updateQuantity('item-c', 4);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);

      expect(store.quantityFailed.has('item-c')).toBe(true);
      expect(store.pendingQuantities.has('item-c')).toBe(false);
      expect(store.updatingItems.has('item-c')).toBe(false);
      expect(store.cart?.items[1]?.quantity).toBe(1);
      expect(store.error).toBeNull();
    });

    it("clears the line's failure on its next change", async () => {
      const store = storeWithCart();
      mockFetch.mockRejectedValueOnce(new Error('422'));
      store.updateQuantity('item-c', 4);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);

      store.updateQuantity('item-c', 5);

      expect(store.quantityFailed.has('item-c')).toBe(false);
    });

    it('sends one request when the settle ends while an earlier answer is still out', async () => {
      const store = storeWithCart();
      const answer = deferred<unknown>();
      mockFetch.mockReturnValue(answer.promise);

      store.updateQuantity('item-c', 2);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS / 2);
      store.updateQuantity('item-c', 3);
      await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS * 3);

      expect(puts()).toHaveLength(1);
      answer.resolve(configuredCart(3));
      await vi.advanceTimersByTimeAsync(0);
    });

    it.each([
      ['the line was removed', () => configuredCart()],
      ['the cart has no lines', () => ({ ...mockCart, items: null })],
      ['the cart is gone', () => null],
    ])(
      'drops the change, sending nothing, when %s before it settles',
      async (_case, cartAfter) => {
        const store = storeWithCart();
        store.updateQuantity('item-c', 4);
        const after = cartAfter();
        store.cart = (
          after && after.items
            ? { ...after, items: after.items.filter((i) => i.id !== 'item-c') }
            : after
        ) as never;

        await vi.advanceTimersByTimeAsync(CONFIGURED_QUANTITY_SETTLE_MS);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(store.pendingQuantities.has('item-c')).toBe(false);
        expect(store.isUpdatingLines).toBe(false);
      },
    );

    it('removes a configured line at once, with no wait', async () => {
      const store = storeWithCart();
      mockFetch.mockResolvedValue(configuredCart());

      await store.updateQuantity('item-c', 0);

      expect(mockFetch).toHaveBeenCalledWith('/api/cart/items', {
        method: 'DELETE',
        query: { cartId: 'cart-123', itemId: 'item-c' },
      });
    });
  });

  describe('updateQuantity on an ordinary line', () => {
    function storeWithCart(cart: unknown = mockCart) {
      mockCartIdRef.value = 'cart-123';
      const store = useCartStore();
      store.cart = cart as never;
      return store;
    }

    it('marks the line as failed rather than the whole cart', async () => {
      const store = storeWithCart();
      mockFetch.mockRejectedValueOnce(new Error('502'));

      await store.updateQuantity('item-1', 3);

      expect(store.quantityFailed.has('item-1')).toBe(true);
      expect(store.error).toBeNull();
    });

    it("clears the line's failure on its next change", async () => {
      const store = storeWithCart();
      mockFetch.mockRejectedValueOnce(new Error('502'));
      await store.updateQuantity('item-1', 3);
      mockFetch.mockResolvedValueOnce(mockCart);

      await store.updateQuantity('item-1', 4);

      expect(store.quantityFailed.has('item-1')).toBe(false);
    });

    it('clears an earlier failure banner when the quantity changes', async () => {
      const store = storeWithCart();
      store.error = 'Failed to update item';
      mockFetch.mockResolvedValueOnce(mockCart);

      await store.updateQuantity('item-1', 3);

      expect(store.error).toBeNull();
    });

    it('is loading while the change is on its way, and not after', async () => {
      const store = storeWithCart();
      let loadingDuring: boolean | undefined;
      mockFetch.mockImplementationOnce(async () => {
        loadingDuring = store.isLoading;
        return mockCart;
      });

      await store.updateQuantity('item-1', 3);

      expect(loadingDuring).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('is not loading after a failed change', async () => {
      const store = storeWithCart();
      mockFetch.mockRejectedValueOnce(new Error('502'));

      await store.updateQuantity('item-1', 3);

      expect(store.isLoading).toBe(false);
    });

    it('sends the change at once when the cart holds no lines it can read', async () => {
      const store = storeWithCart({ ...mockCart, items: null });
      mockFetch.mockResolvedValueOnce(mockCart);

      await store.updateQuantity('item-1', 3);

      expect(mockFetch).toHaveBeenCalledTimes(1);
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

  describe('addItems', () => {
    beforeEach(() => {
      mockCartIdRef.value = 'cart-123';
    });

    function postedSkus() {
      return mockFetch.mock.calls
        .filter(([url]) => url === '/api/cart/items')
        .map(([, init]) => [init.body.skuId, init.body.quantity]);
    }

    it('adds every line in order and counts what was left out', async () => {
      mockFetch.mockResolvedValue(mockCart);
      const store = useCartStore();

      await store.addItems(
        [
          { skuId: 100, quantity: 2 },
          { skuId: 200, quantity: 1 },
        ],
        1,
      );

      expect(postedSkus()).toEqual([
        [100, 2],
        [200, 1],
      ]);
      expect(store.skippedConfigurable).toBe(1);
      expect(store.isOpen).toBe(true);
    });

    it('counts nothing when nothing was left out, and opens the drawer as any add does', async () => {
      mockFetch.mockResolvedValue(mockCart);
      const store = useCartStore();

      await store.addItems([{ skuId: 100, quantity: 1 }], 0);

      expect(store.skippedConfigurable).toBe(0);
      expect(store.isOpen).toBe(true);
    });

    it('opens the drawer with the count when everything was left out', async () => {
      const store = useCartStore();

      await store.addItems([], 2);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(store.skippedConfigurable).toBe(2);
      expect(store.isOpen).toBe(true);
    });

    it('leaves the drawer closed when there was nothing to add or leave out', async () => {
      const store = useCartStore();

      await store.addItems([], 0);

      expect(store.isOpen).toBe(false);
      expect(store.skippedConfigurable).toBe(0);
    });

    it('replaces the count of an earlier bulk add', async () => {
      mockFetch.mockResolvedValue(mockCart);
      const store = useCartStore();

      await store.addItems([], 3);
      await store.addItems([{ skuId: 100, quantity: 1 }], 1);

      expect(store.skippedConfigurable).toBe(1);
    });

    describe('the count after the bulk add', () => {
      async function afterSkip() {
        const store = useCartStore();
        await store.addItems([], 2);
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(mockCart);
        return store;
      }

      it('is cleared by the next add', async () => {
        const store = await afterSkip();

        await store.addItem(100, 1);

        expect(store.skippedConfigurable).toBe(0);
      });

      it('is cleared by the next add even when it fails', async () => {
        const store = await afterSkip();
        mockFetch.mockReset();
        mockFetch.mockRejectedValue(new Error('fail'));

        await store.addItem(100, 1);

        expect(store.skippedConfigurable).toBe(0);
      });

      it('is cleared by a configured add', async () => {
        const store = await afterSkip();
        mockFetch.mockResolvedValue({ cart: mockCart, itemId: 'item-1' });

        await store.addConfiguredItem('committed-1', 1652, 1);

        expect(store.skippedConfigurable).toBe(0);
      });

      it('is kept through a quantity change and a removal', async () => {
        const store = await afterSkip();

        await store.updateQuantity('item-1', 3);
        await store.removeItem('item-1');

        expect(store.skippedConfigurable).toBe(2);
      });

      it('is cleared when the cart is replaced', async () => {
        const store = await afterSkip();

        store.cartId = null;

        expect(store.skippedConfigurable).toBe(0);
      });
    });
  });
});
