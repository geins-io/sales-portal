import type { QuoteStatus } from '#shared/types/quote';

/**
 * Tailwind class string for the quote status pill.
 *
 * Shared between the portal quotations list and detail pages so both views
 * render identical colors for the same status. The five statuses each get a
 * distinct palette; changing the QuoteStatus union will surface an
 * exhaustiveness error here at compile time.
 */
export function getQuoteStatusPillClass(status: QuoteStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    case 'accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'expired':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'cancelled':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
  }
}
