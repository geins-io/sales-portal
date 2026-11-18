import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
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
const { useQuotesStore, DRAFT_WRITE_TIMEOUT_MS } =
  await import('../../app/stores/quotes');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockQuoteListItem3 = makeQuoteListItem({
  id: 'q-003',
  quoteNumber: 'Q-003',
  contactName: 'Alice Brown',
  status: 'pending',
  total: 500,
  totalFormatted: '500 SEK',
  createdAt: '2026-01-03T00:00:00Z',
});

const mockQuote = makeQuote({
  quoteNumber: 'Q-001',
  createdBy: 'user-001',
  lineItems: [
    {
      productId: 1,
      id: 'line-001',
      skuId: 1,
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

      expect(store.pendingQuotes).toEqual([]);
      expect(store.pendingCount).toBe(0);
      expect(store.pendingExpiries).toEqual([]);
      expect(store.nearestPendingExpiry).toBeUndefined();
      expect(store.currentQuote).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.isActionLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  // The start page's pending quotations: one slim read, kept until a status
  // changes, then read again.
  describe('loadPending', () => {
    const overview = {
      quotes: [mockQuoteListItem3],
      total: 9,
      expiries: [
        { id: 'q-003', expiresAt: '2026-05-01T00:00:00Z' },
        { id: 'q-004', expiresAt: '2026-04-01T00:00:00Z' },
      ],
    };

    it('reads the overview and keeps its rows, count and expiries', async () => {
      mockFetchImpl.mockResolvedValueOnce(overview);

      const store = useQuotesStore();
      await store.loadPending();

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/overview');
      expect(store.pendingQuotes).toEqual([mockQuoteListItem3]);
      expect(store.pendingCount).toBe(9);
      expect(store.nearestPendingExpiry).toBe('2026-04-01T00:00:00Z');
      expect(store.isLoading).toBe(false);
    });

    it('does not read again while what it read still holds', async () => {
      mockFetchImpl.mockResolvedValueOnce(overview);

      const store = useQuotesStore();
      await store.loadPending();
      await store.loadPending();

      expect(mockFetchImpl).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'an accept',
        (store: ReturnType<typeof useQuotesStore>) =>
          store.acceptQuote('q-003'),
      ],
      [
        'a decline',
        (store: ReturnType<typeof useQuotesStore>) =>
          store.rejectQuote('q-003'),
      ],
      [
        'an order',
        (store: ReturnType<typeof useQuotesStore>) =>
          store.finalizeQuote('q-003'),
      ],
    ])('reads again after %s changed a status', async (_label, act) => {
      mockFetchImpl
        .mockResolvedValueOnce(overview)
        .mockResolvedValueOnce({ quote: mockQuote })
        .mockResolvedValueOnce({ ...overview, total: 8 });

      const store = useQuotesStore();
      await store.loadPending();
      await act(store);
      await store.loadPending();

      expect(mockFetchImpl).toHaveBeenLastCalledWith('/api/quotes/overview');
      expect(store.pendingCount).toBe(8);
    });

    it('keeps what it read when the status change fails', async () => {
      mockFetchImpl
        .mockResolvedValueOnce(overview)
        .mockRejectedValueOnce(new Error('502'));

      const store = useQuotesStore();
      await store.loadPending();
      await store.acceptQuote('q-003');
      await store.loadPending();

      expect(mockFetchImpl).toHaveBeenCalledTimes(2);
    });

    it('says so on failure, and tries again next time', async () => {
      mockFetchImpl
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(overview);

      const store = useQuotesStore();
      await store.loadPending();

      expect(store.error).toBe('portal.quotations.error_loading');
      expect(store.isLoading).toBe(false);

      await store.loadPending();

      expect(store.error).toBeNull();
      expect(store.pendingCount).toBe(9);
    });

    it('is loading while the read runs', async () => {
      let answer!: (value: typeof overview) => void;
      mockFetchImpl.mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );

      const store = useQuotesStore();
      const reading = store.loadPending();
      expect(store.isLoading).toBe(true);
      answer(overview);
      await reading;
      expect(store.isLoading).toBe(false);
    });
  });

  describe('nearestPendingExpiry', () => {
    it('is the earliest end date, leaving out the empty ones', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quotes: [],
        total: 3,
        expiries: [
          { id: 'a', expiresAt: '2026-06-01T00:00:00Z' },
          { id: 'b', expiresAt: '' },
          { id: 'c', expiresAt: '2026-05-01T00:00:00Z' },
        ],
      });

      const store = useQuotesStore();
      await store.loadPending();

      expect(store.nearestPendingExpiry).toBe('2026-05-01T00:00:00Z');
    });

    it('is none when no pending quotation has an end date', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quotes: [],
        total: 1,
        expiries: [],
      });

      const store = useQuotesStore();
      await store.loadPending();

      expect(store.nearestPendingExpiry).toBeUndefined();
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
    it("sends the buyer's message as the body", async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quote: { ...mockQuote, status: 'accepted' as const },
      });

      const store = useQuotesStore();
      await store.acceptQuote('q-001', 'Tack för offerten');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/accept', {
        method: 'POST',
        body: { message: 'Tack för offerten' },
      });
    });

    it('sends no body for an empty message', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quote: { ...mockQuote, status: 'accepted' as const },
      });

      const store = useQuotesStore();
      await store.acceptQuote('q-001', '');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/accept', {
        method: 'POST',
      });
    });

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

    it('sends the order message, trimmed', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      await store.finalizeQuote('q-001', '  Ring innan leverans \n');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/finalize', {
        method: 'POST',
        body: { message: 'Ring innan leverans' },
      });
    });

    it('sends no body without a message', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      await store.finalizeQuote('q-001', undefined);

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/finalize', {
        method: 'POST',
      });
    });

    it.each(['', '   '])(
      'sends the blank message %j as empty, which clears one written before',
      async (message) => {
        mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

        const store = useQuotesStore();
        await store.finalizeQuote('q-001', message);

        expect(mockFetchImpl).toHaveBeenCalledWith(
          '/api/quotes/q-001/finalize',
          { method: 'POST', body: { message: '' } },
        );
      },
    );

    it('returns the quote the server answered with and keeps it', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: finalized });

      const store = useQuotesStore();
      store.currentQuote = { ...mockQuote };

      expect(await store.finalizeQuote('q-001')).toEqual(finalized);
      expect(store.currentQuote?.status).toBe('finalized');
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

  describe('updateDraft', () => {
    it('starts with nothing being saved', () => {
      expect(useQuotesStore().isSaving).toBe(false);
    });

    const draft = { ...mockQuote, status: 'request_draft' as const };

    it('writes the change and answers the draft Geins holds', async () => {
      const renamed = { ...draft, name: 'Kontor plan 3' };
      mockFetchImpl.mockResolvedValueOnce({ quote: renamed });

      const store = useQuotesStore();
      const pending = store.updateDraft('q-001', { name: 'Kontor plan 3' });
      expect(store.isSaving).toBe(true);
      const result = await pending;

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/request', {
        method: 'PATCH',
        body: { name: 'Kontor plan 3' },
        timeout: DRAFT_WRITE_TIMEOUT_MS,
      });
      expect(result).toEqual(renamed);
      expect(store.isSaving).toBe(false);
      expect(store.error).toBeNull();
    });

    it('stops waiting for an answer after 20 seconds, and says the change was not saved', async () => {
      expect(DRAFT_WRITE_TIMEOUT_MS).toBe(20_000);
      // What ofetch throws when its timeout runs out.
      mockFetchImpl.mockRejectedValueOnce(
        Object.assign(
          new Error(
            '[PATCH] "/api/quotes/q-001/request": <no response> The operation was aborted due to timeout',
          ),
          { name: 'FetchError' },
        ),
      );

      const store = useQuotesStore();
      const result = await store.updateDraft('q-001', { name: 'x' });

      expect(result).toBeNull();
      expect(store.error).toBe('portal.quotations.draft.save_failed');
      expect(store.isSaving).toBe(false);
    });

    it('says the change was not saved when the write fails', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('502'));

      const store = useQuotesStore();
      const result = await store.updateDraft('q-001', {
        items: [{ id: 'line-a', skuId: 11, quantity: 3 }],
      });

      expect(result).toBeNull();
      expect(store.error).toBe('portal.quotations.draft.save_failed');
      expect(store.isSaving).toBe(false);
    });

    it('clears an earlier error when a write succeeds', async () => {
      mockFetchImpl.mockResolvedValueOnce({ quote: draft });

      const store = useQuotesStore();
      store.error = 'portal.quotations.draft.save_failed';
      await store.updateDraft('q-001', { name: 'x' });

      expect(store.error).toBeNull();
    });
  });

  describe('deleteDraft', () => {
    it('deletes the draft', async () => {
      mockFetchImpl.mockResolvedValueOnce({ deleted: true });

      const store = useQuotesStore();
      const pending = store.deleteDraft('q-001');
      expect(store.isSaving).toBe(true);
      const deleted = await pending;

      expect(mockFetchImpl).toHaveBeenLastCalledWith('/api/quotes/q-001', {
        method: 'DELETE',
        timeout: DRAFT_WRITE_TIMEOUT_MS,
      });
      expect(deleted).toBe(true);
      expect(store.isSaving).toBe(false);
    });

    it('keeps the draft and says so when the delete fails', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('502'));

      const store = useQuotesStore();
      const deleted = await store.deleteDraft('q-001');

      expect(deleted).toBe(false);
      expect(store.error).toBe('portal.quotations.draft.delete_failed');
      expect(store.isSaving).toBe(false);
    });
  });

  describe('sendQuoteRequest', () => {
    const draft = { ...mockQuote, status: 'request_draft' as const };
    const requested = { ...mockQuote, status: 'requested' as const };
    const details = {
      desiredDeliveryDate: '2026-12-01',
      customerOrderNumber: 'PO-77',
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
        customerOrderNumber: '',
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
        customerOrderNumber: undefined,
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
    it("sends the buyer's message as the body", async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quote: { ...mockQuote, status: 'rejected' as const },
      });

      const store = useQuotesStore();
      await store.rejectQuote('q-001', 'Tack för offerten');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/reject', {
        method: 'POST',
        body: { message: 'Tack för offerten' },
      });
    });

    it('sends no body for an empty message', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        quote: { ...mockQuote, status: 'rejected' as const },
      });

      const store = useQuotesStore();
      await store.rejectQuote('q-001', '');

      expect(mockFetchImpl).toHaveBeenCalledWith('/api/quotes/q-001/reject', {
        method: 'POST',
      });
    });

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

  describe('reset', () => {
    it('clears all state back to initial values', async () => {
      mockFetchImpl
        .mockResolvedValueOnce({
          quotes: [mockQuoteListItem3],
          total: 5,
          expiries: [{ id: 'q-003', expiresAt: '2026-05-01T00:00:00Z' }],
        })
        .mockResolvedValueOnce({ quotes: [], total: 0, expiries: [] });

      const store = useQuotesStore();
      await store.loadPending();
      store.currentQuote = mockQuote;
      store.error = 'Some error';
      store.lastAdd = { scope: 'page-1', outcome: { kind: 'failed' } };

      store.reset();

      expect(store.pendingQuotes).toEqual([]);
      expect(store.pendingCount).toBe(0);
      expect(store.pendingExpiries).toEqual([]);
      expect(store.nearestPendingExpiry).toBeUndefined();
      expect(store.currentQuote).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.isActionLoading).toBe(false);
      expect(store.isSaving).toBe(false);
      expect(store.error).toBeNull();
      expect(store.lastAdd).toBeNull();

      await store.loadPending();
      expect(mockFetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  describe('another buyer in the same tab', () => {
    async function heldBy(userId: string) {
      const { useAuthStore } = await import('../../app/stores/auth');
      const auth = useAuthStore();
      auth.user = { userId, username: `${userId}@example.com` };
      const store = useQuotesStore();
      await nextTick();
      mockFetchImpl.mockResolvedValueOnce({
        quotes: [mockQuoteListItem3],
        total: 1,
        expiries: [],
      });
      await store.loadPending();
      store.currentQuote = mockQuote;
      store.lastAdd = {
        scope: 'page-1',
        outcome: { kind: 'added', id: 'q-1', name: 'Etapp 2', created: true },
      };
      return { auth, store };
    }

    it("forgets the buyer's quotations and last add on sign-out", async () => {
      const { auth, store } = await heldBy('buyer-1');

      auth.user = null;
      await nextTick();

      expect(store.pendingQuotes).toEqual([]);
      expect(store.pendingCount).toBe(0);
      expect(store.currentQuote).toBeNull();
      expect(store.lastAdd).toBeNull();
    });

    it('forgets them when another buyer signs in', async () => {
      const { auth, store } = await heldBy('buyer-1');

      auth.user = { userId: 'buyer-2', username: 'buyer-2@example.com' };
      await nextTick();

      expect(store.pendingQuotes).toEqual([]);
      expect(store.lastAdd).toBeNull();
    });

    it("keeps them while the same buyer's session is read again", async () => {
      const { auth, store } = await heldBy('buyer-1');

      auth.user = { userId: 'buyer-1', username: 'buyer-1@example.com' };
      await nextTick();

      expect(store.pendingQuotes).toEqual([mockQuoteListItem3]);
      expect(store.lastAdd).not.toBeNull();
    });
  });
});
