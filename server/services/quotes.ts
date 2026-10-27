import type { H3Event } from 'h3';
import type {
  Quote,
  QuoteAddress,
  QuoteCompany,
  QuoteLineItem,
  QuoteListItem,
  QuoteStatus,
} from '#shared/types/quote';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

// ---------------------------------------------------------------------------
// GraphQL response types (raw Geins API shapes)
// ---------------------------------------------------------------------------

interface RawPrice {
  sellingPriceIncVat?: number;
  sellingPriceIncVatFormatted?: string;
  sellingPriceExVat?: number;
  sellingPriceExVatFormatted?: string;
}

interface RawCartItem {
  id?: string;
  skuId?: number;
  quantity: number;
  unitPrice?: RawPrice;
  totalPrice?: RawPrice;
  product?: {
    productId?: number;
    alias?: string;
    name?: string;
    articleNumber?: string;
    productImages?: { fileName?: string; url?: string | null }[];
  };
}

interface RawQuotation {
  quotationNumber?: string;
  name?: string;
  currency?: string;
  marketId?: string;
  channelId?: string;
  status?: string;
  createdAt?: string;
  modifiedAt?: string;
  validFrom?: string;
  validTo?: string;
  company?: { companyId?: string; name?: string; vatNumber?: string };
  owner?: {
    ownerId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  customer?: {
    customerId?: string;
    internalCustomerId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    approvedAt?: string | null;
    rejectedAt?: string | null;
  };
  terms?: { text?: string };
  billingAddress?: {
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
  };
  shippingAddress?: {
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
  } | null;
  orderId?: string | null;
  /** The seller's discount; the amount it comes to is on the cart summary. */
  discount?: {
    type?: string | null;
    value?: number | null;
  } | null;
}

interface RawCartSummary {
  subTotal?: RawPrice & {
    vat?: number;
    vatFormatted?: string;
  };
  shipping?: {
    feeIncVat?: number;
    feeIncVatFormatted?: string;
    feeExVat?: number;
    feeExVatFormatted?: string;
  };
  total?: RawPrice & {
    vat?: number;
    vatFormatted?: string;
  };
  fixedAmountDiscountIncVat?: number;
  fixedAmountDiscountExVat?: number;
}

interface RawQuotationCart {
  id: string;
  items?: RawCartItem[];
  summary?: RawCartSummary;
  quotation?: RawQuotation;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const QUOTATION_STATUS_MAP: Record<string, QuoteStatus> = {
  DRAFT: 'pending',
  PENDING: 'pending',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
  ACCEPTED: 'accepted',
  CONFIRMED: 'accepted',
  FINALIZED: 'accepted',
  CANCELED: 'cancelled',
};

function mapStatus(raw?: string): QuoteStatus {
  if (!raw) return 'pending';
  return QUOTATION_STATUS_MAP[raw] ?? 'pending';
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function mapLineItem(item: RawCartItem): QuoteLineItem {
  return {
    productId: item.product?.productId ?? 0,
    alias: item.product?.alias ?? null,
    sku: String(item.skuId ?? ''),
    name: item.product?.name ?? '',
    articleNumber: item.product?.articleNumber ?? '',
    quantity: item.quantity,
    unitPrice: item.unitPrice?.sellingPriceIncVat ?? 0,
    unitPriceFormatted: item.unitPrice?.sellingPriceIncVatFormatted ?? '',
    totalPrice: item.totalPrice?.sellingPriceIncVat ?? 0,
    totalPriceFormatted: item.totalPrice?.sellingPriceIncVatFormatted ?? '',
    unitPriceExVat: item.unitPrice?.sellingPriceExVat ?? 0,
    unitPriceExVatFormatted: item.unitPrice?.sellingPriceExVatFormatted ?? '',
    totalPriceExVat: item.totalPrice?.sellingPriceExVat ?? 0,
    totalPriceExVatFormatted: item.totalPrice?.sellingPriceExVatFormatted ?? '',
    imageFileName: item.product?.productImages?.[0]?.fileName ?? undefined,
    imageUrl: item.product?.productImages?.[0]?.url ?? null,
  };
}

function mapAddress(
  a: NonNullable<RawQuotation['billingAddress']>,
): QuoteAddress {
  return {
    email: a.email ?? undefined,
    phone: a.phone ?? undefined,
    company: a.company ?? undefined,
    firstName: a.firstName ?? undefined,
    lastName: a.lastName ?? undefined,
    addressLine1: a.addressLine1 ?? undefined,
    addressLine2: a.addressLine2 ?? undefined,
    addressLine3: a.addressLine3 ?? undefined,
    zip: a.zip ?? undefined,
    city: a.city ?? undefined,
    region: a.region ?? undefined,
    country: a.country ?? undefined,
  };
}

function mapCompany(c: NonNullable<RawQuotation['company']>): QuoteCompany {
  return {
    companyId: c.companyId ?? undefined,
    name: c.name ?? undefined,
    vatNumber: c.vatNumber ?? undefined,
  };
}

function mapQuotationCartToQuote(cart: RawQuotationCart): Quote {
  const q = cart.quotation ?? {};
  const summary = cart.summary;
  const items = (cart.items ?? []).map(mapLineItem);

  const contactFirstName = q.customer?.firstName ?? q.owner?.firstName ?? '';
  const contactLastName = q.customer?.lastName ?? q.owner?.lastName ?? '';
  const contactName = `${contactFirstName} ${contactLastName}`.trim();
  const contactEmail = q.billingAddress?.email ?? '';

  return {
    id: cart.id,
    quoteNumber: q.quotationNumber ?? '',
    createdBy: q.owner?.ownerId ?? '',
    contactName,
    contactEmail,
    status: mapStatus(q.status),
    name: q.name ?? undefined,
    internalNotes: undefined,
    lineItems: items,
    subtotal: summary?.subTotal?.sellingPriceIncVat ?? 0,
    subtotalFormatted: summary?.subTotal?.sellingPriceIncVatFormatted ?? '',
    // The total's VAT, as the order view reads it: the subtotal's leaves out
    // the shipping and the discount.
    tax: summary?.total?.vat ?? 0,
    taxFormatted: summary?.total?.vatFormatted ?? '',
    shipping: summary?.shipping?.feeIncVat ?? 0,
    shippingFormatted: summary?.shipping?.feeIncVatFormatted ?? '',
    total: summary?.total?.sellingPriceIncVat ?? 0,
    totalFormatted: summary?.total?.sellingPriceIncVatFormatted ?? '',
    subtotalExVat: summary?.subTotal?.sellingPriceExVat ?? 0,
    subtotalExVatFormatted: summary?.subTotal?.sellingPriceExVatFormatted ?? '',
    shippingExVat: summary?.shipping?.feeExVat ?? 0,
    shippingExVatFormatted: summary?.shipping?.feeExVatFormatted ?? '',
    totalExVat: summary?.total?.sellingPriceExVat ?? 0,
    totalExVatFormatted: summary?.total?.sellingPriceExVatFormatted ?? '',
    discount: summary?.fixedAmountDiscountIncVat ?? 0,
    discountExVat: summary?.fixedAmountDiscountExVat ?? 0,
    discountPercent:
      q.discount?.type === 'Percent'
        ? (q.discount.value ?? undefined)
        : undefined,
    currency: q.currency ?? '',
    paymentTerms: q.terms?.text ?? undefined,
    expiresAt: q.validTo ?? undefined,
    createdAt: q.createdAt ?? '',
    updatedAt: q.modifiedAt ?? '',
    billingAddress: q.billingAddress ? mapAddress(q.billingAddress) : undefined,
    shippingAddress: q.shippingAddress
      ? mapAddress(q.shippingAddress)
      : undefined,
    company: q.company ? mapCompany(q.company) : undefined,
  };
}

function mapQuotationCartToListItem(cart: RawQuotationCart): QuoteListItem {
  const q = cart.quotation ?? {};
  const contactFirstName = q.customer?.firstName ?? q.owner?.firstName ?? '';
  const contactLastName = q.customer?.lastName ?? q.owner?.lastName ?? '';

  return {
    id: cart.id,
    quoteNumber: q.quotationNumber ?? '',
    contactName: `${contactFirstName} ${contactLastName}`.trim(),
    contactEmail: q.billingAddress?.email ?? '',
    status: mapStatus(q.status),
    total: cart.summary?.total?.sellingPriceIncVat ?? 0,
    totalFormatted: cart.summary?.total?.sellingPriceIncVatFormatted ?? '',
    totalExVat: cart.summary?.total?.sellingPriceExVat ?? 0,
    totalExVatFormatted: cart.summary?.total?.sellingPriceExVatFormatted ?? '',
    currency: q.currency ?? '',
    itemCount: cart.items?.length ?? 0,
    createdAt: q.createdAt ?? '',
    expiresAt: q.validTo ?? undefined,
  };
}

/**
 * Sort key for ordering quotes newest-first. Returns the createdAt timestamp in
 * milliseconds, or 0 for an empty or unparseable date so those rows sort last.
 */
function quoteCreatedTime(quote: QuoteListItem): number {
  const time = Date.parse(quote.createdAt ?? '');
  return Number.isNaN(time) ? 0 : time;
}

// ---------------------------------------------------------------------------
// Quotes service
// ---------------------------------------------------------------------------

/** List quotation carts via Geins GraphQL API */
export async function listQuotes(
  _orgId: string,
  _skip: number | undefined,
  _take: number | undefined,
  event: H3Event,
): Promise<{ quotes: QuoteListItem[]; total: number }> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  // Quotation queries use languageId only — NOT channelId/marketId.
  // Studio stores channelId as "1" but getRequestChannelVariables produces "1|se",
  // which causes a filter mismatch and hides quotes from the buyer.
  // Quotes are already user-scoped via the auth token.
  const { languageId } = getRequestChannelVariables(sdk, event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('quotes/list-quotations.graphql'),
        variables: { languageId },
        userToken: requestContext?.userToken,
      }),
    'quotes',
  );
  const carts = (unwrapGraphQL(result) as RawQuotationCart[] | null) ?? [];
  const quotes = carts.map(mapQuotationCartToListItem);
  // Newest first. The Geins API returns carts in an unspecified order, so sort
  // by createdAt descending. Empty or unparseable dates sort last (epoch 0).
  quotes.sort((a, b) => quoteCreatedTime(b) - quoteCreatedTime(a));
  return { quotes, total: quotes.length };
}

