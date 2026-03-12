import type { Quote, QuoteLineItem, QuoteListItem } from '#shared/types/quote';

// ---------------------------------------------------------------------------
// Mutable in-memory state
// ---------------------------------------------------------------------------
let quotes: Quote[];
let quoteCounter = 0;

function createStubData() {
  const demoOrgId = 'demo-org';

  const lineItems1: QuoteLineItem[] = [
    {
      productId: 101,
      sku: 'DESK-OAK-L',
      name: 'Standing Desk Oak Large',
      articleNumber: 'SD-OAK-L',
      quantity: 2,
      unitPrice: 4995,
      unitPriceFormatted: '4 995 SEK',
      totalPrice: 9990,
      totalPriceFormatted: '9 990 SEK',
      imageUrl: '/media/products/standing-desk-oak.jpg',
    },
    {
      productId: 102,
      sku: 'CHAIR-ERG-BLK',
      name: 'Ergonomic Chair Black',
      articleNumber: 'CH-ERG-BLK',
      quantity: 4,
      unitPrice: 2995,
      unitPriceFormatted: '2 995 SEK',
      totalPrice: 11980,
      totalPriceFormatted: '11 980 SEK',
      imageUrl: '/media/products/ergonomic-chair-black.jpg',
    },
  ];

  const lineItems2: QuoteLineItem[] = [
    {
      productId: 201,
      sku: 'MONITOR-4K-27',
      name: '27" 4K Monitor',
      articleNumber: 'MON-4K-27',
      quantity: 5,
      unitPrice: 5999,
      unitPriceFormatted: '5 999 SEK',
      totalPrice: 29995,
      totalPriceFormatted: '29 995 SEK',
    },
  ];

  const lineItems3: QuoteLineItem[] = [
    {
      productId: 301,
      sku: 'LAPTOP-PRO-15',
      name: 'Laptop Pro 15"',
      articleNumber: 'LAP-PRO-15',
      quantity: 3,
      unitPrice: 12990,
      unitPriceFormatted: '12 990 SEK',
      totalPrice: 38970,
      totalPriceFormatted: '38 970 SEK',
    },
    {
      productId: 302,
      sku: 'DOCK-USB4',
      name: 'USB4 Docking Station',
      articleNumber: 'DOCK-USB4',
      quantity: 3,
      unitPrice: 1495,
      unitPriceFormatted: '1 495 SEK',
      totalPrice: 4485,
      totalPriceFormatted: '4 485 SEK',
    },
  ];

  quotes = [
    {
      id: crypto.randomUUID(),
      quoteNumber: 'Q-20260101001',
      organizationId: demoOrgId,
      createdBy: 'user-placer-003',
      contactName: 'Lisa Andersson',
      contactEmail: 'lisa@acmecorp.se',
      status: 'pending',
      message: 'We need these for the new Stockholm office opening in April.',
      lineItems: lineItems1,
      subtotal: 21970,
      subtotalFormatted: '21 970 SEK',
      tax: 5492,
      taxFormatted: '5 492 SEK',
      total: 27462,
      totalFormatted: '27 462 SEK',
      currency: 'SEK',
      paymentTerms: 'Net 30',
      expiresAt: '2026-04-01T00:00:00Z',
      createdAt: '2026-03-01T10:15:00Z',
      updatedAt: '2026-03-01T10:15:00Z',
    },
    {
      id: crypto.randomUUID(),
      quoteNumber: 'Q-20260115002',
      organizationId: demoOrgId,
      createdBy: 'user-admin-001',
      contactName: 'Anna Svensson',
      contactEmail: 'anna@acmecorp.se',
      status: 'accepted',
      message: 'Bulk order for Q1 hardware refresh.',
      internalNotes: 'Approved by procurement on 2026-01-20.',
      lineItems: lineItems2,
      subtotal: 29995,
      subtotalFormatted: '29 995 SEK',
      tax: 7499,
      taxFormatted: '7 499 SEK',
      total: 37494,
      totalFormatted: '37 494 SEK',
      currency: 'SEK',
      paymentTerms: 'Net 60',
      expiresAt: '2026-02-15T00:00:00Z',
      createdAt: '2026-01-15T08:30:00Z',
      updatedAt: '2026-01-20T14:00:00Z',
    },
    {
      id: crypto.randomUUID(),
      quoteNumber: 'Q-20251201003',
      organizationId: demoOrgId,
      createdBy: 'user-approver-002',
      contactName: 'Erik Johansson',
      contactEmail: 'erik@acmecorp.se',
      status: 'expired',
      message: 'Year-end laptop procurement request.',
      lineItems: lineItems3,
      subtotal: 43455,
      subtotalFormatted: '43 455 SEK',
      tax: 10864,
      taxFormatted: '10 864 SEK',
      total: 54319,
      totalFormatted: '54 319 SEK',
      currency: 'SEK',
      expiresAt: '2026-01-01T00:00:00Z',
      createdAt: '2025-12-01T09:00:00Z',
      updatedAt: '2025-12-01T09:00:00Z',
    },
  ];
}

// Initialize on module load
createStubData();

// ---------------------------------------------------------------------------
// Quote stubs
// ---------------------------------------------------------------------------

export function createQuoteStub(
  orgId: string,
  createdBy: string,
  contactName: string,
  contactEmail: string,
  lineItems: QuoteLineItem[],
  message?: string,
  _poNumber?: string,
  paymentTerms?: string,
): Quote {
  const now = new Date().toISOString();
  quoteCounter += 1;
  const suffix = `${Date.now().toString().slice(-6)}${String(quoteCounter).padStart(3, '0')}`;
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = Math.round(subtotal * 0.25);
  const total = subtotal + tax;

  const quote: Quote = {
    id: crypto.randomUUID(),
    quoteNumber: `Q-${suffix}`,
    organizationId: orgId,
    createdBy,
    contactName,
    contactEmail,
    status: 'pending',
    message,
    lineItems: lineItems.map((li) => ({ ...li })),
    subtotal,
    subtotalFormatted: `${subtotal} SEK`,
    tax,
    taxFormatted: `${tax} SEK`,
    total,
    totalFormatted: `${total} SEK`,
    currency: 'SEK',
    paymentTerms,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  quotes.push(quote);
  return { ...quote, lineItems: quote.lineItems.map((li) => ({ ...li })) };
}

export function listQuotesStub(
  _orgId: string,
  skip = 0,
  take?: number,
): { quotes: QuoteListItem[]; total: number } {
  const total = quotes.length;
  const sliced =
    take !== undefined ? quotes.slice(skip, skip + take) : quotes.slice(skip);

  const items: QuoteListItem[] = sliced.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    contactName: q.contactName,
    contactEmail: q.contactEmail,
    status: q.status,
    total: q.total,
    totalFormatted: q.totalFormatted,
    currency: q.currency,
    itemCount: q.lineItems.length,
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
  }));

  return { quotes: items, total };
}

export function getQuoteStub(quoteId: string): Quote {
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  return { ...quote, lineItems: quote.lineItems.map((li) => ({ ...li })) };
}

export function acceptQuoteStub(quoteId: string): Quote {
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  quote.status = 'accepted';
  quote.updatedAt = new Date().toISOString();
  return { ...quote, lineItems: quote.lineItems.map((li) => ({ ...li })) };
}

export function rejectQuoteStub(quoteId: string, _reason?: string): Quote {
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  quote.status = 'rejected';
  quote.updatedAt = new Date().toISOString();
  return { ...quote, lineItems: quote.lineItems.map((li) => ({ ...li })) };
}
