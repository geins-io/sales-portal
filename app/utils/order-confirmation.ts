import type { PriceType } from '@geins/types';
import type {
  ConfirmationOrder,
  OrderDetailType,
} from '#shared/types/commerce';

/**
 * An order, as the confirmation page renders it.
 *
 * The page was built on Geins's checkout summary, which never carries an order
 * placed through our own checkout. The order the portal reads has everything
 * the page shows, so it is mapped onto the summary's shape and the page keeps
 * its template. Each amount comes from the field the order detail page reads,
 * so the two pages always show the same numbers.
 */
export function orderToConfirmation(order: OrderDetailType): ConfirmationOrder {
  const summary = order.cart?.summary;
  // Field by field, as the order detail page falls back side by side: the
  // cart summary's figure where it has one, the order total for the rest.
  const total = <K extends keyof PriceType>(field: K): PriceType[K] =>
    summary?.total?.[field] ?? order.orderTotal?.[field];

  return {
    orderId: order.id,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    rows: (order.cart?.items ?? []).map((item) => ({
      name: item.product?.name,
      product: { name: item.product?.name },
      articleNumber: item.product?.articleNumber,
      skuId: item.skuId == null ? undefined : String(item.skuId),
      quantity: item.quantity,
      price: {
        priceIncVat: item.unitPrice?.sellingPriceIncVat,
        priceIncVatFormatted: item.unitPrice?.sellingPriceIncVatFormatted,
        priceExVat: item.unitPrice?.sellingPriceExVat,
        priceExVatFormatted: item.unitPrice?.sellingPriceExVatFormatted,
      },
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      configuration: item.configuration,
    })),
    total: {
      itemValueIncVat: summary?.subTotal?.sellingPriceIncVat,
      itemValueIncVatFormatted: summary?.subTotal?.sellingPriceIncVatFormatted,
      itemValueExVat: summary?.subTotal?.sellingPriceExVat,
      itemValueExVatFormatted: summary?.subTotal?.sellingPriceExVatFormatted,
      // The charged amount is the inc-VAT total.
      sum: total('sellingPriceIncVat'),
      sumFormatted: total('sellingPriceIncVatFormatted'),
      orderValueIncVat: total('sellingPriceIncVat'),
      orderValueIncVatFormatted: total('sellingPriceIncVatFormatted'),
      orderValueExVat: total('sellingPriceExVat'),
      orderValueExVatFormatted: total('sellingPriceExVatFormatted'),
      // Shipping as the order page reads it: the cart summary's fee, the
      // order's own for whatever that lacks.
      shippingFeeIncVat:
        summary?.shipping?.feeIncVat ?? order.shippingFee?.sellingPriceIncVat,
      shippingFeeIncVatFormatted:
        summary?.shipping?.feeIncVatFormatted ??
        order.shippingFee?.sellingPriceIncVatFormatted,
      shippingFeeExVat:
        summary?.shipping?.feeExVat ?? order.shippingFee?.sellingPriceExVat,
      shippingFeeExVatFormatted:
        summary?.shipping?.feeExVatFormatted ??
        order.shippingFee?.sellingPriceExVatFormatted,
      paymentFeeIncVat: order.paymentFee?.sellingPriceIncVat,
      paymentFeeIncVatFormatted: order.paymentFee?.sellingPriceIncVatFormatted,
      paymentFeeExVat: order.paymentFee?.sellingPriceExVat,
      paymentFeeExVatFormatted: order.paymentFee?.sellingPriceExVatFormatted,
      discountIncVat: order.discount?.sellingPriceIncVat,
      discountIncVatFormatted: order.discount?.sellingPriceIncVatFormatted,
      discountExVat: order.discount?.sellingPriceExVat,
      discountExVatFormatted: order.discount?.sellingPriceExVatFormatted,
      vatFormatted:
        summary?.total?.vatFormatted ?? order.vat?.sellingPriceIncVatFormatted,
      currency: order.currency,
    },
  };
}

/** How the order says it was paid, or undefined when it does not. */
export function orderPaymentLabel(order: OrderDetailType): string | undefined {
  const payment = order.paymentDetails?.[0];
  return payment?.displayName?.trim() || payment?.name?.trim() || undefined;
}
