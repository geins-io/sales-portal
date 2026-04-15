import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { makeQuote, makeQuoteListItem } from '../fixtures/quote';

// Mock $fetch at module level
let mockFetchImpl: ReturnType<typeof vi.fn> = vi.fn();

vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

// Import store after mocks
const { useQuotesStore } = await import('../../app/stores/quotes');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockQuoteListItem = makeQuoteListItem({
  id: 'q-001',
  quoteNumber: 'Q-001',
  totalFormatted: '1 500 SEK',
  createdAt: '2026-01-01T00:00:00Z',
});

const mockQuoteListItem2 = makeQuoteListItem({
  id: 'q-002',
  quoteNumber: 'Q-002',
  contactName: 'John Smith',
  contactEmail: 'john@example.com',
  status: 'accepted',
  total: 2000,
  totalFormatted: '2 000 SEK',
  itemCount: 2,
  createdAt: '2026-01-02T00:00:00Z',
});

const mockQuoteListItem3 = makeQuoteListItem({
  id: 'q-003',
  quoteNumber: 'Q-003',
  contactName: 'Alice Brown',
  contactEmail: 'alice@example.com',
  status: 'pending',
  total: 500,
  totalFormatted: '500 SEK',
  itemCount: 1,
  createdAt: '2026-01-03T00:00:00Z',
});

