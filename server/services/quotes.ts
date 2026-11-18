import type { H3Event } from 'h3';
import type { CartItemConfigurationType } from '@geins/types';
import type { PriceType } from '#shared/types/commerce';
import {
  QUOTE_LINE_MAX_QUANTITY,
  QUOTE_REQUEST_MAX_LINES,
} from '#shared/constants/quote';
import type { QuoteListFilter } from '#shared/constants/quote';
import type { ConfigurationChoices } from '#shared/types/configurator';
import type {
  Quote,
  QuoteAddress,
  QuoteCompany,
  QuoteCustomer,
  QuoteDraftChoice,
  QuoteLineItem,
  QuoteListCounts,
  QuoteListItem,
  QuoteListPage,
  QuotePendingOverview,
  QuoteOrderDetails,
  QuotePaymentMethod,
  QuoteRequestDetails,
  QuoteRequestLine,
  QuoteRequestUpdate,
  QuoteStatus,
  QuoteVersion,
} from '#shared/types/quote';
import type { QuoteDisplayNumber } from '#shared/types/tenant-config';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { findOrderPublicId } from './orders';
import { addItem, createCart } from './cart';
import { cartLineConfiguration, committedChoices } from './line-configuration';
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
    canonicalUrl?: string | null;
    name?: string;
    articleNumber?: string;
    productImages?: { fileName?: string; url?: string | null }[];
  };
}

interface RawQuotation {
  quotationNumber?: string;
  externalReference?: { number?: string | null } | null;
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
  /** `QuotationVersionType`; `@geins/types` does not have it yet. */
  revisions?: RawQuotationVersion[] | null;
}

interface RawQuotationVersion {
  quotationId: string;
  quotationNumber?: string | null;
  status?: string;
  validFrom?: string | null;
  validTo?: string | null;
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
  releasedAt?: string | null;
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
  REVISED: 'revised',
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
    ...(item.product?.canonicalUrl && {
      canonicalUrl: item.product.canonicalUrl,
    }),
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

/** The tenant's choice of number; unset reads as `quotationNumber`. */
function numberChoice(event: H3Event): QuoteDisplayNumber | undefined {
  return event.context.tenant?.config?.quoteDisplayNumber;
}

/** Only the chosen number: a missing one shows none, never the other. */
function shownNumber(
  q: RawQuotation,
  choice: QuoteDisplayNumber | undefined,
): string {
  return choice === 'externalNumber'
    ? q.externalReference?.number || ''
    : q.quotationNumber || '';
}

function mapQuotationCartToQuote(
  cart: RawQuotationCart,
  locale: string,
  choice: QuoteDisplayNumber | undefined,
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
    quoteNumber: shownNumber(q, choice),
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
    ...(q.request?.releasedAt ? { requestSentAt: q.request.releasedAt } : {}),
    versions: (q.revisions ?? []).map((v) =>
      mapVersion(v, versionNumber(v, cart.id, q, choice)),
    ),
  };
}

/**
 * The number a version shows, by the tenant's choice. `revisions` lists no
 * external number and none is read per version, so with `externalNumber`
 * only the open version, from its own quotation, has one.
 */
function versionNumber(
  v: RawQuotationVersion,
  openId: string,
  q: RawQuotation,
  choice: QuoteDisplayNumber | undefined,
): string {
  if (v.quotationId === openId) return shownNumber(q, choice);
  return choice === 'externalNumber' ? '' : v.quotationNumber || '';
}

function mapVersion(v: RawQuotationVersion, quoteNumber: string): QuoteVersion {
  return {
    quotationId: v.quotationId,
    quotationNumber: v.quotationNumber ?? '',
    quoteNumber,
    status: mapStatus(v.status),
    ...(v.validFrom ? { validFrom: v.validFrom } : {}),
    ...(v.validTo ? { validTo: v.validTo } : {}),
  };
}

