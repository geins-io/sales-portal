import type { OrderSummaryType } from '@geins/types';
import { OrderError } from '@geins/core';
import type { H3Event } from 'h3';
import type { OrderListItem } from '#shared/types/commerce';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { getCompany } from './company';

export async function getOrder(
  args: { publicOrderId: string; checkoutMarketId?: string },
  event: H3Event,
): Promise<OrderSummaryType | undefined> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.order.get(args, requestContext),
    'order',
    OrderError,
  );
}

export async function listOrders(
  event: H3Event,
): Promise<{ orders: OrderListItem[]; total: number }> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  // Pulls orders and the company buyer roster in parallel. The Geins
  // OrderType carries the placing buyer's numeric customerId, which
  // matches CompanyBuyer.internalId. We join on that first because the
  // identifier is per-order and reliable; customerEmail is kept as a
  // secondary fallback for orders predating the customerId rollout.
  // Unresolved rows stay null so the table renders a dash rather than
  // the billing contact (which would mislead the viewer into thinking
  // that person placed the order).
  const [orderResult, company] = await Promise.all([
    wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString: loadQuery('orders/orders-list.graphql'),
          variables: {
            ...getRequestChannelVariables(sdk, event),
          },
          userToken: requestContext?.userToken,
        }),
      'order',
      OrderError,
    ),
    getCompany(event).catch(() => null),
  ]);
  const orders = (unwrapGraphQL(orderResult) as OrderListItem[] | null) ?? [];
  const nameByInternalId = new Map<string, string>();
  const nameByEmail = new Map<string, string>();
  for (const buyer of company?.buyers ?? []) {
    const name = [buyer.firstName, buyer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!name) continue;
    if (buyer.internalId) nameByInternalId.set(String(buyer.internalId), name);
    if (buyer.id) nameByEmail.set(buyer.id.toLowerCase(), name);
  }
  const enriched = orders.map((order) => {
    const internalId =
      order.customerId !== undefined && order.customerId !== null
        ? String(order.customerId)
        : null;
    const email = order.customerEmail?.toLowerCase();
    const placedBy =
      (internalId && nameByInternalId.get(internalId)) ||
      (email && nameByEmail.get(email)) ||
      null;
    return { ...order, placedBy };
  });
  return { orders: enriched, total: enriched.length };
}
