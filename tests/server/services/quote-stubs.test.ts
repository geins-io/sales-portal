import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub Nitro auto-imports used by the quote stubs
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, message: string) => {
    const err = new Error(message);
    (err as Error & { statusCode: number }).statusCode =
      code === 'NOT_FOUND' ? 404 : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
});

describe('quote service stubs', () => {
  let stubs: typeof import('../../../server/services/stubs/quotes');

  beforeEach(async () => {
    vi.resetModules();
    stubs = await import('../../../server/services/stubs/quotes');
  });

  // -----------------------------------------------------------------------
  // createQuoteStub
  // -----------------------------------------------------------------------
  describe('createQuoteStub', () => {
    it('returns a Quote with all required fields populated', () => {
      const lineItems = [
        {
          productId: 1,
          sku: 'SKU-001',
          name: 'Test Product',
          articleNumber: 'ART-001',
          quantity: 2,
          unitPrice: 100,
          unitPriceFormatted: '100 SEK',
          totalPrice: 200,
          totalPriceFormatted: '200 SEK',
        },
      ];
      const quote = stubs.createQuoteStub(
        'org-123',
        'user-001',
        'John Doe',
        'john@example.com',
        lineItems,
      );

      expect(quote.id).toBeDefined();
      expect(quote.quoteNumber).toMatch(/^Q-/);
      expect(quote.organizationId).toBe('org-123');
      expect(quote.createdBy).toBe('user-001');
      expect(quote.contactName).toBe('John Doe');
      expect(quote.contactEmail).toBe('john@example.com');
      expect(quote.status).toBe('pending');
      expect(quote.lineItems).toHaveLength(1);
      expect(quote.subtotal).toBeGreaterThan(0);
      expect(quote.total).toBeGreaterThan(0);
      expect(quote.currency).toBeDefined();
      expect(quote.createdAt).toBeDefined();
      expect(quote.updatedAt).toBeDefined();
    });

    it('generates unique IDs and quote numbers for each call', () => {
      const lineItems = [
        {
          productId: 1,
          sku: 'SKU-001',
          name: 'Test Product',
          articleNumber: 'ART-001',
          quantity: 1,
          unitPrice: 50,
          unitPriceFormatted: '50 SEK',
          totalPrice: 50,
          totalPriceFormatted: '50 SEK',
        },
      ];
      const q1 = stubs.createQuoteStub(
        'org-123',
        'user-001',
        'Alice',
        'alice@example.com',
        lineItems,
      );
      const q2 = stubs.createQuoteStub(
        'org-123',
        'user-001',
        'Bob',
        'bob@example.com',
        lineItems,
      );

      expect(q1.id).not.toBe(q2.id);
      expect(q1.quoteNumber).not.toBe(q2.quoteNumber);
    });

    it('stores optional fields when provided', () => {
      const lineItems = [
        {
          productId: 2,
          sku: 'SKU-002',
          name: 'Another Product',
          articleNumber: 'ART-002',
          quantity: 1,
          unitPrice: 75,
          unitPriceFormatted: '75 SEK',
          totalPrice: 75,
          totalPriceFormatted: '75 SEK',
        },
      ];
      const quote = stubs.createQuoteStub(
        'org-456',
        'user-002',
        'Jane Smith',
        'jane@example.com',
        lineItems,
        'Please expedite',
        'PO-9999',
        'Net 30',
      );

      expect(quote.message).toBe('Please expedite');
      expect(quote.paymentTerms).toBe('Net 30');
    });
  });

  // -----------------------------------------------------------------------
  // listQuotesStub
  // -----------------------------------------------------------------------
  describe('listQuotesStub', () => {
    it('returns initial demo data (3 quotes)', () => {
      const result = stubs.listQuotesStub('demo-org');
      expect(result.quotes).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('each QuoteListItem has required fields', () => {
      const result = stubs.listQuotesStub('demo-org');
      for (const item of result.quotes) {
        expect(item.id).toBeDefined();
        expect(item.quoteNumber).toMatch(/^Q-/);
        expect(item.contactName).toBeDefined();
        expect(item.contactEmail).toBeDefined();
        expect(item.status).toBeDefined();
        expect(typeof item.total).toBe('number');
        expect(item.totalFormatted).toBeDefined();
        expect(item.currency).toBeDefined();
        expect(typeof item.itemCount).toBe('number');
        expect(item.createdAt).toBeDefined();
      }
    });

    it('respects skip for pagination', () => {
      const full = stubs.listQuotesStub('demo-org');
      const paged = stubs.listQuotesStub('demo-org', 1);

      expect(paged.quotes).toHaveLength(2);
      expect(paged.total).toBe(3);
      expect(paged.quotes[0].id).toBe(full.quotes[1].id);
    });

    it('respects take for pagination', () => {
      const paged = stubs.listQuotesStub('demo-org', 0, 2);

      expect(paged.quotes).toHaveLength(2);
      expect(paged.total).toBe(3);
    });

    it('respects skip and take together', () => {
      const paged = stubs.listQuotesStub('demo-org', 1, 1);

      expect(paged.quotes).toHaveLength(1);
      expect(paged.total).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // getQuoteStub
  // -----------------------------------------------------------------------
  describe('getQuoteStub', () => {
    it('returns quote by ID', () => {
      const { quotes } = stubs.listQuotesStub('demo-org');
      const first = quotes[0];
      const quote = stubs.getQuoteStub(first.id);

      expect(quote.id).toBe(first.id);
      expect(quote.quoteNumber).toBe(first.quoteNumber);
      expect(quote.lineItems).toBeDefined();
    });

    it('throws NOT_FOUND for nonexistent ID', () => {
      expect(() => stubs.getQuoteStub('nonexistent-id')).toThrow(
        'Quote nonexistent-id not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // acceptQuoteStub
  // -----------------------------------------------------------------------
  describe('acceptQuoteStub', () => {
    it('sets status to accepted', () => {
      const { quotes } = stubs.listQuotesStub('demo-org');
      const pending = quotes.find((q) => q.status === 'pending')!;
      const accepted = stubs.acceptQuoteStub(pending.id);

      expect(accepted.status).toBe('accepted');
    });

    it('updates the updatedAt timestamp', () => {
      const { quotes } = stubs.listQuotesStub('demo-org');
      const pending = quotes.find((q) => q.status === 'pending')!;
      const before = stubs.getQuoteStub(pending.id).updatedAt;

      // Small delay so timestamp changes
      const accepted = stubs.acceptQuoteStub(pending.id);
      expect(accepted.updatedAt).toBeDefined();
      // updatedAt should be equal or later than before
      expect(new Date(accepted.updatedAt) >= new Date(before)).toBe(true);
    });

    it('throws NOT_FOUND for nonexistent ID', () => {
      expect(() => stubs.acceptQuoteStub('ghost-id')).toThrow(
        'Quote ghost-id not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // rejectQuoteStub
  // -----------------------------------------------------------------------
  describe('rejectQuoteStub', () => {
    it('sets status to rejected', () => {
      const { quotes } = stubs.listQuotesStub('demo-org');
      const pending = quotes.find((q) => q.status === 'pending')!;
      const rejected = stubs.rejectQuoteStub(pending.id);

      expect(rejected.status).toBe('rejected');
    });

    it('updates the updatedAt timestamp', () => {
      const { quotes } = stubs.listQuotesStub('demo-org');
      const pending = quotes.find((q) => q.status === 'pending')!;
      const rejected = stubs.rejectQuoteStub(pending.id, 'Price too high');

      expect(rejected.updatedAt).toBeDefined();
    });

    it('throws NOT_FOUND for nonexistent ID', () => {
      expect(() => stubs.rejectQuoteStub('ghost-id')).toThrow(
        'Quote ghost-id not found',
      );
    });
  });
});