const mockQuote = makeQuote({
  quoteNumber: 'Q-001',
  createdBy: 'user-001',
  lineItems: [
    {
      productId: 1,
      sku: 'SKU-001',
      name: 'Test Product',
      articleNumber: 'ART-001',
      quantity: 3,
      unitPrice: 500,
      unitPriceFormatted: '500 SEK',
      totalPrice: 1500,
      totalPriceFormatted: '1 500 SEK',
    },
  ],
  subtotal: 1500,
  subtotalFormatted: '1 500 SEK',
  tax: 300,
  taxFormatted: '300 SEK',
  total: 1500,
  totalFormatted: '1 500 SEK',
  paymentTerms: undefined,
  expiresAt: undefined,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useQuotesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockFetchImpl = vi.fn();
    vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const store = useQuotesStore();

      expect(store.quotes).toEqual([]);
      expect(store.totalQuotes).toBe(0);
      expect(store.currentQuote).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.isActionLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('fetchQuotes', () => {
    it('calls GET /api/quotes and sets quotes array', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quotes: [mockQuoteListItem],
        total: 1,
      });

      const store = useQuotesStore();
      await store.fetchQuotes();

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes', {
        query: { skip: undefined, take: undefined },
      });
      expect(store.quotes).toEqual([mockQuoteListItem]);
    });

    it('sets totalQuotes from response', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quotes: [mockQuoteListItem, mockQuoteListItem2],
        total: 10,
      });

      const store = useQuotesStore();
      await store.fetchQuotes();

      expect(store.totalQuotes).toBe(10);
    });

    it('passes skip and take as query params', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quotes: [], total: 0 });

      const store = useQuotesStore();
      await store.fetchQuotes(5, 10);

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes', {
        query: { skip: 5, take: 10 },
      });
    });

    it('sets error on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Network error'));

      const store = useQuotesStore();
      await store.fetchQuotes();

      expect(store.error).toBe('portal.quotations.error_loading');
      expect(store.isLoading).toBe(false);
    });

    it('clears error before fetching', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quotes: [], total: 0 });

      const store = useQuotesStore();
      store.error = 'Previous error';
      await store.fetchQuotes();

      expect(store.error).toBeNull();
    });

    it('resets isLoading to false after success', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quotes: [], total: 0 });

      const store = useQuotesStore();
      await store.fetchQuotes();

      expect(store.isLoading).toBe(false);
    });
  });

  describe('fetchQuote', () => {
    it('calls GET /api/quotes/:id', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: mockQuote });

      const store = useQuotesStore();
      await store.fetchQuote('q-001');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001');
    });

    it('sets currentQuote from response', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: mockQuote });

      const store = useQuotesStore();
      await store.fetchQuote('q-001');

      expect(store.currentQuote).toEqual(mockQuote);
    });

    it('sets error on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Not found'));

      const store = useQuotesStore();
      await store.fetchQuote('nonexistent');

      expect(store.error).toBe('portal.quotations.load_failed');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('acceptQuote', () => {
    it('calls POST /api/quotes/:id/accept', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: acceptedQuote });

      const store = useQuotesStore();
      await store.acceptQuote('q-001');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/accept', {
        method: 'POST',
      });
    });

    it('updates currentQuote status to accepted', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: acceptedQuote });

      const store = useQuotesStore();
      store.currentQuote = { ...mockQuote };
      await store.acceptQuote('q-001');

      expect(store.currentQuote?.status).toBe('accepted');
    });

    it('updates matching quote in quotes list', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: acceptedQuote });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem }];
      await store.acceptQuote('q-001');

      expect(store.quotes[0].status).toBe('accepted');
    });

    it('sets error to the accept_failed i18n key on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Server error'));

      const store = useQuotesStore();
      await store.acceptQuote('q-001');

      expect(store.error).toBe('portal.quotations.accept_failed');
      expect(store.isActionLoading).toBe(false);
    });

    it('clears a stale error at the start of the call before retrying', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: acceptedQuote });

      const store = useQuotesStore();
      store.error = 'portal.quotations.accept_failed';
      await store.acceptQuote('q-001');

      expect(store.error).toBeNull();
    });
  });

  describe('rejectQuote', () => {
    it('calls POST /api/quotes/:id/reject without body', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: rejectedQuote });

      const store = useQuotesStore();
      await store.rejectQuote('q-001');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/reject', {
        method: 'POST',
      });
    });

    it('updates currentQuote status to rejected', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: rejectedQuote });

      const store = useQuotesStore();
      store.currentQuote = { ...mockQuote };
      await store.rejectQuote('q-001');

      expect(store.currentQuote?.status).toBe('rejected');
    });

    it('updates matching quote in quotes list', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: rejectedQuote });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem }];
      await store.rejectQuote('q-001');

      expect(store.quotes[0].status).toBe('rejected');
    });

    it('sets error to the decline_failed i18n key on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Server error'));

      const store = useQuotesStore();
      await store.rejectQuote('q-001');

      expect(store.error).toBe('portal.quotations.decline_failed');
      expect(store.isActionLoading).toBe(false);
    });

    it('clears a stale error at the start of the call before retrying', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: rejectedQuote });

      const store = useQuotesStore();
      store.error = 'portal.quotations.decline_failed';
      await store.rejectQuote('q-001');

      expect(store.error).toBeNull();
    });
  });

  describe('pendingQuotes computed', () => {
    it('filters quotes by status pending', () => {
      const store = useQuotesStore();
      store.quotes = [
        mockQuoteListItem,
        mockQuoteListItem2,
        mockQuoteListItem3,
      ];

      expect(store.pendingQuotes).toHaveLength(2);
      expect(store.pendingQuotes.every((q) => q.status === 'pending')).toBe(
        true,
      );
    });

    it('returns empty array when no pending quotes', () => {
      const store = useQuotesStore();
      store.quotes = [mockQuoteListItem2];

      expect(store.pendingQuotes).toEqual([]);
    });
  });

  describe('pendingCount computed', () => {
    it('returns count of pending quotes', () => {
      const store = useQuotesStore();
      store.quotes = [
        mockQuoteListItem,
        mockQuoteListItem2,
        mockQuoteListItem3,
      ];

      expect(store.pendingCount).toBe(2);
    });

    it('returns 0 when no quotes', () => {
      const store = useQuotesStore();

      expect(store.pendingCount).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all state back to initial values', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quotes: [mockQuoteListItem],
        total: 5,
      });

      const store = useQuotesStore();
      await store.fetchQuotes();
      store.currentQuote = mockQuote;
      store.error = 'Some error';

      store.reset();

      expect(store.quotes).toEqual([]);
      expect(store.totalQuotes).toBe(0);
      expect(store.currentQuote).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.isActionLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });
});