function mapQuotationCartToListItem(
  cart: RawQuotationCart,
  locale: string,
  choice: QuoteDisplayNumber | undefined,
): QuoteListItem {
  const q = cart.quotation ?? {};
  const total = cart.summary?.total;
  const amount = quoteAmount(q.currency, locale);
  const contactFirstName = q.customer?.firstName ?? q.owner?.firstName ?? '';
  const contactLastName = q.customer?.lastName ?? q.owner?.lastName ?? '';

  return {
    id: cart.id,
    quoteNumber: shownNumber(q, choice),
    name: q.name ?? undefined,
    contactName: `${contactFirstName} ${contactLastName}`.trim(),
    status: mapStatus(q.status),
    total: total?.sellingPriceIncVat ?? 0,
    totalFormatted: amount(
      total?.sellingPriceIncVat,
      total?.sellingPriceIncVatFormatted,
    ),
    totalExVat: total?.sellingPriceExVat ?? 0,
    totalExVatFormatted: amount(
      total?.sellingPriceExVat,
      total?.sellingPriceExVatFormatted,
    ),
    createdAt: q.createdAt ?? '',
  };
}

// ---------------------------------------------------------------------------
// Quotes service
// ---------------------------------------------------------------------------

/** The Geins statuses behind each tab of the list; Alla asks for none. */
const TAB_STATUSES: Record<QuoteListFilter, string[] | undefined> = {
  all: undefined,
  drafts: ['REQUEST_DRAFT'],
  requests: ['REQUESTED'],
  quotations: [
    'PENDING',
    'ACCEPTED',
    'CONFIRMED',
    'FINALIZED',
    'REJECTED',
    'CANCELED',
    'EXPIRED',
  ],
};

/** One `quotationCarts` answer, as far as the list's queries select it. */
interface RawQuotationCartsPage {
  count?: number | null;
  quotationCarts?: RawQuotationCart[] | null;
}

/**
 * A `quotationCarts` read as the signed-in buyer. Geins scopes quotations by
 * the user token and languageId only: Studio stores channelId as "1" while the
 * request's channel is "1|se", and passing it hides the buyer's quotations.
 */
async function readQuotationCarts(
  queryFile: string,
  variables: Record<string, unknown>,
  event: H3Event,
): Promise<{ data: unknown; languageId: string }> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const { languageId } = getRequestChannelVariables(sdk, event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery(queryFile),
        variables: { ...variables, languageId },
        userToken: requestContext?.userToken,
      }),
    'quotes',
  );
  return { data: unwrapGraphQL(result), languageId };
}

export interface QuoteListQuery {
  tab: QuoteListFilter;
  search?: string;
  createdFrom?: string;
  createdBefore?: string;
  skip: number;
  take: number;
}

/** One page of the buyer's quotations, newest first as Geins sends them. */
export async function listQuotes(
  query: QuoteListQuery,
  event: H3Event,
): Promise<QuoteListPage> {
  const { tab, skip, take, ...rest } = query;
  // A filter left undefined is no filter: JSON leaves it out.
  const filter = { statuses: TAB_STATUSES[tab], ...rest };
  const { data, languageId } = await readQuotationCarts(
    'quotes/quotation-cart-page.graphql',
    { filter, skip, take },
    event,
  );
  const page = data as RawQuotationCartsPage | null;
  const choice = numberChoice(event);
  return {
    quotes: (page?.quotationCarts ?? []).map((cart) =>
      mapQuotationCartToListItem(cart, languageId, choice),
    ),
    total: page?.count ?? 0,
  };
}

/** How many quotations each tab holds, in one request. */
export async function countQuotes(event: H3Event): Promise<QuoteListCounts> {
  const { data } = await readQuotationCarts(
    'quotes/quotation-cart-counts.graphql',
    {
      drafts: TAB_STATUSES.drafts,
      requests: TAB_STATUSES.requests,
      quotations: TAB_STATUSES.quotations,
    },
    event,
  );
  const parts = (data ?? {}) as Partial<
    Record<QuoteListFilter, RawQuotationCartsPage | null>
  >;
  const count = (tab: QuoteListFilter) => parts[tab]?.count ?? 0;
  return {
    all: count('all'),
    drafts: count('drafts'),
    requests: count('requests'),
    quotations: count('quotations'),
  };
}

