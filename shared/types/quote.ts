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
  alias?: string | null;
  sku: string;
  name: string;
  articleNumber: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  totalPrice: number;
  totalPriceFormatted: string;
  unitPriceExVat: number;
  unitPriceExVatFormatted: string;
  totalPriceExVat: number;
  totalPriceExVatFormatted: string;
  imageFileName?: string;
  imageUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Quote Address (billing / shipping)
// ---------------------------------------------------------------------------
export interface QuoteAddress {
  email?: string;
  phone?: string;
  company?: string;
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  zip?: string;
  city?: string;
  region?: string;
  country?: string;
}

// ---------------------------------------------------------------------------
// Quote Company
// ---------------------------------------------------------------------------
export interface QuoteCompany {
  companyId?: string;
  name?: string;
  vatNumber?: string;
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export interface Quote {
  id: string;
  quoteNumber: string;
  createdBy: string;
  contactName: string;
  contactEmail: string;
  status: QuoteStatus;
  name?: string;
  internalNotes?: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  subtotalFormatted: string;
  tax: number;
  taxFormatted: string;
  shipping: number;
  shippingFormatted: string;
  total: number;
  totalFormatted: string;
  subtotalExVat: number;
  subtotalExVatFormatted: string;
  shippingExVat: number;
  shippingExVatFormatted: string;
  totalExVat: number;
  totalExVatFormatted: string;
  /** The seller's discount as a positive amount; 0 without one. Not formatted by the API. */
  discount?: number;
  discountExVat?: number;
  /** The rate, only when the seller gave the discount as a percent. */
  discountPercent?: number;
  currency: string;
  paymentTerms?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  billingAddress?: QuoteAddress;
  shippingAddress?: QuoteAddress;
  company?: QuoteCompany;
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
  totalExVat: number;
  totalExVatFormatted: string;
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
