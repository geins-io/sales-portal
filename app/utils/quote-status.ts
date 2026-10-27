import type { QuoteStatus } from '#shared/types/quote';
import type { BadgeVariant } from '~/components/ui/badge';

/** Badge variant for a quote status. */
export function getQuoteStatusVariant(status: QuoteStatus): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'info';
    case 'accepted':
      return 'success';
    case 'rejected':
    case 'cancelled':
      return 'destructive-soft';
    case 'expired':
      return 'warning';
  }
}
