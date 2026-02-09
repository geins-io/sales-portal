import type { OrderSummaryType } from '@geins/types';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';

export async function getOrder(
  args: { publicOrderId: string; checkoutMarketId?: string },
  event: H3Event,
): Promise<OrderSummaryType | undefined> {
  const { oms } = await getTenantSDK(event);
  return oms.order.get(args);
}