/** The start page's pending quotations: the newest five, the count, every end date. */
export async function getPendingOverview(
  event: H3Event,
): Promise<QuotePendingOverview> {
  const { data, languageId } = await readQuotationCarts(
    'quotes/quotation-pending-overview.graphql',
    {},
    event,
  );
  const { recent, expiry } = (data ?? {}) as {
    recent?: RawQuotationCartsPage | null;
    expiry?: RawQuotationCartsPage | null;
  };
  const choice = numberChoice(event);
  return {
    quotes: (recent?.quotationCarts ?? []).map((cart) =>
      mapQuotationCartToListItem(cart, languageId, choice),
    ),
    total: recent?.count ?? 0,
    expiries: (expiry?.quotationCarts ?? []).flatMap((cart) =>
      cart.quotation?.validTo
        ? [{ id: cart.id, expiresAt: cart.quotation.validTo }]
        : [],
    ),
  };
}

/** The buyer's request drafts, as the add-to-quote menu offers them. */
export async function listDraftChoices(
  event: H3Event,
): Promise<QuoteDraftChoice[]> {
  const { data } = await readQuotationCarts(
    'quotes/quotation-draft-menu.graphql',
    {},
    event,
  );
  const page = data as RawQuotationCartsPage | null;
  return (page?.quotationCarts ?? []).map((cart) => ({
    id: cart.id,
    name: cart.quotation?.name ?? '',
    updatedAt: cart.quotation?.modifiedAt ?? '',
    itemCount: cart.items?.length ?? 0,
  }));
}

/** The names of the buyer's quotations that `search` finds. */
export async function listQuoteNames(
  search: string,
  event: H3Event,
): Promise<string[]> {
  const { data } = await readQuotationCarts(
    'quotes/quotation-names.graphql',
    { search },
    event,
  );
  const page = data as RawQuotationCartsPage | null;
  return (page?.quotationCarts ?? []).flatMap((cart) =>
    cart.quotation?.name ? [cart.quotation.name] : [],
  );
}

/** The quotation as Geins sends it, before it is mapped; null when it has none. */
async function findQuotationCart(
  quoteId: string,
  event: H3Event,
): Promise<{ cart: RawQuotationCart | null; languageId: string }> {
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
  return { cart: unwrapGraphQL(result) as RawQuotationCart | null, languageId };
}

/** Get a single quotation cart via Geins GraphQL API */
export async function getQuote(
  quoteId: string,
  event: H3Event,
): Promise<Quote> {
  const { cart, languageId } = await findQuotationCart(quoteId, event);
  if (!cart) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  const quote = mapQuotationCartToQuote(cart, languageId, numberChoice(event));
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
  if (!cart?.quotation) {
    throw createAppError(ErrorCode.NOT_FOUND, `Quote ${quoteId} not found`);
  }
  return shownNumber(cart.quotation, numberChoice(event));
}

/** The buyer's message to the seller, stored with the status change. */
interface QuoteAnswerOptions {
  message?: string;
}

/**
 * Answer a quotation. Geins answers the mutation with a Boolean, so the
 * quotation is read again for its new status.
 */
