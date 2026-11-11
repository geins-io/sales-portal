import type { H3Event } from 'h3';
import type { CartItemConfigurationType } from '@geins/types';
import type { PriceType } from '#shared/types/commerce';
import type {
  Quote,
  QuoteAddress,
  QuoteCompany,
  QuoteCustomer,
  QuoteLineItem,
  QuoteListItem,
  QuoteOrderDetails,
  QuotePaymentMethod,
  QuoteRequestDetails,
  QuoteRequestLine,
  QuoteRequestUpdate,
  QuoteStatus,
} from '#shared/types/quote';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { findOrderPublicId } from './orders';
import { cartLineConfiguration } from './line-configuration';
import { amountWriter } from './amount';
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
  message?: string | null;
  unitPrice?: PriceType;
  totalPrice?: PriceType;
  configurationId?: string | null;
  configuration?: Pick<
    CartItemConfigurationType,
    'summary' | 'sections'
  > | null;
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
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  customer?: {
    customerId?: string;
    internalCustomerId?: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
  };
  terms?: { text?: string };
  settings?: { requireConfirmation?: boolean | null } | null;
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
  orderPublicId?: string | null;
  validPaymentMethods?:
    | {
        paymentId?: string | null;
        name?: string | null;
        displayName?: string | null;
        paymentFee?: number | null;
      }[]
    | null;
  orderDetails?: RawOrderDetails | null;
  request?: RawQuotationRequest | null;
  /** The seller's discount; the amount it comes to is on the cart summary. */
  discount?: {
    type?: string | null;
    value?: number | null;
  } | null;
}

/** `QuotationOrderDetailsType`, and the same fields of `QuotationRequestType` */
interface RawOrderDetails {
  customerOrderNumber?: string | null;
  customerReference?: string | null;
  desiredDeliveryDate?: string | null;
  goodsLabel?: string | null;
}

