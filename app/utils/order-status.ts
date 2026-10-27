import type { BadgeVariant } from '~/components/ui/badge';

/**
 * Order statuses with a label under `portal.orders.status`. The first eight
 * are what Geins lists at `/API/Order/Statuses`; the last four predate that
 * list and are kept for accounts not yet read.
 */
export const ORDER_STATUSES = [
  'cancelled',
  'on-hold',
  'inactive',
  'refunded',
  'partial',
  'backorder',
  'completed',
  'pending',
  'placed',
  'delivered',
  'processing',
  'shipped',
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

function isOrderStatus(status: string): status is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Display label for an order status. A status without a locale key is shown
 * as readable text ("on-hold" → "On hold") rather than a key path.
 */
export function getOrderStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
): string {
  const normalized = (status ?? '').toLowerCase();
  if (isOrderStatus(normalized)) {
    return t(`portal.orders.status.${normalized.replace(/-/g, '_')}`);
  }
  const words = normalized.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Badge tone per order status, read by the order list and the order page.
 */
export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  placed: 'neutral',
  pending: 'neutral',
  refunded: 'neutral',
  inactive: 'neutral',
  processing: 'info',
  shipped: 'info',
  partial: 'info',
  delivered: 'success-solid',
  completed: 'success-solid',
  'on-hold': 'warning',
  backorder: 'warning',
  cancelled: 'destructive-soft',
};

/** Badge variant for an order status; an unknown status is neutral. */
export function getOrderStatusVariant(
  status: string | null | undefined,
): BadgeVariant {
  const normalized = (status ?? '').toLowerCase();
  return isOrderStatus(normalized)
    ? ORDER_STATUS_VARIANT[normalized]
    : 'neutral';
}
