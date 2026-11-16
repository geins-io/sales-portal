import type { H3Event } from 'h3';
import type {
  QuoteStatus,
  QuoteThread,
  QuoteThreadEntry,
  QuoteThreadEvent,
  QuoteThreadEventType,
} from '#shared/types/quote';
import { getTenantSDK, buildRequestContext } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

/** `QuotationMessage` as the merchant API answers it. */
export interface RawQuotationMessage {
  id: string;
  type: string;
  authorName?: string | null;
  message?: string | null;
  timestamp: string;
  answerRef?: string | null;
  tags?: { key?: string | null; value?: string | null }[] | null;
}

const SIDE_OF_TYPE: Record<string, QuoteThreadEntry['side']> = {
  FROM_CUSTOMER: 'buyer',
  TO_CUSTOMER: 'seller',
};

/** The statuses a buyer sees; the seller's `draft` is not one of them. */
const STATUSES = new Set<QuoteStatus>([
  'request_draft',
  'requested',
  'pending',
  'accepted',
  'confirmed',
  'finalized',
  'rejected',
  'canceled',
  'expired',
]);

const EVENT_OF_STATUS: Partial<Record<QuoteStatus, QuoteThreadEventType>> = {
  requested: 'request_sent',
  pending: 'quote_sent',
  accepted: 'accepted',
  confirmed: 'confirmed',
  rejected: 'quote_rejected',
  finalized: 'ordered',
  canceled: 'canceled',
  expired: 'expired',
};

/** Actions whose new status alone does not say what happened. */
const EVENT_OF_ACTION: Record<string, QuoteThreadEventType> = {
  extend: 'extended',
};

function statusOf(value: string): QuoteStatus | undefined {
  const status = value.toLowerCase() as QuoteStatus;
  return STATUSES.has(status) ? status : undefined;
}

function tag(m: RawQuotationMessage, key: string): string | undefined {
  return m.tags?.find((t) => t.key === key)?.value || undefined;
}

/** The text a message carries, none when it is blank. */
function textOf(m: RawQuotationMessage): string | undefined {
  return m.message?.trim() ? m.message : undefined;
}

/** The status change a message was written with, when it names a known one. */
function eventOf(m: RawQuotationMessage): QuoteThreadEvent | undefined {
  const action = tag(m, 'action');
  const fromTag = tag(m, 'statusFrom');
  const toTag = tag(m, 'statusTo');
  if (!action || !fromTag || !toTag) return undefined;
  const from = statusOf(fromTag);
  const to = statusOf(toTag);
  let type =
    EVENT_OF_ACTION[action.toLowerCase()] ??
    (to ? EVENT_OF_STATUS[to] : undefined);
  if (!type) return undefined;
  if (type === 'quote_rejected') {
    const byBuyer = SIDE_OF_TYPE[m.type] === 'buyer';
    if (from === 'requested') type = byBuyer ? 'withdrawn' : 'request_rejected';
    else if (byBuyer) type = 'declined';
  }
  return { type, ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

/** Leaves out what is undefined, so an entry carries only what it has. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

/**
 * The request comment: the buyer's first message, unless it was written in
 * the thread (`source: chat`) or with a status change.
 */
function requestCommentOf(
  messages: RawQuotationMessage[],
): RawQuotationMessage | undefined {
  const first = messages
    .filter((m) => m.type === 'FROM_CUSTOMER')
    .reduce<RawQuotationMessage | undefined>(
      (earliest, m) =>
        !earliest || Date.parse(m.timestamp) < Date.parse(earliest.timestamp)
          ? m
          : earliest,
      undefined,
    );
  if (!first || eventOf(first) || tag(first, 'source') === 'chat') {
    return undefined;
  }
  return first;
}

/** Each message the buyer may see as an entry; a blank plain one is dropped. */
function entriesFromMessages(
  messages: RawQuotationMessage[],
): QuoteThreadEntry[] {
  const shown = messages.filter((m) => SIDE_OF_TYPE[m.type]);
  const byId = new Map(shown.map((m) => [m.id, m]));
  const comment = requestCommentOf(shown);
  const entries: QuoteThreadEntry[] = [];

  for (const m of shown) {
    const event: QuoteThreadEvent | undefined =
      m === comment
        ? { type: 'request_sent', from: 'request_draft', to: 'requested' }
        : eventOf(m);
    const text = textOf(m);
    if (!event && !text) continue;
    const parent = m.answerRef ? byId.get(m.answerRef) : undefined;
    entries.push(
      defined({
        id: m.id,
        at: m.timestamp,
        side: SIDE_OF_TYPE[m.type]!,
        authorName: m.authorName || undefined,
        text,
        event,
        replyTo: parent
          ? defined({
              authorName: parent.authorName || undefined,
              text: textOf(parent),
            })
          : undefined,
      }),
    );
  }
  return entries;
}

/** Oldest first; entries of the same instant keep their order. */
function oldestFirst(entries: QuoteThreadEntry[]): QuoteThreadEntry[] {
  return [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** The quotation's messages as the buyer reads them, oldest first. */
export function buildQuoteThread(messages: RawQuotationMessage[]): QuoteThread {
  const entries = oldestFirst(entriesFromMessages(messages));
  return {
    entries,
    messageCount: entries.filter((e) => e.text).length,
  };
}

/** The thread of a quotation the signed-in buyer can read. */
export async function getQuoteThread(
  quoteId: string,
  event: H3Event,
): Promise<QuoteThread> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('quotes/quotation-messages.graphql'),
        variables: { quotationId: quoteId },
        userToken: buildRequestContext(event)?.userToken,
      }),
    'quotes',
  );
  return buildQuoteThread(
    (unwrapGraphQL(result) as RawQuotationMessage[] | null) ?? [],
  );
}
