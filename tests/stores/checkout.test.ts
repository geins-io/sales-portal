import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type {
  CheckoutType,
  AddressInputType,
  PaymentOptionType,
  ShippingOptionType,
  ConsentType,
  CreateOrderResponseType,
} from '#shared/types/commerce';

// Mock $fetch at module level
let mockFetchImpl: ReturnType<typeof vi.fn> = vi.fn();

vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

// Mock useCookie for cart store dependency
const mockCartIdRef = { value: 'cart-abc' };
vi.mock('#app/composables/cookie', () => ({
  useCookie: vi.fn(() => mockCartIdRef),
}));

// Import stores after mocks
const { useCheckoutStore } = await import('../../app/stores/checkout');
const { useCartStore } = await import('../../app/stores/cart');
const { useAuthStore } = await import('../../app/stores/auth');

// Mock logger used by auth store
vi.mock('~/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAddress: AddressInputType = {
  firstName: 'Jane',
  lastName: 'Doe',
  addressLine1: 'Main St 1',
  city: 'Stockholm',
  country: 'SE',
  zip: '11122',
};

const mockPaymentOptions: PaymentOptionType[] = [
  {
    id: 1,
    displayName: 'Card',
    feeIncVat: 0,
    isDefault: false,
    isSelected: false,
  },
  {
    id: 2,
    displayName: 'Invoice',
    feeIncVat: 29,
    isDefault: true,
    isSelected: false,
  },
];

const mockShippingOptions: ShippingOptionType[] = [
  {
    id: 10,
    displayName: 'Standard',
    feeIncVat: 49,
    isDefault: true,
    isSelected: false,
    amountLeftToFreeShipping: 200,
  },
  {
    id: 11,
    displayName: 'Express',
    feeIncVat: 99,
    isDefault: false,
    isSelected: false,
    amountLeftToFreeShipping: 0,
  },
];

const mockConsents: ConsentType[] = [
  {
    type: 'newsletter',
    name: 'Newsletter',
    description: 'Subscribe',
    checked: false,
    autoAccept: false,
  },
  {
    type: 'terms',
    name: 'Terms',
    description: 'Accept terms',
    checked: false,
    autoAccept: true,
  },
];

const mockCheckout: CheckoutType = {
  email: 'checkout@example.com',
  billingAddress: {
    firstName: 'Jane',
    lastName: 'Doe',
    addressLine1: 'Main St 1',
    city: 'Stockholm',
    country: 'SE',
    zip: '11122',
  },
  shippingAddress: {
    firstName: 'Jane',
    lastName: 'Doe',
    addressLine1: 'Main St 1',
    city: 'Stockholm',
    country: 'SE',
    zip: '11122',
  },
  paymentOptions: mockPaymentOptions,
  shippingOptions: mockShippingOptions,
  consents: mockConsents,
  checkoutStatus: 'OK',
};

