import type { OrderDetailType } from '#shared/types/commerce';
import type { PortalItemRow, PortalItemTotal } from '#shared/types/portal-rows';

/** An order's summary amounts, formatted, on one side of the VAT choice. */
export interface OrderAmounts {
  subtotal?: string;
  /** Only when the order carries a shipping fee. */
  shipping?: string;
  /** Only when the order carries a payment fee. */
  paymentFee?: string;
  /** VAT is one number on both sides. */
  tax?: string;
  total?: string;
  /** The inc amount under an ex-VAT total; never on the inc side, never a 0. */
  totalIncVat?: string;
}

type Side = {
  sellingPriceIncVat?: number | null;
  sellingPriceIncVatFormatted?: string | null;
  sellingPriceExVatFormatted?: string | null;
} | null;

function sideOf(price: Side | undefined, incVat: boolean): string | undefined {
  return (
    (incVat
      ? price?.sellingPriceIncVatFormatted
      : price?.sellingPriceExVatFormatted) ?? undefined
  );
}

function incOf(price: Side | undefined): string | undefined {
  return (price?.sellingPriceIncVat ?? 0) > 0
    ? price?.sellingPriceIncVatFormatted || undefined
    : undefined;
}

// A fee row only when the order carries the fee; a placed order has no
// "may apply".
function feeOf(
  amount: number | null | undefined,
  formatted: string | null | undefined,
): string | undefined {
  return (amount ?? 0) > 0 ? formatted || undefined : undefined;
}

/** Every amount the order page and the confirmation show, from the order. */
export function orderAmounts(
  order: OrderDetailType | null | undefined,
  incVat: boolean,
): OrderAmounts {
  const summary = order?.cart?.summary;
  const shipping = summary?.shipping;
  const shippingFee = order?.shippingFee;
  const paymentFee = order?.paymentFee;
  return {
    subtotal: sideOf(summary?.subTotal, incVat),
    // The cart summary's fee, the order's own for whatever that lacks.
    shipping: incVat
      ? feeOf(
          shipping?.feeIncVat ?? shippingFee?.sellingPriceIncVat,
          shipping?.feeIncVatFormatted ??
            shippingFee?.sellingPriceIncVatFormatted,
        )
      : feeOf(
          shipping?.feeExVat ?? shippingFee?.sellingPriceExVat,
          shipping?.feeExVatFormatted ??
            shippingFee?.sellingPriceExVatFormatted,
        ),
    paymentFee: incVat
      ? feeOf(
          paymentFee?.sellingPriceIncVat,
          paymentFee?.sellingPriceIncVatFormatted,
        )
      : feeOf(
          paymentFee?.sellingPriceExVat,
          paymentFee?.sellingPriceExVatFormatted,
        ),
    tax:
      summary?.total?.vatFormatted ??
      order?.vat?.sellingPriceIncVatFormatted ??
      undefined,
    total: sideOf(summary?.total, incVat) ?? sideOf(order?.orderTotal, incVat),
    totalIncVat: incVat
      ? undefined
      : (incOf(summary?.total) ?? incOf(order?.orderTotal)),
  };
}

/**
 * The order's rows, as the desktop table and the mobile sheet render them.
 * `replayHrefOf` gives a configured row's replay link from its canonical path
 * and position, or undefined to fall back to the product page.
 */
export function orderRows(
  order: OrderDetailType | null | undefined,
  incVat: boolean,
  replayHrefOf: (
    canonical: string | null | undefined,
    index: number,
  ) => string | undefined,
): PortalItemRow[] {
  return (order?.cart?.items ?? []).map((item, index) => ({
    // By position: two rows of an order can carry one SKU.
    key: `row-${index}`,
    name: item.product?.name ?? '',
    articleNumber: item.product?.articleNumber ?? undefined,
    quantity: item.quantity ?? 0,
    unitPriceFormatted: sideOf(item.unitPrice, incVat),
    totalPriceFormatted: sideOf(item.totalPrice, incVat),
    imageFileName: item.product?.productImages?.[0]?.fileName ?? null,
    alias: item.product?.alias ?? null,
    href: item.configuration
      ? replayHrefOf(item.product?.canonicalUrl, index)
      : undefined,
    configuration: item.configuration,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
  }));
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

/** The totals under the rows in the mobile sheet, in the summary's order. */
export function orderTotalRows(
  amounts: OrderAmounts,
  itemCount: number,
  incVat: boolean,
  t: Translate,
): PortalItemTotal[] {
  const rows: PortalItemTotal[] = [
    {
      label: t('portal.orders.detail.summary.subtotal_with_count', {
        count: itemCount,
      }),
      value: amounts.subtotal,
    },
  ];
  if (amounts.shipping) {
    rows.push({
      label: t('portal.orders.detail.summary.shipping'),
      value: amounts.shipping,
    });
  }
  if (amounts.paymentFee) {
    rows.push({ label: t('common.payment_fee'), value: amounts.paymentFee });
  }
  rows.push(
    {
      label: t(incVat ? 'common.vat_included' : 'common.vat'),
      value: amounts.tax,
    },
    {
      label: t('portal.orders.detail.summary.total'),
      value: amounts.total,
      emphasis: true,
    },
  );
  if (amounts.totalIncVat) {
    rows.push({ label: t('common.total_inc_vat'), value: amounts.totalIncVat });
  }
  return rows;
}
