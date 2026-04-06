import type { H3Event } from 'h3';
import type { PurchasedProduct } from '#shared/types/commerce';
import * as userService from './user';

export async function getPurchasedProducts(
  authToken: string,
  event: H3Event,
): Promise<{ products: PurchasedProduct[]; total: number }> {
  const ordersData = await userService.getUserOrders(authToken, event);
  const orders = ordersData?.getOrders;

  if (!orders?.length) {
    return { products: [], total: 0 };
  }

  const productMap = new Map<
    string,
    PurchasedProduct & { _latestTime: number }
  >();

  for (const order of orders) {
    if (!order) continue;

    const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    const orderId = String(order.id ?? '');
    const orderDate = order.createdAt ?? '';

    const firstName = order.billingAddress?.firstName ?? '';
    const lastName = order.billingAddress?.lastName ?? '';
    const buyerName = [firstName, lastName].filter(Boolean).join(' ');

    const items = order.cart?.items;
    if (!items?.length) continue;

    for (const item of items) {
      if (!item) continue;

      const articleNumber = item.product?.articleNumber;
      if (!articleNumber) continue;

      const name = item.product?.name ?? '';
      const quantity = item.quantity ?? 0;
      const priceExVat = item.unitPrice?.sellingPriceExVat ?? 0;
      const priceExVatFormatted =
        item.unitPrice?.sellingPriceExVatFormatted ?? undefined;

      const existing = productMap.get(articleNumber);

      if (!existing) {
        productMap.set(articleNumber, {
          name,
          articleNumber,
          priceExVat,
          priceExVatFormatted,
          totalQuantity: quantity,
          latestOrderDate: orderDate,
          latestOrderId: orderId,
          latestBuyerName: buyerName,
          _latestTime: orderTime,
        });
      } else {
        existing.totalQuantity += quantity;

        if (orderTime > existing._latestTime) {
          existing._latestTime = orderTime;
          existing.latestOrderDate = orderDate;
          existing.latestOrderId = orderId;
          existing.latestBuyerName = buyerName;
          existing.priceExVat = priceExVat;
          existing.priceExVatFormatted = priceExVatFormatted;
        }
      }
    }
  }

  const products = [...productMap.values()]
    .sort((a, b) => b._latestTime - a._latestTime)
    .map(({ _latestTime: _, ...product }) => product);

  return { products, total: products.length };
}
