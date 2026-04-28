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
