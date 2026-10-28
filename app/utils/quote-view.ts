import { formatPrice } from '#shared/types/commerce';
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

/** One row under the summary's lead amount; `key` names it for the page. */
export interface QuoteSummaryRow {
  key: 'count' | 'discount' | 'shipping' | 'tax' | 'total' | 'total-inc-vat';
  label: string;
  value?: string;
  emphasis?: boolean;
}

/** The rows under the lead amount (the subtotal), in the summary's order. */
export function quoteSummaryRows(
  amounts: QuoteAmounts,
  itemCount: number,
  incVat: boolean,
  t: Translate,
): QuoteSummaryRow[] {
  const rows: QuoteSummaryRow[] = [
    {
      key: 'count',
      label: t('portal.quotations.items_count'),
      value: String(itemCount),
    },
  ];
  if (amounts.discount) {
    rows.push({
      key: 'discount',
      label: quoteDiscountLabel(amounts, t),
      value: `-${amounts.discount}`,
    });
  }
  if (amounts.shipping) {
    rows.push({
      key: 'shipping',
      label: t('portal.quotations.shipping'),
      value: amounts.shipping,
    });
  }
  rows.push(
    {
      key: 'tax',
      label: t(incVat ? 'common.vat_included' : 'common.vat'),
      value: amounts.tax,
    },
    {
      key: 'total',
      label: t('portal.quotations.grand_total'),
      value: amounts.total,
      emphasis: true,
    },
  );
  if (amounts.totalIncVat) {
    rows.push({
      key: 'total-inc-vat',
      label: t('common.total_inc_vat'),
      value: amounts.totalIncVat,
    });
  }
  return rows;
}

/** What accepting means: Monitor places the order, or the seller confirms first, or neither. */
export type QuoteAcceptKind = 'monitor' | 'confirm' | 'plain';

export function quoteAcceptKind(
  quote: Pick<Quote, 'externalReference' | 'requiresConfirmation'>,
): QuoteAcceptKind {
  if (quote.externalReference) return 'monitor';
  return quote.requiresConfirmation ? 'confirm' : 'plain';
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
