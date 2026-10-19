import {
  formatPrice,
  type OrderDetailItem,
  type OrderDetailType,
} from '#shared/types/commerce';
import type { PortalItemRow, PortalItemTotal } from '#shared/types/portal-rows';
import { feeOf } from '~/utils/fee';

/** An order's summary amounts, formatted, on one side of the VAT choice. */
export interface OrderAmounts {
  subtotal?: string;
  /** Only when the order carries a shipping fee. */
  shipping?: string;
  /** Only when the order carries a payment fee. */
  paymentFee?: string;
  /** The order-level discount, as a positive amount; only when > 0. */
  discount?: string;
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

/** Every amount the order page and the confirmation show, from the order. */
export function orderAmounts(
  order: OrderDetailType | null | undefined,
  incVat: boolean,
  locale?: string,
): OrderAmounts {
  const summary = order?.cart?.summary;
  const shipping = summary?.shipping;
  const shippingFee = order?.shippingFee;
  const paymentFee = order?.paymentFee;
  // The cart's own field, as the cart and checkout read it. A number only, so
  // it is formatted here, in the order's currency.
  const discount =
    (incVat
      ? summary?.fixedAmountDiscountIncVat
      : summary?.fixedAmountDiscountExVat) ?? 0;
  return {
    subtotal: sideOf(summary?.subTotal, incVat),
    // The cart summary's fee, the order's own for whatever that lacks. No fee
    // means no row: a placed order has no "may apply".
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
    discount:
      discount > 0
        ? formatPrice(
            discount,
            summary?.total?.currency?.code ?? order?.currency,
            locale,
          )
        : undefined,
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
 * The ordered SKU's name, where it tells the row apart from its product. The
 * order's product carries only the ordered SKU, its id a string.
 */
function skuNameOf(item: OrderDetailItem): string | undefined {
  if (item.configuration) return undefined;
  const sku = item.product?.skus?.find(
    (s) => String(s.skuId) === String(item.skuId),
  );
  const name = sku?.name?.trim();
  return name && name !== item.product?.name ? name : undefined;
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
    skuName: skuNameOf(item),
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
  /** The inc-VAT line's text: each page words it its own way. */
  totalIncVatLabel: string,
): PortalItemTotal[] {
  const rows: PortalItemTotal[] = [
    {
      label: t('portal.orders.detail.summary.subtotal_with_count', {
        count: itemCount,
      }),
      value: amounts.subtotal,
    },
  ];
  // As the cart orders them: the discount right after the subtotal.
  if (amounts.discount) {
    rows.push({ label: t('discount.discount'), value: `-${amounts.discount}` });
  }
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
    rows.push({ label: totalIncVatLabel, value: amounts.totalIncVat });
  }
  return rows;
}

/** How the order says it was paid, or undefined when it does not. */
export function orderPaymentLabel(order: OrderDetailType): string | undefined {
  const payment = order.paymentDetails?.[0];
  return payment?.displayName?.trim() || payment?.name?.trim() || undefined;
}