/** Get a single quotation cart via Geins GraphQL API */
export async function getQuote(
  quoteId: string,
  event: H3Event,
): Promise<Quote> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const { languageId } = getRequestChannelVariables(sdk, event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('quotes/get-quotation.graphql'),
        variables: {
          quotationId: quoteId,
          languageId,
        },
        userToken: requestContext?.userToken,
      }),
    'quotes',
  );
  const cart = unwrapGraphQL(result) as RawQuotationCart | null;
  if (!cart) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  return mapQuotationCartToQuote(cart);
}

/**
 * Answer a quotation. Geins answers the mutation with a Boolean, so the
 * quotation is read again for its new status.
 */
async function respondToQuote(
  queryFile: string,
  quoteId: string,
  event: H3Event,
): Promise<Quote> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const { languageId } = getRequestChannelVariables(sdk, event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery(queryFile),
        variables: {
          quotationId: quoteId,
          languageId,
        },
        userToken: requestContext?.userToken,
        // No timeout: a quote Geins accepts after a cut would read as failed.
        requestOptions: { context: { timeoutMs: 0 } },
      }),
    'quotes',
  );
  if (unwrapGraphQL(result) !== true) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `Geins answered false or nothing for quote ${quoteId}`,
    );
  }
  return getQuote(quoteId, event);
}

/** Accept a quotation via Geins GraphQL API */
export function acceptQuote(quoteId: string, event: H3Event): Promise<Quote> {
  return respondToQuote('quotes/accept-quotation.graphql', quoteId, event);
}

/** Reject a quotation via Geins GraphQL API */
export function rejectQuote(quoteId: string, event: H3Event): Promise<Quote> {
  return respondToQuote('quotes/reject-quotation.graphql', quoteId, event);
}
