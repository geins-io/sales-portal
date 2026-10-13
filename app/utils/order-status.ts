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

/**
 * Display label for an order status. A status without a locale key is shown
 * as readable text ("on-hold" → "On hold") rather than a key path.
 */
export function getOrderStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
): string {
  const normalized = (status ?? '').toLowerCase();
  if ((ORDER_STATUSES as readonly string[]).includes(normalized)) {
    return t(`portal.orders.status.${normalized.replace(/-/g, '_')}`);
  }
  const words = normalized.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Tailwind class string for the order status pill.
 *
 * Theme-aware where possible: success follows tenant `--primary`, error
 * follows `--destructive`, neutral follows `--muted`. In-flight states
 * (processing, shipped) keep hardcoded amber/indigo because the design
 * system has no warning/info tokens.
 */
export function getOrderStatusPillClass(status?: string): string {
  switch ((status ?? '').toLowerCase()) {
    case 'placed':
      return 'bg-muted text-muted-foreground';
    case 'processing':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'shipped':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'delivered':
    case 'completed':
      return 'bg-primary/10 text-primary';
    case 'cancelled':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
