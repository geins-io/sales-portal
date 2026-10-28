// ---------------------------------------------------------------------------
// Quote Status
// ---------------------------------------------------------------------------
export type QuoteStatus =
  | 'request_draft'
  | 'requested'
  | 'pending'
  | 'accepted'
  | 'confirmed'
  | 'finalized'
  | 'rejected'
  | 'canceled'
  | 'expired'
  | 'unknown';

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
// Quote External Reference (a quotation linked to an ERP, e.g. Monitor)
// ---------------------------------------------------------------------------
export interface QuoteExternalReference {
  system?: string;
  number?: string;
  orderNumber?: string;
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
  /** The seller confirms an accepted quotation before the order. */
  requiresConfirmation?: boolean;
  /** Set when the quotation is linked to an ERP: accepting places the order there. */
  externalReference?: QuoteExternalReference;
  /** The seller who owns the quotation. */
  seller?: { name: string; phone?: string };
  /** When the buyer accepted, once the API sets it. */
  acceptedAt?: string;
  acceptedBy?: string;
  /** Set once the quotation is finalized into an order. */
  orderId?: string;
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
