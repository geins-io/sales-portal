import type { SummaryRow } from '#shared/types/portal-rows';
import type { OrderAmounts } from '~/utils/order-view';

type Translate = (key: string, named?: Record<string, unknown>) => string;

export interface SummaryRowLabels {
  /** The inc-VAT line's text: each page words it its own way. */
  totalIncVatLabel: string;
  /** In place of "Discount", e.g. a quotation's "Discount 5 %". */
  discountLabel?: string;
  /** The shipping row's value while there is no shipping amount. */
  shippingNote?: string;
}

/**
 * An order's or a quotation's summary as rows, in the order the cart lists
 * them. The one source for the summary card, the table footer and the sheet.
 */
export function summaryRows(
  amounts: OrderAmounts,
  itemCount: number,
  incVat: boolean,
  t: Translate,
  labels: SummaryRowLabels,
): SummaryRow[] {
  const rows: SummaryRow[] = [
    {
      key: 'subtotal',
      label: t('portal.orders.detail.summary.subtotal_with_count', {
        count: itemCount,
      }),
      value: amounts.subtotal,
    },
  ];
  if (amounts.discount) {
    rows.push({
      key: 'discount',
      label: labels.discountLabel ?? t('discount.discount'),
      value: `-${amounts.discount}`,
    });
  }
  const shipping = amounts.shipping || labels.shippingNote;
  if (shipping) {
    rows.push({
      key: 'shipping',
      label: t('portal.orders.detail.summary.shipping'),
      value: shipping,
    });
  }
  if (amounts.paymentFee) {
    rows.push({
      key: 'payment-fee',
      label: t('common.payment_fee'),
      value: amounts.paymentFee,
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
      label: t('portal.orders.detail.summary.total'),
      value: amounts.total,
      emphasis: true,
    },
  );
  if (amounts.totalIncVat) {
    rows.push({
      key: 'total-inc-vat',
      label: labels.totalIncVatLabel,
      value: amounts.totalIncVat,
    });
  }
  return rows;
}
