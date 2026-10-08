import type {
  CartItemType as SdkCartItemType,
  OrderSummaryType,
} from '@geins/types';
import { OrderError } from '@geins/core';
import type { H3Event } from 'h3';
import type {
  OrderDetailItem,
  OrderDetailType,
  OrderLineRead,
  OrderListItem,
} from '#shared/types/commerce';
import { logger } from '../utils/logger';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { getCompany } from './company';
import type { ConfigurableCandidate } from './configurator';
import {
  buildConfiguratorRequestContext,
  configurableCheck,
  getConfiguratorBackend,
} from './configurator';

/**
 * Never throws. A failed read answers null, unlike a backend with nothing to
 * read (an empty map): the rows then render without a configuration, and the
 * order cannot say which of them are configurable.
 */
async function orderLineConfigurations(
  publicOrderId: string,
  event: H3Event,
): Promise<Map<number, OrderLineRead> | null> {
  try {
    return await getConfiguratorBackend(event).orderLineConfigurations(
      publicOrderId,
      await buildConfiguratorRequestContext(event),
    );
  } catch {
    logger.warn('[configurator] order line configurations unavailable');
    return null;
  }
}

/**
 * Puts each row's configuration and configurable flag on it, by position, and
 * only when that row is the product the line was read for: a wrong summary on
 * a row is worse than none. Without a read, or with a read that misses a row,
 * reorder cannot tell which rows to leave out, so the order is not
 * reorderable. A backend with nothing to read answers no rows at all.
 */
export function withOrderLineConfigurations(
  order: OrderSummaryType,
  lines: Map<number, OrderLineRead> | null,
  isConfigurable: (product: ConfigurableCandidate) => boolean,
): OrderDetailType {
  const { cart } = order;
  let unmatched = false;
  const toRow = (row: SdkCartItemType, position: number): OrderDetailItem => {
    if (!row) return row;
    // An order read selects no configuration; the cpq read is the only one.
    const { configurationId: _id, configuration: _none, ...item } = row;
    if (!item.product || item.product.productId == null) return item;
    const productId = String(item.product.productId);
    const read = lines?.get(position);
    const line =
      read && String(read.productId) === productId ? read : undefined;
    if (!line) unmatched = true;
    const configurable = isConfigurable({
      productId,
      type: line?.type ?? null,
    });
    return {
      ...item,
      ...(configurable
        ? { product: { ...item.product, configurable: true as const } }
        : {}),
      ...(line?.configuration
        ? { configuration: { summary: line.configuration.summary } }
        : {}),
    };
  };
  // A cart or its rows the SDK answered null for stay null.
  const detail = cart && {
    ...cart,
    items: cart.items && cart.items.map(toRow),
  };
  return {
    ...order,
    reorderable: lines !== null && !(lines.size > 0 && unmatched),
    cart: detail,
  };
}

export async function getOrder(
  args: { publicOrderId: string; checkoutMarketId?: string },
  event: H3Event,
): Promise<OrderDetailType | undefined> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const [order, lines] = await Promise.all([
    wrapServiceCall(
      () => oms.order.get(args, requestContext),
      'order',
      OrderError,
    ),
    orderLineConfigurations(args.publicOrderId, event),
  ]);
  return order
    ? withOrderLineConfigurations(order, lines, configurableCheck(event))
    : undefined;
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