async function respondToQuote(
  queryFile: string,
  quoteId: string,
  event: H3Event,
  options: QuoteAnswerOptions = {},
): Promise<Quote> {
  // A blank message is left out, so the answer is the one without a message.
  const message = options.message?.trim();
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
          ...(message && { message }),
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
export function acceptQuote(
  quoteId: string,
  event: H3Event,
  options: QuoteAnswerOptions = {},
): Promise<Quote> {
  return respondToQuote(
    'quotes/accept-quotation.graphql',
    quoteId,
    event,
    options,
  );
}

/** Reject a quotation, or withdraw a request, via Geins GraphQL API */
export function rejectQuote(
  quoteId: string,
  event: H3Event,
  options: QuoteAnswerOptions = {},
): Promise<Quote> {
  return respondToQuote(
    'quotes/reject-quotation.graphql',
    quoteId,
    event,
    options,
  );
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
  return mapQuotationCartToQuote(cart, channel.languageId, numberChoice(event));
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
 * A configured line is only ever sent by a configuration the draft holds,
 * once: a configuration it does not hold could be anyone's. Its amount may
 * change; Geins prices the line at the new amount.
 */
async function assertConfiguredLinesKept(
  quoteId: string,
  items: QuoteRequestLine[],
  event: H3Event,
): Promise<void> {
  const configured = items.filter((item) => item.configurationId);
  if (!configured.length) return;
  const held = new Set(
    (await getQuote(quoteId, event)).lineItems.flatMap((line) =>
      line.configuration ? [line.configuration.configurationId] : [],
    ),
  );
  const seen = new Set<string>();
  for (const { configurationId } of configured) {
    const id = configurationId as string;
    if (!held.has(id) || seen.has(id)) {
      throw createAppError(
        ErrorCode.BAD_REQUEST,
        `Configured line ${id} is not on quote ${quoteId}`,
      );
    }
    seen.add(id);
  }
}

/** A configured draft line and what it was committed with, for a replay. */
export interface QuoteLineChoices {
  productId: number | null;
  quantity: number;
  /** Null for a line committed before its structure was recorded. */
  choices: ConfigurationChoices | null;
}

/**
 * The configured line of a `REQUEST_DRAFT`, by its id, read now. Anything else
 * — no such quotation, one that has been sent, a line that is gone or plain —
 * is a line the buyer can no longer change, told by its own code.
 */
async function draftConfiguredLine(
  quoteId: string,
  lineId: string,
  event: H3Event,
) {
  const { cart } = await findQuotationCart(quoteId, event);
  const items =
    cart?.quotation?.status === 'REQUEST_DRAFT' ? (cart.items ?? []) : [];
  const index = items.findIndex(
    (item) => item.id === lineId && item.configurationId,
  );
  if (index < 0) {
    throw createAppError(
      ErrorCode.QUOTE_LINE_GONE,
      `Line ${lineId} is not a configured line of draft ${quoteId}`,
    );
  }
  return { index, line: items[index]!, items };
}

/** A configured line of a draft: its product, its amount and its choices. */
export async function getQuoteLineChoices(
  quoteId: string,
  lineId: string,
  event: H3Event,
): Promise<QuoteLineChoices> {
  const { line } = await draftConfiguredLine(quoteId, lineId, event);
  const sections = line.configuration?.sections;
  return {
    productId: line.product?.productId ?? null,
    quantity: line.quantity,
    choices: sections ? committedChoices(sections) : null,
  };
}

/** A line as the draft holds it, sent back unchanged. */
function keptLine(item: RawCartItem): QuoteRequestLine {
  return {
    ...(item.id && { id: item.id }),
    skuId: item.skuId ?? 0,
    quantity: item.quantity,
    ...(item.configurationId && { configurationId: item.configurationId }),
    ...(item.message && { message: item.message }),
  };
}

/** The part of a commit the draft line takes. */
export interface CommittedLine {
  committedConfigurationId: string;
  quantity: number;
}

/**
 * Put a new configuration on a configured draft line, in its place: Geins
 * takes the whole list, so every other line goes back as the draft holds it.
 * The line is checked before `commit` runs, so a line that cannot take it, or
 * one of another product than the page saving it shows, commits nothing. The
 * list is read again after the commit, so a change saved meanwhile is not put
 * back. The committed id and amount are the commit's own: Geins takes any
 * configuration at any amount on a line, so neither comes from the buyer.
 */
export async function replaceConfiguredLine(
  quoteId: string,
  lineId: string,
  productId: string,
  commit: () => Promise<CommittedLine>,
  event: H3Event,
): Promise<Quote> {
  const { line } = await draftConfiguredLine(quoteId, lineId, event);
  const lineProduct = line.product?.productId;
  if (lineProduct == null || String(lineProduct) !== productId) {
    throw createAppError(
      ErrorCode.QUOTE_LINE_GONE,
      `Line ${lineId} of draft ${quoteId} is not a line of product ${productId}`,
    );
  }
  const { committedConfigurationId, quantity } = await commit();
  const found = await draftConfiguredLine(quoteId, lineId, event);
  const items = found.items.map((item, i) =>
    i === found.index
      ? {
          skuId: found.line.skuId ?? 0,
          quantity,
          configurationId: committedConfigurationId,
          ...(found.line.message && { message: found.line.message }),
        }
      : keptLine(item),
  );
  return requestMutation(
    'quotes/update-quotation-request.graphql',
    ({ languageId }) => ({
      quotationId: quoteId,
      request: { items },
      languageId,
    }),
    event,
  );
}

/**
 * A line on its way to a draft: a plain one by its SKU, or a configuration
 * this request committed.
 */
export interface NewQuoteLine {
  skuId: number;
  quantity: number;
  configurationId?: string;
}

function addFailed(message: string): Error {
  return createAppError(ErrorCode.QUOTE_ADD_FAILED, message);
}

/** The lines of a `REQUEST_DRAFT`, read now; anything else takes no add. */
async function draftLines(
  quoteId: string,
  event: H3Event,
): Promise<RawCartItem[]> {
  const { cart } = await findQuotationCart(quoteId, event);
  if (cart?.quotation?.status !== 'REQUEST_DRAFT') {
    throw addFailed(`${quoteId} is not a request draft`);
  }
  return cart.items ?? [];
}

/**
 * The draft's list with the line added. A plain line of the same SKU takes the
 * amount, as quick add does; a configuration is always a line of its own.
 * Also the amount the line should hold once Geins has it.
 */
function withLine(
  items: RawCartItem[],
  line: NewQuoteLine,
): { items: QuoteRequestLine[]; expected: number } {
  const kept = items.map(keptLine);
  const same = line.configurationId
    ? undefined
    : kept.find((item) => item.skuId === line.skuId && !item.configurationId);
  if (same) {
    if (same.quantity >= QUOTE_LINE_MAX_QUANTITY) {
      throw addFailed(
        `SKU ${line.skuId} is at the largest amount a line takes`,
      );
    }
    same.quantity = Math.min(
      same.quantity + line.quantity,
      QUOTE_LINE_MAX_QUANTITY,
    );
    return { items: kept, expected: same.quantity };
  }
  if (kept.length >= QUOTE_REQUEST_MAX_LINES) {
    throw addFailed('The draft holds as many lines as one may');
  }
  return { items: [...kept, { ...line }], expected: line.quantity };
}

/** Geins answers a write it did not make with a 200 too: the line must be there. */
function assertHolds(quote: Quote, line: NewQuoteLine, expected: number): void {
  const held = quote.lineItems.some((item) =>
    line.configurationId
      ? item.configuration?.configurationId === line.configurationId
      : item.skuId === line.skuId &&
        !item.configuration &&
        item.quantity === expected,
  );
  if (!held) {
    throw addFailed(`Quote ${quote.id} does not hold SKU ${line.skuId}`);
  }
}

/**
 * Add a line to a `REQUEST_DRAFT`, sending the whole list as the draft holds
 * it. A line given as a function is a commit: it runs only once the draft is
 * known to take it, and the list is read again after it, so a change saved
 * meanwhile is not put back.
 */
export async function addToDraft(
  quoteId: string,
  line: NewQuoteLine | (() => Promise<NewQuoteLine>),
  event: H3Event,
): Promise<Quote> {
  let items = await draftLines(quoteId, event);
  let added: NewQuoteLine;
  if (typeof line === 'function') {
    added = await line();
    items = await draftLines(quoteId, event);
  } else {
    added = line;
  }
  const next = withLine(items, added);
  const quote = await requestMutation(
    'quotes/update-quotation-request.graphql',
    ({ languageId }) => ({
      quotationId: quoteId,
      request: { items: next.items },
      languageId,
    }),
    event,
  );
  assertHolds(quote, added, next.expected);
  return quote;
}

/**
 * A new `REQUEST_DRAFT` holding one line. Geins makes a draft only from a cart,
 * so the line goes into a cart of its own: the buyer's cart is never read or
 * changed. `place` puts the line in that cart and fails when the cart did not
 * take it, so no draft is made without it.
 */
export async function createDraftWith(
  name: string,
  place: (cartId: string) => Promise<NewQuoteLine>,
  event: H3Event,
): Promise<Quote> {
  const { id: cartId } = await createCart(event);
  const line = await place(cartId);
  const quote = await createQuoteRequest(cartId, name, event);
  assertHolds(quote, line, line.quantity);
  return quote;
}

/**
 * A plain line in the cart `place` was handed. Geins answers a line short of
 * stock with a 200 and no line, so the answer is checked.
 */
export async function placePlainLine(
  cartId: string,
  line: NewQuoteLine,
  event: H3Event,
): Promise<NewQuoteLine> {
  const cart = await addItem(
    cartId,
    { skuId: line.skuId, quantity: line.quantity },
    event,
  );
  const held = cart?.items?.some(
    (item) => item.skuId === line.skuId && item.quantity === line.quantity,
  );
  if (!held) throw addFailed(`The cart did not take SKU ${line.skuId}`);
  return line;
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
