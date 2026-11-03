import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { makeQuote, makeQuoteListItem } from '../fixtures/quote';

// Mock $fetch at module level
let mockFetchImpl = vi.fn();

vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

// The reads go through the SSR-aware internalFetch helper; same mock.
vi.mock('~/utils/internal-fetch', () => ({
  internalFetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

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
      unitPriceExVat: 0,
      unitPriceExVatFormatted: '',
      totalPriceExVat: 0,
      totalPriceExVatFormatted: '',
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

      expect(store.quotes[0]?.status).toBe('accepted');
    });

    it('updates only the answered quote in a longer list', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: acceptedQuote });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem3 }, { ...mockQuoteListItem }];
      await store.acceptQuote('q-001');

      expect(store.quotes.map((q) => q.status)).toEqual([
        'pending',
        'accepted',
      ]);
    });

    it('is loading while the request runs', async () => {
      let answer!: (value: { quote: typeof mockQuote }) => void;
      mockFetchImpl.mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );

      const store = useQuotesStore();
      const pending = store.acceptQuote('q-001');

      expect(store.isActionLoading).toBe(true);
      answer({ quote: { ...mockQuote, status: 'accepted' } });
      await pending;
      expect(store.isActionLoading).toBe(false);
    });

    it('returns the quote the server answered with', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: acceptedQuote });

      const store = useQuotesStore();

      expect(await store.acceptQuote('q-001')).toEqual(acceptedQuote);
    });

    it('returns null on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Server error'));

      const store = useQuotesStore();

      expect(await store.acceptQuote('q-001')).toBeNull();
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

  describe('finalizeQuote', () => {
    const finalized = {
      ...mockQuote,
      status: 'finalized' as const,
    };

    it('calls POST /api/quotes/:id/finalize', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      await store.finalizeQuote('q-001');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/finalize', {
        method: 'POST',
      });
    });

    it('returns the quote the server answered with and keeps it', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      store.currentQuote = { ...mockQuote };

      expect(await store.finalizeQuote('q-001')).toEqual(finalized);
      expect(store.currentQuote?.status).toBe('finalized');
    });

    it('updates only the finalized quote in the list', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem3 }, { ...mockQuoteListItem }];
      await store.finalizeQuote('q-001');

      expect(store.quotes.map((q) => q.status)).toEqual([
        'pending',
        'finalized',
      ]);
    });

    it('updates the finalized quote when it is first in the list', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem }, { ...mockQuoteListItem3 }];
      await store.finalizeQuote('q-001');

      expect(store.quotes.map((q) => q.status)).toEqual([
        'finalized',
        'pending',
      ]);
    });

    it('leaves the list alone when the quote is not in it', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem3 }];
      await store.finalizeQuote('q-001');

      expect(Object.keys(store.quotes)).toEqual(['0']);
      expect(store.quotes[0]?.status).toBe('pending');
    });

    it('is loading while the request runs', async () => {
      let answer!: (value: { quote: typeof finalized }) => void;
      mockFetchImpl.mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );

      const store = useQuotesStore();
      const pending = store.finalizeQuote('q-001');

      expect(store.isActionLoading).toBe(true);
      answer({ quote: finalized });
      await pending;
      expect(store.isActionLoading).toBe(false);
    });

    it('returns null and sets the order_failed key on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Server error'));

      const store = useQuotesStore();
      store.currentQuote = { ...mockQuote };

      expect(await store.finalizeQuote('q-001')).toBeNull();
      expect(store.error).toBe('portal.quotations.order.failed');
      expect(store.isActionLoading).toBe(false);
      expect(store.currentQuote?.status).toBe(mockQuote.status);
    });

    it('clears a stale error at the start of the call', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      store.error = 'portal.quotations.order.failed';
      await store.finalizeQuote('q-001');

      expect(store.error).toBeNull();
    });
  });

  describe('sendQuoteRequest', () => {
    const draft = { ...mockQuote, status: 'request_draft' as const };
    const requested = { ...mockQuote, status: 'requested' as const };
    const details = {
      desiredDeliveryDate: '2026-12-01',
      customerReference: 'PO-77',
      comment: 'Leverans till lager 2',
    };

    it('writes the details, then releases the request', async () => {
      mockFetchImpl
        .mockResolvedValueOnce({ quote: draft })
        .mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      await store.sendQuoteRequest('q-001', details);

      expect(mockFetchImpl.mock.calls).toEqual([
        ['/api/quotes/q-001/request', { method: 'PATCH', body: details }],
        ['/api/quotes/q-001/release', { method: 'POST' }],
      ]);
    });

    it('releases without writing when there are no details', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      await store.sendQuoteRequest('q-001', {});

      expect(mockFetchImpl.mock.calls).toEqual([
        ['/api/quotes/q-001/release', { method: 'POST' }],
      ]);
    });

    it('drops empty details, and releases without writing when none are left', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      await store.sendQuoteRequest('q-001', {
        comment: undefined,
        customerReference: '',
        desiredDeliveryDate: undefined,
      });

      expect(mockFetchImpl.mock.calls).toEqual([
        ['/api/quotes/q-001/release', { method: 'POST' }],
      ]);
    });

    it('writes a single detail on its own', async () => {
      mockFetchImpl
        .mockResolvedValueOnce({ quote: draft })
        .mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      await store.sendQuoteRequest('q-001', {
        comment: 'Hej',
        customerReference: undefined,
      });

      expect(mockFetchImpl.mock.calls[0]).toEqual([
        '/api/quotes/q-001/request',
        { method: 'PATCH', body: { comment: 'Hej' } },
      ]);
    });

    it('returns the released quote and keeps it', async () => {
      mockFetchImpl
        .mockResolvedValueOnce({ quote: draft })
        .mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      store.currentQuote = { ...draft };

      expect(await store.sendQuoteRequest('q-001', details)).toEqual(requested);
      expect(store.currentQuote?.status).toBe('requested');
    });

    it('updates the sent quote in the list', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      store.quotes = [
        { ...mockQuoteListItem3 },
        { ...mockQuoteListItem, status: 'request_draft' },
      ];
      await store.sendQuoteRequest('q-001', {});

      expect(store.quotes.map((q) => q.status)).toEqual([
        'pending',
        'requested',
      ]);
    });

    it('updates the sent quote when it is first in the list', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      store.quotes = [
        { ...mockQuoteListItem, status: 'request_draft' },
        { ...mockQuoteListItem3 },
      ];
      await store.sendQuoteRequest('q-001', {});

      expect(store.quotes.map((q) => q.status)).toEqual([
        'requested',
        'pending',
      ]);
    });

    it('leaves the list alone when the sent quote is not in it', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem3 }];
      await store.sendQuoteRequest('q-001', {});

      expect(Object.keys(store.quotes)).toEqual(['0']);
      expect(store.quotes[0]?.status).toBe('pending');
    });

    it('does not release when writing the details fails', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('400'));

      const store = useQuotesStore();
      expect(await store.sendQuoteRequest('q-001', details)).toBeNull();

      expect(mockFetchImpl).toHaveBeenCalledTimes(1);
      expect(store.error).toBe('portal.quotations.request.send_failed');
      expect(store.isActionLoading).toBe(false);
    });

    it('returns null and keeps the quote when the release fails', async () => {
      mockFetchImpl
        .mockResolvedValueOnce({ quote: draft })
        .mockRejectedValueOnce(new Error('500'));

      const store = useQuotesStore();
      store.currentQuote = { ...draft };

      expect(await store.sendQuoteRequest('q-001', details)).toBeNull();
      expect(store.error).toBe('portal.quotations.request.send_failed');
      expect(store.currentQuote?.status).toBe('request_draft');
      expect(store.isActionLoading).toBe(false);
    });

    it('is loading while the request runs', async () => {
      let answer!: (value: { quote: typeof requested }) => void;
      mockFetchImpl.mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );

      const store = useQuotesStore();
      const pending = store.sendQuoteRequest('q-001', {});

      expect(store.isActionLoading).toBe(true);
      answer({ quote: requested });
      await pending;
      expect(store.isActionLoading).toBe(false);
    });

    it('clears a stale error at the start of the call', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: requested });

      const store = useQuotesStore();
      store.error = 'portal.quotations.request.send_failed';
      await store.sendQuoteRequest('q-001', {});

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

      expect(store.quotes[0]?.status).toBe('rejected');
    });

    it('updates only the answered quote in a longer list', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: rejectedQuote });

      const store = useQuotesStore();
      store.quotes = [{ ...mockQuoteListItem3 }, { ...mockQuoteListItem }];
      await store.rejectQuote('q-001');

      expect(store.quotes.map((q) => q.status)).toEqual([
        'pending',
        'rejected',
      ]);
    });

    it('is loading while the request runs', async () => {
      let answer!: (value: { quote: typeof mockQuote }) => void;
      mockFetchImpl.mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );

      const store = useQuotesStore();
      const pending = store.rejectQuote('q-001');

      expect(store.isActionLoading).toBe(true);
      answer({ quote: { ...mockQuote, status: 'rejected' } });
      await pending;
      expect(store.isActionLoading).toBe(false);
    });

    it('returns the quote the server answered with', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      mockFetchImpl.mockResolvedValueOnce({ quote: rejectedQuote });

      const store = useQuotesStore();

      expect(await store.rejectQuote('q-001')).toEqual(rejectedQuote);
    });

    it('returns null on failure', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Server error'));

      const store = useQuotesStore();

      expect(await store.rejectQuote('q-001')).toBeNull();
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

    it('leaves out requests still with the seller', () => {
      const store = useQuotesStore();
      store.quotes = [
        makeQuoteListItem({ id: 'q-draft', status: 'request_draft' }),
        makeQuoteListItem({ id: 'q-requested', status: 'requested' }),
        makeQuoteListItem({ id: 'q-unknown', status: 'unknown' }),
        mockQuoteListItem3,
      ];

      expect(store.pendingQuotes.map((q) => q.id)).toEqual(['q-003']);
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