/** `QuotationRequestType`: what the buyer sent */
interface RawQuotationRequest extends RawOrderDetails {
  comment?: string | null;
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

// The request mutations' inputs; `@geins/types` does not have them yet.

/** `CreateQuotationRequestInputType` */
interface RawCreateQuotationRequestInput {
  cartId: string;
  name: string;
  draft: boolean;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

// DRAFT is the seller's unsent draft and never reaches the buyer, so it is
// left to `unknown` with anything else the API may add.
const QUOTATION_STATUS_MAP: Record<string, QuoteStatus> = {
  REQUEST_DRAFT: 'request_draft',
  REQUESTED: 'requested',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  CONFIRMED: 'confirmed',
  FINALIZED: 'finalized',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
};

function mapStatus(raw?: string): QuoteStatus {
  return (raw && QUOTATION_STATUS_MAP[raw]) || 'unknown';
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

/** An amount the quotation shows, `''` when Geins gives none. */
type QuoteAmount = (
  value: number | null | undefined,
  geins: string | null | undefined,
) => string;

function quoteAmount(
  currency: string | undefined,
  locale: string,
): QuoteAmount {
  const write = amountWriter(currency, locale);
  return (value, geins) => write(value, geins) ?? '';
}

function mapLineItem(item: RawCartItem, amount: QuoteAmount): QuoteLineItem {
  const { unitPrice, totalPrice } = item;
  const configuration = cartLineConfiguration(item);
  return {
    id: item.id ?? '',
    productId: item.product?.productId ?? 0,
    alias: item.product?.alias ?? null,
    skuId: item.skuId ?? 0,
    name: item.product?.name ?? '',
    articleNumber: item.product?.articleNumber ?? '',
    quantity: item.quantity,
    unitPrice: item.unitPrice?.sellingPriceIncVat ?? 0,
    unitPriceFormatted: amount(
      unitPrice?.sellingPriceIncVat,
      unitPrice?.sellingPriceIncVatFormatted,
    ),
    totalPrice: item.totalPrice?.sellingPriceIncVat ?? 0,
    totalPriceFormatted: amount(
      totalPrice?.sellingPriceIncVat,
      totalPrice?.sellingPriceIncVatFormatted,
    ),
    unitPriceExVat: item.unitPrice?.sellingPriceExVat ?? 0,
    unitPriceExVatFormatted: amount(
      unitPrice?.sellingPriceExVat,
      unitPrice?.sellingPriceExVatFormatted,
    ),
    totalPriceExVat: item.totalPrice?.sellingPriceExVat ?? 0,
    totalPriceExVatFormatted: amount(
      totalPrice?.sellingPriceExVat,
      totalPrice?.sellingPriceExVatFormatted,
    ),
    imageFileName: item.product?.productImages?.[0]?.fileName ?? undefined,
    imageUrl: item.product?.productImages?.[0]?.url ?? null,
    ...(item.message && { message: item.message }),
    ...(configuration && {
      configuration,
      linePrices: { unit: unitPrice, total: totalPrice },
    }),
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

function fullName(person: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

function mapSeller(owner: RawQuotation['owner']): Quote['seller'] {
  if (!owner) return undefined;
  const name = fullName(owner);
  return name ? { name, phone: owner.phone || undefined } : undefined;
}

/** Who accepted and when; the API leaves `approvedAt` empty for now. */
function mapAccepted(
  customer: RawQuotation['customer'],
): Pick<Quote, 'acceptedAt' | 'acceptedBy'> {
  if (!customer?.approvedAt) return {};
  return {
    acceptedAt: customer.approvedAt,
    acceptedBy: fullName(customer) || undefined,
  };
}

/** The buyer alone: `contactName` falls back to the seller, this must not. */
function mapCustomer(
  customer: RawQuotation['customer'],
): QuoteCustomer | undefined {
  if (!customer) return undefined;
  return {
    id: customer.customerId || undefined,
    firstName: customer.firstName || undefined,
    lastName: customer.lastName || undefined,
  };
}

function mapPaymentMethods(
  methods: RawQuotation['validPaymentMethods'],
): QuotePaymentMethod[] | undefined {
  if (!methods?.length) return undefined;
  return methods.map((method) => ({
    id: method.paymentId ?? '',
    name: method.name || undefined,
    displayName: method.displayName || undefined,
    fee: method.paymentFee ?? undefined,
  }));
}

/**
 * What the order gets: `orderDetails`, or for a quotation requested before
 * Geins had it, the request, whose reference finalize takes as the PO number.
 */
function mapOrderDetails(
  q: Pick<RawQuotation, 'orderDetails' | 'request'>,
): QuoteOrderDetails | undefined {
  const source = q.orderDetails ?? q.request;
  if (!source) return undefined;
  const poNumber = q.orderDetails
    ? source.customerOrderNumber
    : requestPoNumber(source);
  const details: QuoteOrderDetails = {
    customerOrderNumber: poNumber || undefined,
    desiredDeliveryDate: calendarDay(source.desiredDeliveryDate),
    goodsLabel: source.goodsLabel || undefined,
  };
  return Object.values(details).some(Boolean) ? details : undefined;
}

/** What the buyer sent with the request, as it was sent. */
function mapRequest(
  request: RawQuotation['request'],
): QuoteRequestDetails | undefined {
  if (!request) return undefined;
  const details: QuoteRequestDetails = {
    comment: request.comment || undefined,
    customerOrderNumber: requestPoNumber(request) || undefined,
    desiredDeliveryDate: calendarDay(request.desiredDeliveryDate),
    goodsLabel: request.goodsLabel || undefined,
  };
  return Object.values(details).some(Boolean) ? details : undefined;
}

/** An older request carried the PO number as its reference. */
function requestPoNumber(request: RawOrderDetails) {
  return request.customerOrderNumber || request.customerReference;
}

/** Geins answers an instant; the day is the one it was written for. */
function calendarDay(instant: string | null | undefined) {
  return instant?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? undefined;
}

function mapQuotationCartToQuote(
  cart: RawQuotationCart,
  locale: string,
): Quote {
  const q = cart.quotation ?? {};
  const summary = cart.summary;
  const amount = quoteAmount(q.currency, locale);
  const items = (cart.items ?? []).map((item) => mapLineItem(item, amount));

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
    subtotalFormatted: amount(
      summary?.subTotal?.sellingPriceIncVat,
      summary?.subTotal?.sellingPriceIncVatFormatted,
    ),
    // The total's VAT, as the order view reads it: the subtotal's leaves out
    // the shipping and the discount.
    tax: summary?.total?.vat ?? 0,
    taxFormatted: amount(summary?.total?.vat, summary?.total?.vatFormatted),
    shipping: summary?.shipping?.feeIncVat ?? 0,
    shippingFormatted: amount(
      summary?.shipping?.feeIncVat,
      summary?.shipping?.feeIncVatFormatted,
    ),
    total: summary?.total?.sellingPriceIncVat ?? 0,
    totalFormatted: amount(
      summary?.total?.sellingPriceIncVat,
      summary?.total?.sellingPriceIncVatFormatted,
    ),
    subtotalExVat: summary?.subTotal?.sellingPriceExVat ?? 0,
    subtotalExVatFormatted: amount(
      summary?.subTotal?.sellingPriceExVat,
      summary?.subTotal?.sellingPriceExVatFormatted,
    ),
    shippingExVat: summary?.shipping?.feeExVat ?? 0,
    shippingExVatFormatted: amount(
      summary?.shipping?.feeExVat,
      summary?.shipping?.feeExVatFormatted,
    ),
    totalExVat: summary?.total?.sellingPriceExVat ?? 0,
    totalExVatFormatted: amount(
      summary?.total?.sellingPriceExVat,
      summary?.total?.sellingPriceExVatFormatted,
    ),
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
    requiresConfirmation: q.settings?.requireConfirmation === true,
    seller: mapSeller(q.owner),
    ...mapAccepted(q.customer),
    ...(q.orderId ? { orderId: q.orderId } : {}),
    customer: mapCustomer(q.customer),
    paymentMethods: mapPaymentMethods(q.validPaymentMethods),
    ...(q.orderPublicId ? { orderPublicId: q.orderPublicId } : {}),
    orderDetails: mapOrderDetails(q),
    request: mapRequest(q.request),
  };
}

function mapQuotationCartToListItem(
  cart: RawQuotationCart,
  locale: string,
): QuoteListItem {
  const q = cart.quotation ?? {};
  const total = cart.summary?.total;
  const amount = quoteAmount(q.currency, locale);
  const contactFirstName = q.customer?.firstName ?? q.owner?.firstName ?? '';
  const contactLastName = q.customer?.lastName ?? q.owner?.lastName ?? '';

  return {
    id: cart.id,
    quoteNumber: q.quotationNumber ?? '',
    name: q.name ?? undefined,
    contactName: `${contactFirstName} ${contactLastName}`.trim(),
    contactEmail: q.billingAddress?.email ?? '',
    status: mapStatus(q.status),
    total: cart.summary?.total?.sellingPriceIncVat ?? 0,
    totalFormatted: amount(
      total?.sellingPriceIncVat,
      total?.sellingPriceIncVatFormatted,
    ),
    totalExVat: cart.summary?.total?.sellingPriceExVat ?? 0,
    totalExVatFormatted: amount(
      total?.sellingPriceExVat,
      total?.sellingPriceExVatFormatted,
    ),
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
  const quotes = carts.map((cart) =>
    mapQuotationCartToListItem(cart, languageId),
  );
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
  const quote = mapQuotationCartToQuote(cart, languageId);
  if (quote.orderPublicId || !quote.orderId) return quote;
  // A quotation finalized before Geins carried the public id names its order
  // by number only. Without the id it still reads, with no order link.
  const orderPublicId = await findOrderPublicId(
    Number(quote.orderId),
    event,
  ).catch(() => undefined);
  return orderPublicId ? { ...quote, orderPublicId } : quote;
}

/**
 * The quotation's number, read as the signed-in buyer. Geins gives a buyer
 * only their own quotations, so it also says whether the buyer can open it.
 */
export async function getQuoteNumber(
  quoteId: string,
  event: H3Event,
): Promise<string> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const { languageId } = getRequestChannelVariables(sdk, event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('quotes/quotation-number.graphql'),
        variables: { quotationId: quoteId, languageId },
        userToken: requestContext?.userToken,
      }),
    'quotes',
  );
  const cart = unwrapGraphQL(result) as RawQuotationCart | null;
  const number = cart?.quotation?.quotationNumber;
  if (!number) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  return number;
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

/**
 * Place the order for a quotation; Geins builds it from the quotation's cart.
 * The message goes first as the cart's checkout input, which finalize puts on
 * the order; when Geins refuses it, no order is placed.
 */
export async function finalizeQuote(
  quoteId: string,
  event: H3Event,
  options: { message?: string } = {},
): Promise<Quote> {
  // An empty message clears one an earlier try wrote on the cart.
  if (options.message !== undefined) {
    await writeOrderMessage(quoteId, options.message.trim(), event);
  }
  return respondToQuote('quotes/finalize-quotation.graphql', quoteId, event);
}

async function writeOrderMessage(
  cartId: string,
  message: string,
  event: H3Event,
): Promise<void> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('quotes/quotation-checkout.graphql'),
        variables: {
          cartId,
          checkout: { message },
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: requestContext?.userToken,
        // No timeout: a message Geins saves after a cut would read as failed.
        requestOptions: { context: { timeoutMs: 0 } },
      }),
    'quotes',
  );
  if (!unwrapGraphQL(result)) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `Geins answered no checkout for quote ${cartId}`,
    );
  }
}