const mockOrderResponse: CreateOrderResponseType = {
  created: true,
  orderId: 'order-999',
  publicId: 'pub-999',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCheckoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockFetchImpl = vi.fn();
    vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));
    mockCartIdRef.value = 'cart-abc';
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const store = useCheckoutStore();

      expect(store.checkout).toBeNull();
      expect(store.billingAddress).toEqual({
        firstName: '',
        lastName: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        entryCode: '',
        careOf: '',
        city: '',
        state: '',
        country: '',
        zip: '',
        company: '',
        mobile: '',
        phone: '',
      });
      expect(store.shippingAddress).toEqual({
        firstName: '',
        lastName: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        entryCode: '',
        careOf: '',
        city: '',
        state: '',
        country: '',
        zip: '',
        company: '',
        mobile: '',
        phone: '',
      });
      expect(store.useSeparateShipping).toBe(false);
      expect(store.selectedPaymentId).toBeNull();
      expect(store.selectedShippingId).toBeNull();
      expect(store.email).toBe('');
      expect(store.identityNumber).toBe('');
      expect(store.message).toBe('');
      expect(store.acceptedConsents).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.isPlacingOrder).toBe(false);
      expect(store.error).toBeNull();
      expect(store.orderResult).toBeNull();
    });
  });

  describe('fetchCheckout', () => {
    it('populates checkout data from API response', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.checkout).toEqual(mockCheckout);
      expect(mockFetchImpl).toHaveBeenCalledWith('/api/checkout', {
        query: { cartId: 'cart-abc' },
      });
    });

    it('pre-fills email from checkout response', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.email).toBe('checkout@example.com');
    });

    it('pre-fills email from auth user when checkout has no email', async () => {
      const checkoutWithoutEmail = { ...mockCheckout, email: undefined };
      mockFetchImpl.mockResolvedValueOnce(checkoutWithoutEmail);

      const authStore = useAuthStore();
      authStore.user = {
        authenticated: true,
        userId: '1',
        username: 'auth@example.com',
      };

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.email).toBe('auth@example.com');
    });

    it('auto-selects default payment option', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.selectedPaymentId).toBe(2); // isDefault: true
    });

    it('auto-selects default shipping option', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.selectedShippingId).toBe(10); // isDefault: true
    });

    it('selects first payment option when none is default', async () => {
      const checkout = {
        ...mockCheckout,
        paymentOptions: mockPaymentOptions.map((o) => ({
          ...o,
          isDefault: false,
          isSelected: false,
        })),
      };
      mockFetchImpl.mockResolvedValueOnce(checkout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.selectedPaymentId).toBe(1); // first option
    });

    it('pre-fills addresses from response', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.billingAddress.firstName).toBe('Jane');
      expect(store.billingAddress.lastName).toBe('Doe');
      expect(store.billingAddress.city).toBe('Stockholm');
    });

    it('sets error on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Network error'));

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.error).toBe('Failed to load checkout');
      expect(store.isLoading).toBe(false);
    });

    it('handles fresh checkout with no addresses', async () => {
      const freshCheckout: CheckoutType = {
        paymentOptions: mockPaymentOptions,
        shippingOptions: mockShippingOptions,
        consents: [],
        checkoutStatus: 'OK',
      };
      mockFetchImpl.mockResolvedValueOnce(freshCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.billingAddress.firstName).toBe('');
      expect(store.email).toBe('');
    });

    it('handles empty payment and shipping options', async () => {
      const checkout: CheckoutType = {
        ...mockCheckout,
        paymentOptions: [],
        shippingOptions: [],
      };
      mockFetchImpl.mockResolvedValueOnce(checkout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.selectedPaymentId).toBeNull();
      expect(store.selectedShippingId).toBeNull();
      expect(store.paymentOptions).toEqual([]);
      expect(store.shippingOptions).toEqual([]);
    });

    it('detects CUSTOMER_BLACKLISTED status', async () => {
      const checkout: CheckoutType = {
        ...mockCheckout,
        checkoutStatus: 'CUSTOMER_BLACKLISTED',
      };
      mockFetchImpl.mockResolvedValueOnce(checkout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.isBlacklisted).toBe(true);
    });

    it('auto-accepts consents with autoAccept flag', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');

      expect(store.acceptedConsents).toContain('terms');
      expect(store.acceptedConsents).not.toContain('newsletter');
    });
  });

  describe('toggleConsent', () => {
    it('adds consent type when not accepted', () => {
      const store = useCheckoutStore();
      store.toggleConsent('newsletter');

      expect(store.acceptedConsents).toContain('newsletter');
    });

    it('removes consent type when already accepted', () => {
      const store = useCheckoutStore();
      store.acceptedConsents = ['newsletter', 'terms'];
      store.toggleConsent('newsletter');

      expect(store.acceptedConsents).not.toContain('newsletter');
      expect(store.acceptedConsents).toContain('terms');
    });
  });

  describe('placeOrder', () => {
    it('sends correct body shape to API', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockOrderResponse);

      const store = useCheckoutStore();
      store.email = 'order@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;
      store.message = 'Leave at door';
      store.acceptedConsents = ['terms'];

      await store.placeOrder('cart-abc');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/checkout/create-order', {
        method: 'POST',
        body: {
          cartId: 'cart-abc',
          checkoutOptions: {
            email: 'order@example.com',
            paymentId: 2,
            shippingId: 10,
            message: 'Leave at door',
            acceptedConsents: ['terms'],
            billingAddress: mockAddress,
            shippingAddress: mockAddress,
            identityNumber: '',
          },
        },
      });
    });

    it('uses separate shipping address when enabled', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockOrderResponse);

      const separateAddress: AddressInputType = {
        firstName: 'John',
        lastName: 'Smith',
        addressLine1: 'Other St 5',
        city: 'Gothenburg',
        country: 'SE',
        zip: '41101',
      };

      const store = useCheckoutStore();
      store.email = 'order@example.com';
      store.billingAddress = { ...mockAddress };
      store.shippingAddress = { ...separateAddress };
      store.useSeparateShipping = true;
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      await store.placeOrder('cart-abc');

      const callBody = mockFetchImpl.mock.calls[0][1].body;
      expect(callBody.checkoutOptions.shippingAddress).toEqual(separateAddress);
      expect(callBody.checkoutOptions.billingAddress).toEqual(mockAddress);
    });

    it('sets orderResult on success', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockOrderResponse);

      const store = useCheckoutStore();
      store.email = 'order@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      await store.placeOrder('cart-abc');

      expect(store.orderResult).toEqual({
        orderId: 'order-999',
        publicId: 'pub-999',
      });
    });

    it('clears cart store on success', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockOrderResponse);

      const cartStore = useCartStore();
      cartStore.cart = { id: 'cart-abc' } as never;

      const store = useCheckoutStore();
      store.email = 'order@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      await store.placeOrder('cart-abc');

      expect(cartStore.cart).toBeNull();
      expect(cartStore.cartId).toBeNull();
    });

    it('sets error on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Payment failed'));

      const store = useCheckoutStore();
      store.email = 'order@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      await store.placeOrder('cart-abc');

      expect(store.error).toBe('Failed to place order');
      expect(store.isPlacingOrder).toBe(false);
      expect(store.orderResult).toBeNull();
    });
  });

  describe('canPlaceOrder', () => {
    it('is false when email is missing', () => {
      const store = useCheckoutStore();
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      expect(store.canPlaceOrder).toBe(false);
    });

    it('is false when billing address has no firstName', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, firstName: '' };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      expect(store.canPlaceOrder).toBe(false);
    });

    it('is false when no payment selected', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedShippingId = 10;

      expect(store.canPlaceOrder).toBe(false);
    });

    it('is false when no shipping selected', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;

      expect(store.canPlaceOrder).toBe(false);
    });

    it('is false when isPlacingOrder is true', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;
      store.isPlacingOrder = true;

      expect(store.canPlaceOrder).toBe(false);
    });

    it('is true when all required fields are present', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress };
      store.selectedPaymentId = 2;
      store.selectedShippingId = 10;

      expect(store.canPlaceOrder).toBe(true);
    });
  });

  describe('effectiveShippingAddress', () => {
    it('returns billing address when useSeparateShipping is false', () => {
      const store = useCheckoutStore();
      store.billingAddress = { ...mockAddress };

      expect(store.effectiveShippingAddress).toEqual(store.billingAddress);
    });

    it('returns shipping address when useSeparateShipping is true', () => {
      const separateAddress: AddressInputType = {
        firstName: 'John',
        lastName: 'Smith',
        addressLine1: 'Other St 5',
        city: 'Gothenburg',
        country: 'SE',
        zip: '41101',
      };

      const store = useCheckoutStore();
      store.billingAddress = { ...mockAddress };
      store.shippingAddress = { ...separateAddress };
      store.useSeparateShipping = true;

      expect(store.effectiveShippingAddress).toEqual(separateAddress);
    });
  });

  describe('reset', () => {
    it('clears all state back to initial values', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockCheckout);

      const store = useCheckoutStore();
      await store.fetchCheckout('cart-abc');
      store.message = 'Hello';
      store.identityNumber = '12345';

      store.reset();

      expect(store.checkout).toBeNull();
      expect(store.email).toBe('');
      expect(store.identityNumber).toBe('');
      expect(store.message).toBe('');
      expect(store.selectedPaymentId).toBeNull();
      expect(store.selectedShippingId).toBeNull();
      expect(store.acceptedConsents).toEqual([]);
      expect(store.billingAddress.firstName).toBe('');
      expect(store.useSeparateShipping).toBe(false);
      expect(store.isLoading).toBe(false);
      expect(store.isPlacingOrder).toBe(false);
      expect(store.error).toBeNull();
      expect(store.orderResult).toBeNull();
    });
  });
});
