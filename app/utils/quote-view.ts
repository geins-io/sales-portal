import { formatPrice } from '#shared/types/commerce';
import type { Quote } from '#shared/types/quote';
import type { PortalItemTotal } from '#shared/types/portal-rows';

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

/** The totals under the rows in the mobile sheet, in the summary's order. */
export function quoteTotalRows(
  amounts: QuoteAmounts,
  itemCount: number,
  incVat: boolean,
  t: Translate,
): PortalItemTotal[] {
  const rows: PortalItemTotal[] = [
    {
      label: t('portal.quotations.subtotal_with_count', { count: itemCount }),
      value: amounts.subtotal,
    },
  ];
  if (amounts.discount) {
    rows.push({
      label: quoteDiscountLabel(amounts, t),
      value: `-${amounts.discount}`,
    });
  }
  if (amounts.shipping) {
    rows.push({
      label: t('portal.quotations.shipping'),
      value: amounts.shipping,
    });
  }
  rows.push(
    {
      label: t(incVat ? 'common.vat_included' : 'common.vat'),
      value: amounts.tax,
    },
    {
      label: t('portal.quotations.grand_total'),
      value: amounts.total,
      emphasis: true,
    },
  );
  if (amounts.totalIncVat) {
    rows.push({ label: t('common.total_inc_vat'), value: amounts.totalIncVat });
  }
  return rows;
}
