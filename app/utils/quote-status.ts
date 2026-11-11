import type { QuoteStatus } from '#shared/types/quote';
import type { BadgeVariant } from '~/components/ui/badge';

/** Badge variant and label key per quote status. */
export const QUOTE_STATUS_DISPLAY: Record<
  QuoteStatus,
  { variant: BadgeVariant; labelKey: string }
> = {
  request_draft: {
    variant: 'draft',
    labelKey: 'portal.quotations.status_request_draft',
  },
  requested: {
    variant: 'neutral',
    labelKey: 'portal.quotations.status_requested',
  },
  pending: { variant: 'info', labelKey: 'portal.quotations.status_pending' },
  accepted: {
    variant: 'success',
    labelKey: 'portal.quotations.status_accepted',
  },
  confirmed: {
    variant: 'success',
    labelKey: 'portal.quotations.status_confirmed',
  },
  finalized: {
    variant: 'success-solid',
    labelKey: 'portal.quotations.status_finalized',
  },
  rejected: {
    variant: 'destructive-soft',
    labelKey: 'portal.quotations.status_rejected',
  },
  canceled: {
    variant: 'destructive-soft',
    labelKey: 'portal.quotations.status_canceled',
  },
  expired: { variant: 'warning', labelKey: 'portal.quotations.status_expired' },
  unknown: { variant: 'neutral', labelKey: 'portal.quotations.status_unknown' },
};

/** Badge variant for a quote status. */
export function getQuoteStatusVariant(status: QuoteStatus): BadgeVariant {
  return QUOTE_STATUS_DISPLAY[status].variant;
}

/** i18n key of the label for a quote status. */
export function getQuoteStatusLabelKey(status: QuoteStatus): string {
  return QUOTE_STATUS_DISPLAY[status].labelKey;
}

/** The quotation list's tabs, in the order they show. */
export const QUOTE_LIST_FILTERS = [
  'all',
  'drafts',
  'requests',
  'quotations',
] as const;

export type QuoteListFilter = (typeof QUOTE_LIST_FILTERS)[number];

/** The tab a status belongs to, besides Alla. */
export function quoteFilterOf(
  status: QuoteStatus,
): Exclude<QuoteListFilter, 'all'> {
  if (status === 'request_draft') return 'drafts';
  if (status === 'requested') return 'requests';
  return 'quotations';
}

/** The sum is the list price until the seller has priced the quotation. */
export function isQuotePriceEstimate(status: QuoteStatus): boolean {
  return status === 'request_draft' || status === 'requested';
}
