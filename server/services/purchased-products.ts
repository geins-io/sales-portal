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
import { getCompany } from './company';

interface RawOrder {
  id?: number | string | null;
  publicId?: string | null;
  createdAt?: string | null;
  customerEmail?: string | null;
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
 * Derives the "purchased products" list for the buyer's company.
 *
 * Built from `getCompanyOrders` (the company-wide order history, the same root
 * field the portal Orders list uses) rather than `getOrders`, which only
 * returns the signed-in user's personal orders and is therefore empty for a
 * buyer who never personally placed an order. The page is explicitly "products
 * your company has purchased", so it must aggregate across every company order.
 *
 * Uses a dedicated lean GraphQL query rather than the SDK's full order
 * fragment: that fragment pulls shipping and refund subtrees, and a single
 * broken subfield silently nulls the whole response on staging Geins. Asking
 * only for the fields the derivation needs keeps this resilient.
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

  // Resolve the actual orderer's name. The order exposes customerEmail (who
  // placed it), not a buyer name, so match it against the company buyers list
  // (buyer.id is the email) the same way checkout resolves the active buyer.
  const company = await getCompany(event);
  const buyerNameByEmail = new Map<string, string>();
  for (const buyer of company?.buyers ?? []) {
    const fullName = [buyer.firstName, buyer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (buyer.id && fullName) {
      buyerNameByEmail.set(buyer.id.trim().toLowerCase(), fullName);
    }
  }

  const productMap = new Map<
    string,
    PurchasedProduct & { _latestTime: number }
  >();

  for (const order of orders) {
    const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    const orderId = String(order.id ?? '');
    const orderPublicId = order.publicId ?? null;
    const orderDate = order.createdAt ?? '';

    // Prefer the orderer resolved from customerEmail. Fall back to the raw
    // email when the buyer has since left the company, and only to the
    // billing-address name when the order carries no customerEmail at all.
    const orderEmail = order.customerEmail?.trim().toLowerCase();
    const billingName = [
      order.billingAddress?.firstName ?? '',
      order.billingAddress?.lastName ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    const buyerName =
      (orderEmail ? buyerNameByEmail.get(orderEmail) : undefined) ??
      (order.customerEmail || billingName);

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
