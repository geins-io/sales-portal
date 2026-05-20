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
  // Pulls orders and the company buyer roster in parallel. Geins's
  // OrderType.customerEmail carries the placing buyer's email;
  // CompanyBuyer.id is also the email, so we join on it to resolve
  // firstName/lastName. Falls back to billingAddress on the table
  // side when the email isn't on the roster (e.g. ex-employee).
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
  const nameByEmail = new Map<string, string>();
  for (const buyer of company?.buyers ?? []) {
    if (!buyer.id) continue;
    const name = [buyer.firstName, buyer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (name) nameByEmail.set(buyer.id.toLowerCase(), name);
  }
  const enriched = orders.map((order) => {
    const email = order.customerEmail?.toLowerCase();
    const placedBy = email ? (nameByEmail.get(email) ?? null) : null;
    return { ...order, placedBy };
  });
  return { orders: enriched, total: enriched.length };
}