type ChannelVariables = ReturnType<typeof getRequestChannelVariables>;

/**
 * Run a quotation request mutation. Geins answers with the quotation's cart,
 * so it is mapped as it comes, without a second read.
 */
async function requestMutation(
  queryFile: string,
  variables: (channel: ChannelVariables) => Record<string, unknown>,
  event: H3Event,
): Promise<Quote> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const channel = getRequestChannelVariables(sdk, event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery(queryFile),
        variables: variables(channel),
        userToken: requestContext?.userToken,
        // No timeout: a request Geins makes after a cut would read as failed.
        requestOptions: { context: { timeoutMs: 0 } },
      }),
    'quotes',
  );
  const cart = unwrapGraphQL(result) as RawQuotationCart | null;
  if (!cart) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `Geins answered no quotation for ${queryFile}`,
    );
  }
  return mapQuotationCartToQuote(cart, channel.languageId);
}

/** A new `REQUEST_DRAFT` with the cart's lines; Geins leaves the cart as it is */
export function createQuoteRequest(
  cartId: string,
  name: string,
  event: H3Event,
): Promise<Quote> {
  const request: RawCreateQuotationRequestInput = {
    cartId,
    name,
    draft: true,
  };
  // The cart belongs to a channel and market, so the request is made in them.
  return requestMutation(
    'quotes/create-quotation-request.graphql',
    ({ channelId, languageId, marketId }) => ({
      request,
      channelId,
      languageId,
      marketId,
    }),
    event,
  );
}

