import type { H3Event } from 'h3';
import type { Quote, QuoteLineItem, QuoteListItem } from '#shared/types/quote';
import {
  createQuoteStub,
  listQuotesStub,
  getQuoteStub,
  acceptQuoteStub,
  rejectQuoteStub,
} from './stubs/quotes';

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API — POST /quotes */
export async function createQuote(
  orgId: string,
  createdBy: string,
  contactName: string,
  contactEmail: string,
  lineItems: QuoteLineItem[],
  message: string | undefined,
  poNumber: string | undefined,
  paymentTerms: string | undefined,
  _event: H3Event,
): Promise<Quote> {
  return createQuoteStub(
    orgId,
    createdBy,
    contactName,
    contactEmail,
    lineItems,
    message,
    poNumber,
    paymentTerms,
  );
}

/** TODO: Replace stub with Geins API — GET /quotes */
export async function listQuotes(
  orgId: string,
  skip: number | undefined,
  take: number | undefined,
  _event: H3Event,
): Promise<{ quotes: QuoteListItem[]; total: number }> {
  return listQuotesStub(orgId, skip, take);
}

/** TODO: Replace stub with Geins API — GET /quotes/{id} */
export async function getQuote(
  quoteId: string,
  _event: H3Event,
): Promise<Quote> {
  return getQuoteStub(quoteId);
}

/** TODO: Replace stub with Geins API — POST /quotes/{id}/accept */
export async function acceptQuote(
  quoteId: string,
  _event: H3Event,
): Promise<Quote> {
  return acceptQuoteStub(quoteId);
}

/** TODO: Replace stub with Geins API — POST /quotes/{id}/reject */
export async function rejectQuote(
  quoteId: string,
  reason: string | undefined,
  _event: H3Event,
): Promise<Quote> {
  return rejectQuoteStub(quoteId, reason);
}
