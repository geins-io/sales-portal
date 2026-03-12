// ---------------------------------------------------------------------------
// Quote Status
// ---------------------------------------------------------------------------
export type QuoteStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

// ---------------------------------------------------------------------------
// Quote Line Item
// ---------------------------------------------------------------------------
export interface QuoteLineItem {
  productId: number;
  sku: string;
  name: string;
  articleNumber: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  totalPrice: number;
  totalPriceFormatted: string;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export interface Quote {
  id: string;
  quoteNumber: string;
  organizationId: string;
  createdBy: string;
  contactName: string;
  contactEmail: string;
  status: QuoteStatus;
  message?: string;
  internalNotes?: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  subtotalFormatted: string;
  tax: number;
  taxFormatted: string;
  total: number;
  totalFormatted: string;
  currency: string;
  paymentTerms?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Quote List Item
// ---------------------------------------------------------------------------
export interface QuoteListItem {
  id: string;
  quoteNumber: string;
  contactName: string;
  contactEmail: string;
  status: QuoteStatus;
  total: number;
  totalFormatted: string;
  currency: string;
  itemCount: number;
  createdAt: string;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Quote Inputs
// ---------------------------------------------------------------------------
export interface CreateQuoteInput {
  cartId: string;
  message?: string;
  poNumber?: string;
  paymentTerms?: string;
}

export interface AcceptQuoteInput {
  quoteId: string;
}

export interface RejectQuoteInput {
  quoteId: string;
  reason?: string;
}