/**
 * A configured line is only ever kept as it is: its amount is set in the
 * configurator, and a configuration the draft does not hold could be anyone's.
 */
async function assertConfiguredLinesKept(
  quoteId: string,
  items: QuoteRequestLine[],
  event: H3Event,
): Promise<void> {
  const configured = items.filter((item) => item.configurationId);
  if (!configured.length) return;
  const held = new Map(
    (await getQuote(quoteId, event)).lineItems.flatMap((line) =>
      line.configuration
        ? [[line.configuration.configurationId, line.quantity] as const]
        : [],
    ),
  );
  const seen = new Set<string>();
  for (const { configurationId, quantity } of configured) {
    const id = configurationId as string;
    if (held.get(id) !== quantity || seen.has(id)) {
      throw createAppError(
        ErrorCode.BAD_REQUEST,
        `Configured line ${id} is not on quote ${quoteId} at that amount`,
      );
    }
    seen.add(id);
  }
}

/**
 * Write to a `REQUEST_DRAFT`: its name, the request's details, and, when
 * `items` is given, the whole new list of lines.
 */
export async function updateQuoteRequest(
  quoteId: string,
  update: QuoteRequestUpdate,
  event: H3Event,
): Promise<Quote> {
  if (update.items) {
    await assertConfiguredLinesKept(quoteId, update.items, event);
  }
  const { desiredDeliveryDate, ...rest } = update;
  // Geins takes a DateTimeOffset and refuses a bare date; the day goes as its
  // UTC midnight, the instant an order's desired delivery date is sent as.
  const request = desiredDeliveryDate
    ? { ...rest, desiredDeliveryDate: `${desiredDeliveryDate}T00:00:00Z` }
    : rest;
  return requestMutation(
    'quotes/update-quotation-request.graphql',
    ({ languageId }) => ({ quotationId: quoteId, request, languageId }),
    event,
  );
}

/** Send a `REQUEST_DRAFT` to the seller: it becomes `REQUESTED` */
export function releaseQuoteRequest(
  quoteId: string,
  event: H3Event,
): Promise<Quote> {
  return requestMutation(
    'quotes/release-quotation-request.graphql',
    ({ languageId }) => ({ quotationId: quoteId, languageId }),
    event,
  );
}

/** Delete a `REQUEST_DRAFT`; Geins answers with a Boolean */
export async function deleteQuoteRequest(
  quoteId: string,
  event: H3Event,
): Promise<void> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.mutation({
        queryAsString: loadQuery('quotes/delete-quotation-request.graphql'),
        variables: {
          quotationId: quoteId,
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: requestContext?.userToken,
        // No timeout: a delete Geins makes after a cut would read as failed.
        requestOptions: { context: { timeoutMs: 0 } },
      }),
    'quotes',
  );
  if (unwrapGraphQL(result) !== true) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `Geins answered false or nothing deleting quote ${quoteId}`,
    );
  }
}
