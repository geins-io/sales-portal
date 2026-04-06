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
  const result = await wrapServiceCall(
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
  );
  const orders = (unwrapGraphQL(result) as OrderListItem[] | null) ?? [];
  return { orders, total: orders.length };
}
