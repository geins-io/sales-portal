import type { H3Event } from 'h3';
import type {
  Quote,
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
import { createQuoteStub } from './stubs/quotes';

// ---------------------------------------------------------------------------
// GraphQL response types (raw Geins API shapes)
// ---------------------------------------------------------------------------

interface RawCartItem {
  id?: string;
  skuId?: number;
  quantity: number;
  unitPrice?: {
    sellingPriceIncVat?: number;
    sellingPriceIncVatFormatted?: string;
  };
  totalPrice?: {
    sellingPriceIncVat?: number;
    sellingPriceIncVatFormatted?: string;
  };
  product?: {
    productId?: number;
    name?: string;
    articleNumber?: string;
    productImages?: { fileName?: string }[];
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
  discount?: {
    discountIncVat?: number;
    discountIncVatFormatted?: string;
  } | null;
}

interface RawCartSummary {
  subTotal?: {
    sellingPriceIncVat?: number;
    sellingPriceIncVatFormatted?: string;
    sellingPriceExVat?: number;
    sellingPriceExVatFormatted?: string;
    vat?: number;
    vatFormatted?: string;
  };
  total?: {
    sellingPriceIncVat?: number;
    sellingPriceIncVatFormatted?: string;
  };
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
    sku: String(item.skuId ?? ''),
    name: item.product?.name ?? '',
    articleNumber: item.product?.articleNumber ?? '',
    quantity: item.quantity,
    unitPrice: item.unitPrice?.sellingPriceIncVat ?? 0,
    unitPriceFormatted: item.unitPrice?.sellingPriceIncVatFormatted ?? '',
    totalPrice: item.totalPrice?.sellingPriceIncVat ?? 0,
    totalPriceFormatted: item.totalPrice?.sellingPriceIncVatFormatted ?? '',
    imageUrl: item.product?.productImages?.[0]?.fileName ?? undefined,
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
    organizationId: q.company?.companyId ?? '',
    createdBy: q.owner?.ownerId ?? '',
    contactName,
    contactEmail,
    status: mapStatus(q.status),
    message: q.name ?? undefined,
    internalNotes: undefined,
    lineItems: items,
    subtotal: summary?.subTotal?.sellingPriceIncVat ?? 0,
    subtotalFormatted: summary?.subTotal?.sellingPriceIncVatFormatted ?? '',
    tax: summary?.subTotal?.vat ?? 0,
    taxFormatted: summary?.subTotal?.vatFormatted ?? '',
    total: summary?.total?.sellingPriceIncVat ?? 0,
    totalFormatted: summary?.total?.sellingPriceIncVatFormatted ?? '',
    currency: q.currency ?? '',
    paymentTerms: q.terms?.text ?? undefined,
    expiresAt: q.validTo ?? undefined,
    createdAt: q.createdAt ?? '',
    updatedAt: q.modifiedAt ?? '',
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
    currency: q.currency ?? '',
    itemCount: cart.items?.length ?? 0,
    createdAt: q.createdAt ?? '',
    expiresAt: q.validTo ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Quotes service
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API when create mutation is available */
export async function createQuote(
  orgId: string,
  createdBy: string,
  contactName: string,
  contactEmail: string,
  lineItems: QuoteLineItem[],
  message: string | undefined,
  poNumber: string | undefined,
  paymentTerms: string | undefined,
  _event: H3Event,
): Promise<Quote> {
  return createQuoteStub(
    orgId,
    createdBy,
    contactName,
    contactEmail,
    lineItems,
    message,
    poNumber,
    paymentTerms,
  );
}

/** List quotation carts via Geins GraphQL API */
export async function listQuotes(
  _orgId: string,
  _skip: number | undefined,
  _take: number | undefined,
  event: H3Event,
): Promise<{ quotes: QuoteListItem[]; total: number }> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('quotes/list-quotations.graphql'),
        variables: {
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: requestContext?.userToken,
      }),
    'quotes',
  );
  const carts = (unwrapGraphQL(result) as RawQuotationCart[] | null) ?? [];
  const quotes = carts.map(mapQuotationCartToListItem);
  return { quotes, total: quotes.length };
}

/** Get a single quotation cart via Geins GraphQL API */
export async function getQuote(
  quoteId: string,
  event: H3Event,
): Promise<Quote> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('quotes/get-quotation.graphql'),
        variables: {
          quotationId: quoteId,
          ...getRequestChannelVariables(sdk, event),
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

/** Accept a quotation via Geins GraphQL API */
export async function acceptQuote(
  quoteId: string,
  event: H3Event,
): Promise<Quote> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('quotes/accept-quotation.graphql'),
        variables: {
          quotationId: quoteId,
          ...getRequestChannelVariables(sdk, event),
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

/** Reject a quotation via Geins GraphQL API */
export async function rejectQuote(
  quoteId: string,
  _reason: string | undefined,
  event: H3Event,
): Promise<Quote> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('quotes/reject-quotation.graphql'),
        variables: {
          quotationId: quoteId,
          ...getRequestChannelVariables(sdk, event),
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
