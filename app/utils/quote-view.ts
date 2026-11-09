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
    ...(item.configuration && {
      configuration: item.configuration,
      unitPrice: item.linePrices?.unit,
      totalPrice: item.linePrices?.total,
    }),
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

/** The answers the buyer can give in a status. */
export interface QuoteResponses {
  withdraw: boolean;
  decline: boolean;
  accept: boolean;
}

export function quoteResponses(status: QuoteStatus): QuoteResponses {
  return {
    withdraw: status === 'requested',
    decline: status === 'pending',
    accept: status === 'pending',
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
): string | undefined {
  if (quote.status === 'accepted') {
    return `portal.quotations.status_info_accepted_${quoteAcceptKind(quote)}`;
  }
  return STATUSES_WITH_INFO.has(quote.status)
    ? `portal.quotations.status_info_${quote.status}`
    : undefined;
}

/** "Quote request" until the seller has priced it, "Quotation" after. */
export function quoteKindLabelKey(status: QuoteStatus): string {
  return status === 'request_draft' || status === 'requested'
    ? 'portal.quotations.kind_request'
    : 'portal.quotations.kind_quotation';
}
