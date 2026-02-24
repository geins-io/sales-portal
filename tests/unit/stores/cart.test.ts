import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// Mock useCookie — must be done via module mock since Nuxt's auto-import resolves it
const mockCartIdRef = ref<string | null>(null);
vi.mock('#app/composables/cookie', () => ({
  useCookie: vi.fn(() => mockCartIdRef),
}));

// Mock $fetch
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

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
      expect(store.itemCount).toBe(1);
    });

    it('does nothing when no cartId', async () => {
      const store = useCartStore();
      await store.fetchCart();
      expect(mockFetch).not.toHaveBeenCalled();
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
});
