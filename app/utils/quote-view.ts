import { formatPrice } from '#shared/types/commerce';
import type { PortalItemRow } from '#shared/types/portal-rows';
import type { Quote, QuoteStatus } from '#shared/types/quote';

/** A quotation's summary amounts, formatted, on one side of the VAT choice. */
export interface QuoteAmounts {
  subtotal?: string;
  /** The seller's discount, as a positive amount; only when > 0. */
  discount?: string;
  /** The rate behind a percent discount; only with `discount`. */
  discountPercent?: string;
  /** Only when the quotation carries a shipping fee. */
  shipping?: string;
  /** VAT is one number on both sides. */
  tax?: string;
  total?: string;
  /** The inc amount under an ex-VAT total; never on the inc side, never a 0. */
  totalIncVat?: string;
}

/** Every amount the quotation summary shows, from the quotation. */
export function quoteAmounts(
  quote: Quote | null | undefined,
  incVat: boolean,
  locale?: string,
): QuoteAmounts {
  if (!quote) return {};
  const amounts: QuoteAmounts = {
    subtotal: incVat ? quote.subtotalFormatted : quote.subtotalExVatFormatted,
    tax: quote.taxFormatted,
    total: incVat ? quote.totalFormatted : quote.totalExVatFormatted,
  };
  // A number only, so it is formatted here, in the quotation's currency.
  const discount = (incVat ? quote.discount : quote.discountExVat) ?? 0;
  if (discount > 0) {
    amounts.discount = formatPrice(
      discount,
      quote.currency || undefined,
      locale,
    );
    if (quote.discountPercent) {
      amounts.discountPercent = new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 2,
      }).format(quote.discountPercent / 100);
    }
  }
  if (quote.shipping > 0) {
    amounts.shipping = incVat
      ? quote.shippingFormatted
      : quote.shippingExVatFormatted;
  }
  if (!incVat && quote.total > 0 && quote.totalFormatted) {
    amounts.totalIncVat = quote.totalFormatted;
  }
  return amounts;
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

/** "Discount 5 %" for a percent discount, "Discount" for a fixed amount. */
export function quoteDiscountLabel(
  amounts: QuoteAmounts,
  t: Translate,
): string {
  return amounts.discountPercent
    ? t('portal.quotations.discount_percent', {
        percent: amounts.discountPercent,
      })
    : t('discount.discount');
}

/**
 * The quotation's lines, as the order parts render them: the desktop table and
 * the mobile sheet. Keyed by position, as two lines can carry one SKU.
 */
export function quoteRows(
  quote: Quote | null | undefined,
  incVat: boolean,
): PortalItemRow[] {
  return (quote?.lineItems ?? []).map((item, index) => ({
    key: `row-${index}`,
    name: item.name,
    articleNumber: item.articleNumber,
    quantity: item.quantity,
    unitPriceFormatted: incVat
      ? item.unitPriceFormatted
      : item.unitPriceExVatFormatted,
    totalPriceFormatted: incVat
      ? item.totalPriceFormatted
      : item.totalPriceExVatFormatted,
    imageFileName: item.imageFileName ?? null,
    imageUrl: item.imageUrl ?? null,
    alias: item.alias ?? null,
  }));
}

/** What accepting means: Monitor places the order, or the seller confirms first, or neither. */
export type QuoteAcceptKind = 'monitor' | 'confirm' | 'plain';

export function quoteAcceptKind(
  quote: Pick<Quote, 'externalReference' | 'requiresConfirmation'>,
): QuoteAcceptKind {
  if (quote.externalReference) return 'monitor';
  return quote.requiresConfirmation ? 'confirm' : 'plain';
}

/**
 * Whether the buyer may place the order now. Monitor places its own; a
 * quotation that needs confirmation waits for the seller's.
 */
export function quoteCanOrder(
  quote: Pick<Quote, 'status' | 'externalReference' | 'requiresConfirmation'>,
): boolean {
  switch (quoteAcceptKind(quote)) {
    case 'monitor':
      return false;
    case 'confirm':
      return quote.status === 'confirmed';
    default:
      return quote.status === 'pending' || quote.status === 'accepted';
  }
}

/** What the summary card offers the buyer. */
export interface QuoteResponses {
  withdraw: boolean;
  decline: boolean;
  /** `order` links to the order page; the others accept in a dialog. */
  accept: 'order' | QuoteAcceptKind | null;
  /** The dialog's body for an accept in a dialog. */
  acceptBodyKey?: string;
  /** "Place order" on a quotation that is answered and may be ordered now. */
  placeOrder: boolean;
  /** The note under accept. */
  noteKey?: string;
}

const K = 'portal.quotations.';

/**
 * `canPlaceOrders` is the buyer's `orderPlacement`: the order page lets no one
 * else in, so without it nothing leads to the order page and no text offers it.
 */
export function quoteResponses(
  quote: Pick<Quote, 'status' | 'externalReference' | 'requiresConfirmation'>,
  canPlaceOrders: boolean,
): QuoteResponses {
  const pending = quote.status === 'pending';
  const responses: QuoteResponses = {
    withdraw: quote.status === 'requested',
    decline: pending,
    accept: null,
    placeOrder: !pending && canPlaceOrders && quoteCanOrder(quote),
  };
  if (!pending) return responses;

  const kind = quoteAcceptKind(quote);
  if (kind === 'plain' && canPlaceOrders) {
    return { ...responses, accept: 'order', noteKey: `${K}note_order` };
  }
  const order = kind === 'confirm' && canPlaceOrders ? '_order' : '';
  return {
    ...responses,
    accept: kind,
    acceptBodyKey: `${K}accept_${kind}${order}_body`,
    noteKey: kind === 'plain' ? undefined : `${K}note_${kind}${order}`,
  };
}

const STATUSES_WITH_INFO = new Set<QuoteStatus>([
  'requested',
  'pending',
  'confirmed',
  'finalized',
  'rejected',
  'canceled',
  'expired',
]);

/** The details card's status text; none for a draft or an unknown status. */
export function quoteStatusInfoKey(
  quote: Pick<Quote, 'status' | 'externalReference' | 'requiresConfirmation'>,
  canPlaceOrders: boolean,
): string | undefined {
  // Pending keeps its own text; its card offers the response.
  const order =
    quote.status !== 'pending' && canPlaceOrders && quoteCanOrder(quote)
      ? '_order'
      : '';
  if (quote.status === 'accepted') {
    return `${K}status_info_accepted_${quoteAcceptKind(quote)}${order}`;
  }
  return STATUSES_WITH_INFO.has(quote.status)
    ? `${K}status_info_${quote.status}${order}`
    : undefined;
}

/** "Quote request" until the seller has priced it, "Quotation" after. */
export function quoteKindLabelKey(status: QuoteStatus): string {
  return status === 'request_draft' || status === 'requested'
    ? 'portal.quotations.kind_request'
    : 'portal.quotations.kind_quotation';
}
