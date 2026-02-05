import type { OrderSummaryType } from '@geins/types';
import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';

export async function getOrder(
  args: { publicOrderId: string; checkoutMarketId?: string },
  event: H3Event,
): Promise<OrderSummaryType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.order.get(args);
}
