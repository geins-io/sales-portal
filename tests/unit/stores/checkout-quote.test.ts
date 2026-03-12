import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

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
const { useCheckoutStore } = await import('../../../app/stores/checkout');

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

const mockAddress = {
  firstName: 'Jane',
  lastName: 'Doe',
  addressLine1: 'Main St 1',
  city: 'Stockholm',
  country: 'SE',
  zip: '11122',
};

const mockQuoteResponse = {
  quoteId: 'quote-uuid-001',
  quoteNumber: 'Q-1001',
};

// ---------------------------------------------------------------------------
// Tests: quote state extensions
// ---------------------------------------------------------------------------

describe('useCheckoutStore — quote extensions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockFetchImpl = vi.fn();
    vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));
    mockCartIdRef.value = 'cart-abc';
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('has quoteMessage as empty string', () => {
      const store = useCheckoutStore();
      expect(store.quoteMessage).toBe('');
    });

    it('has isRequestingQuote as false', () => {
      const store = useCheckoutStore();
      expect(store.isRequestingQuote).toBe(false);
    });

    it('has quoteResult as null', () => {
      const store = useCheckoutStore();
      expect(store.quoteResult).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // canRequestQuote
  // -----------------------------------------------------------------------
  describe('canRequestQuote', () => {
    it('is false when email is missing', () => {
      const store = useCheckoutStore();
      store.billingAddress = { ...mockAddress } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when billing address firstName is missing', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, firstName: '' } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when billing address lastName is missing', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, lastName: '' } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when billing address addressLine1 is missing', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, addressLine1: '' } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when billing address city is missing', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, city: '' } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when billing address country is missing', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, country: '' } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when billing address zip is missing', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress, zip: '' } as never;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when isRequestingQuote is true', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress } as never;
      store.isRequestingQuote = true;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is false when isLoading is true', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress } as never;
      store.isLoading = true;

      expect(store.canRequestQuote).toBe(false);
    });

    it('is true with only email and billing address — no payment or shipping required', () => {
      const store = useCheckoutStore();
      store.email = 'test@example.com';
      store.billingAddress = { ...mockAddress } as never;

      // Payment and shipping NOT set
      expect(store.selectedPaymentId).toBeNull();
      expect(store.selectedShippingId).toBeNull();
      expect(store.canRequestQuote).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // requestQuote action
  // -----------------------------------------------------------------------
  describe('requestQuote', () => {
    it('calls POST /api/quotes with cartId and message', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockQuoteResponse);

      const store = useCheckoutStore();
      store.email = 'buyer@example.com';
      store.billingAddress = { ...mockAddress } as never;
      store.quoteMessage = 'Please give me a discount';

      await store.requestQuote('cart-abc');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes', {
        method: 'POST',
        body: {
          cartId: 'cart-abc',
          message: 'Please give me a discount',
        },
      });
    });

    it('sets quoteResult on success', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockQuoteResponse);

      const store = useCheckoutStore();
      store.email = 'buyer@example.com';
      store.billingAddress = { ...mockAddress } as never;

      await store.requestQuote('cart-abc');

      expect(store.quoteResult).toEqual({
        quoteId: 'quote-uuid-001',
        quoteNumber: 'Q-1001',
      });
    });

    it('sets isRequestingQuote to true during request and false after', async () => {
      let capturedDuring = false;
      mockFetchImpl.mockImplementationOnce(async () => {
        capturedDuring = store.isRequestingQuote;
        return mockQuoteResponse;
      });

      const store = useCheckoutStore();
      await store.requestQuote('cart-abc');

      expect(capturedDuring).toBe(true);
      expect(store.isRequestingQuote).toBe(false);
    });

    it('sets error on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Server error'));

      const store = useCheckoutStore();
      await store.requestQuote('cart-abc');

      expect(store.error).toBe('Failed to request quote');
      expect(store.isRequestingQuote).toBe(false);
      expect(store.quoteResult).toBeNull();
    });

    it('clears error before making request', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockQuoteResponse);

      const store = useCheckoutStore();
      store.error = 'Previous error';

      await store.requestQuote('cart-abc');

      expect(store.error).toBeNull();
    });

    it('sends empty string message when quoteMessage is not set', async () => {
      mockFetchImpl.mockResolvedValueOnce(mockQuoteResponse);

      const store = useCheckoutStore();
      // quoteMessage defaults to ''

      await store.requestQuote('cart-xyz');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes', {
        method: 'POST',
        body: { cartId: 'cart-xyz', message: '' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // reset includes new quote state
  // -----------------------------------------------------------------------
  describe('reset', () => {
    it('clears quoteMessage', async () => {
      const store = useCheckoutStore();
      store.quoteMessage = 'Some message';
      store.reset();
      expect(store.quoteMessage).toBe('');
    });

    it('clears isRequestingQuote', async () => {
      const store = useCheckoutStore();
      store.isRequestingQuote = true;
      store.reset();
      expect(store.isRequestingQuote).toBe(false);
    });

    it('clears quoteResult', async () => {
      const store = useCheckoutStore();
      store.quoteResult = { quoteId: 'q-1', quoteNumber: 'Q-001' };
      store.reset();
      expect(store.quoteResult).toBeNull();
    });
  });
});
