import type { QuoteStatus } from '#shared/types/quote';

/**
 * Tailwind class string for the quote status pill.
 *
 * Theme-aware where possible: success follows tenant `--primary`, error
 * follows `--destructive`, neutral follows `--muted`. Expired keeps a
 * hardcoded orange because the design system has no warning token.
 */
export function getQuoteStatusPillClass(status: QuoteStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-muted text-muted-foreground';
    case 'accepted':
      return 'bg-primary/10 text-primary';
    case 'rejected':
    case 'cancelled':
      return 'bg-destructive/10 text-destructive';
    case 'expired':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  }
}
