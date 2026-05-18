import type { H3Event } from 'h3';
import { OrderError } from '@geins/core';
import type { PurchasedProduct } from '#shared/types/commerce';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

interface RawOrder {
  id?: number | string | null;
  publicId?: string | null;
  createdAt?: string | null;
  billingAddress?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  cart?: {
    items?: RawOrderItem[] | null;
  } | null;
}

interface RawOrderItem {
  quantity?: number | null;
  unitPrice?: {
    sellingPriceExVat?: number | null;
    sellingPriceExVatFormatted?: string | null;
  } | null;
  product?: {
    articleNumber?: string | null;
    name?: string | null;
    alias?: string | null;
    productImages?: Array<{ fileName?: string | null } | null> | null;
  } | null;
}

/**
 * Derives the "purchased products" list for the authenticated user.
 *
 * Uses a dedicated lean GraphQL query instead of `crm.user.orders.get()`. The
 * SDK's `UserOrders` query asks for the full Cart fragment plus shipping and
 * refund subtrees; a single broken subfield silently nulls the whole
 * `getOrders` response on staging Geins. Asking only for what the derivation
 * needs keeps this resilient against the wider PIM surface.
 */
export async function getPurchasedProducts(
  event: H3Event,
): Promise<{ products: PurchasedProduct[]; total: number }> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);

  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('orders/purchased-products.graphql'),
        variables: {
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: requestContext?.userToken,
      }),
    'order',
    OrderError,
  );

  const orders = (unwrapGraphQL(result) as RawOrder[] | null) ?? [];
  if (!orders.length) return { products: [], total: 0 };

  const productMap = new Map<
    string,
    PurchasedProduct & { _latestTime: number }
  >();

  for (const order of orders) {
    const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    const orderId = String(order.id ?? '');
    const orderPublicId = order.publicId ?? null;
    const orderDate = order.createdAt ?? '';

    const buyerName = [
      order.billingAddress?.firstName ?? '',
      order.billingAddress?.lastName ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    const items = order.cart?.items;
    if (!items?.length) continue;

    for (const item of items) {
      const articleNumber = item.product?.articleNumber;
      if (!articleNumber) continue;

      const name = item.product?.name ?? '';
      const alias = item.product?.alias ?? null;
      const imageFileName = item.product?.productImages?.[0]?.fileName ?? null;
      const quantity = item.quantity ?? 0;
      const priceExVat = item.unitPrice?.sellingPriceExVat ?? 0;
      const priceExVatFormatted =
        item.unitPrice?.sellingPriceExVatFormatted ?? undefined;

      const existing = productMap.get(articleNumber);

      if (!existing) {
        productMap.set(articleNumber, {
          name,
          articleNumber,
          alias,
          imageFileName,
          priceExVat,
          priceExVatFormatted,
          totalQuantity: quantity,
          latestOrderDate: orderDate,
          latestOrderId: orderId,
          latestOrderPublicId: orderPublicId,
          latestBuyerName: buyerName,
          _latestTime: orderTime,
        });
      } else {
        existing.totalQuantity += quantity;

        if (orderTime > existing._latestTime) {
          existing._latestTime = orderTime;
          existing.latestOrderDate = orderDate;
          existing.latestOrderId = orderId;
          existing.latestOrderPublicId = orderPublicId;
          existing.latestBuyerName = buyerName;
          existing.priceExVat = priceExVat;
          existing.priceExVatFormatted = priceExVatFormatted;
        }
        if (!existing.alias && alias) existing.alias = alias;
        if (!existing.imageFileName && imageFileName)
          existing.imageFileName = imageFileName;
      }
    }
  }

  const products = [...productMap.values()]
    .sort((a, b) => b._latestTime - a._latestTime)
    .map(({ _latestTime: _, ...product }) => product);

  return { products, total: products.length };
}
