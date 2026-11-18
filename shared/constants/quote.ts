/** The longest name a quotation request may have. */
export const QUOTE_NAME_MAX_LENGTH = 80;
/** The most lines one write to a draft may carry. */
export const QUOTE_REQUEST_MAX_LINES = 200;
/** The most of one product a draft line may ask for. */
export const QUOTE_LINE_MAX_QUANTITY = 9999;
/** The longest message to the seller; Geins' own limit. */
export const QUOTE_MESSAGE_MAX_LENGTH = 4000;
/** The longest search Geins takes on the quotation list. */
export const QUOTE_SEARCH_MAX_LENGTH = 200;
/** The most quotations one read may ask Geins for. */
export const QUOTE_LIST_MAX_TAKE = 100;
/** Rows on one page of the quotation list. */
export const QUOTE_LIST_PAGE_SIZE = 20;

/** The quotation list's tabs, in the order they show. */
export const QUOTE_LIST_FILTERS = [
  'all',
  'drafts',
  'requests',
  'quotations',
] as const;

export type QuoteListFilter = (typeof QUOTE_LIST_FILTERS)[number];
