import type { CartLineConfiguration, PriceType } from './commerce';

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
  /** The line's id on the quotation's cart; a kept line is sent back by it. */
  id: string;
  productId: number;
  alias?: string | null;
  /** The product page's path; a configured line opens its configurator there. */
  canonicalUrl?: string;
  skuId: number;
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
  /** Set on a configured line: what it was committed with. */
  configuration?: CartLineConfiguration;
  /** A configured line's prices, which its specification totals. */
  linePrices?: { unit?: PriceType; total?: PriceType };
  /** Not shown; sent back unchanged, so a write of the lines keeps it. */
  message?: string;
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
// Quote Payment Method (a method the order from this quotation may use)
// ---------------------------------------------------------------------------
export interface QuotePaymentMethod {
  id: string;
  name?: string;
  /** The name the buyer reads; none on quotations built before Geins had it. */
  displayName?: string;
  /** Unformatted, and the API does not say on which side of VAT. */
  fee?: number;
}

// ---------------------------------------------------------------------------
// Quote Customer (the buyer the quotation is for)
// ---------------------------------------------------------------------------
export interface QuoteCustomer {
  /** The buyer's email. */
  id?: string;
  firstName?: string;
  lastName?: string;
}

// ---------------------------------------------------------------------------
// Quote Order Details (what the order from the quotation gets)
// ---------------------------------------------------------------------------
export interface QuoteOrderDetails {
  /** The buyer's PO number */
  customerOrderNumber?: string;
  /** A calendar day, `YYYY-MM-DD` */
  desiredDeliveryDate?: string;
  goodsLabel?: string;
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
  /** The seller who owns the quotation. */
  seller?: { name: string; phone?: string };
  /** When the buyer accepted, once the API sets it. */
  acceptedAt?: string;
  acceptedBy?: string;
  /** Set once the quotation is finalized into an order. */
  orderId?: string;
  /** The order's public id, the key its page takes; only once the order is readable. */
  orderPublicId?: string;
  /** Read from the quotation's customer alone, never the seller. */
  customer?: QuoteCustomer;
  paymentMethods?: QuotePaymentMethod[];
  /** Only on the single quotation read. */
  orderDetails?: QuoteOrderDetails;
  /**
   * What the buyer sent with the request; only on the single quotation read.
   * The seller may change `orderDetails`, never this.
   */
  request?: QuoteRequestDetails;
}

// ---------------------------------------------------------------------------
// Quote List Item
// ---------------------------------------------------------------------------
export interface QuoteListItem {
  id: string;
  quoteNumber: string;
  name?: string;
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

/** The details of `UpdateQuotationRequestInputType` the request page writes. */
export interface QuoteRequestDetails {
  comment?: string;
  /** A calendar day, `YYYY-MM-DD` */
  desiredDeliveryDate?: string;
  /** The buyer's PO number, at most 30 characters */
  customerOrderNumber?: string;
  goodsLabel?: string;
}

/**
 * A line as `updateQuotationRequest` takes it. A kept line carries its `id`, a
 * configured one its `configurationId`; a line without an `id` is added.
 */
export interface QuoteRequestLine {
  id?: string;
  skuId: number;
  quantity: number;
  configurationId?: string;
  message?: string;
}

/**
 * A write to a `REQUEST_DRAFT`. `items` is the whole new list of lines: a line
 * left out is removed. Without `items` the lines stay as they are.
 */
export interface QuoteRequestUpdate extends QuoteRequestDetails {
  name?: string;
  items?: QuoteRequestLine[];
}
