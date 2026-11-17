import type { H3Event } from 'h3';
import { H3Error } from 'h3';
import type {
  QuoteStatus,
  QuoteThread,
  QuoteThreadEntry,
  QuoteThreadEvent,
  QuoteThreadEventType,
} from '#shared/types/quote';
import type { QuoteMessageInput } from '../schemas/api-input';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { getQuote } from './quotes';
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
  /** Geins still lets the buyer change it: no seller reply names it. */
  editable?: boolean | null;
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

/**
 * Marks the buyer's own messages they may still delete: Geins allows it, and
 * nothing has happened after it. Geins locks a message only when the seller
 * replies to it; here any later seller entry or event locks it.
 */
function markDeletable(
  entries: QuoteThreadEntry[],
  editable: Set<string>,
): QuoteThreadEntry[] {
  let locked = false;
  const marked = [...entries];
  for (let i = marked.length - 1; i >= 0; i--) {
    const entry = marked[i]!;
    if (entry.side === 'seller' || entry.event) {
      locked = true;
    } else if (!locked && entry.text && editable.has(entry.id)) {
      marked[i] = { ...entry, deletable: true };
    }
  }
  return marked;
}

/** The quotation's messages as the buyer reads them, oldest first. */
export function buildQuoteThread(messages: RawQuotationMessage[]): QuoteThread {
  const entries = markDeletable(
    oldestFirst(entriesFromMessages(messages)),
    new Set(messages.filter((m) => m.editable).map((m) => m.id)),
  );
  return {
    entries,
    messageCount: entries.filter((e) => e.text).length,
  };
}

/**
 * A log call that Geins fails answers 404 when the buyer cannot read the
 * quotation either, as the quotation itself does; any other failure stands.
 */
async function onReadableQuote<T>(
  quoteId: string,
  event: H3Event,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    await getQuote(quoteId, event).catch((readError: unknown) => {
      if (readError instanceof H3Error && readError.statusCode === 404) {
        throw readError;
      }
    });
    throw error;
  }
}

/** The thread of a quotation the signed-in buyer can read. */
export async function getQuoteThread(
  quoteId: string,
  event: H3Event,
): Promise<QuoteThread> {
  const sdk = await getTenantSDK(event);
  const result = await onReadableQuote(quoteId, event, () =>
    wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString: loadQuery('quotes/quotation-messages.graphql'),
          variables: { quotationId: quoteId },
          userToken: buildRequestContext(event)?.userToken,
        }),
      'quotes',
    ),
  );
  return buildQuoteThread(
    (unwrapGraphQL(result) as RawQuotationMessage[] | null) ?? [],
  );
}

/** Write a message in the quotation's thread as the signed-in buyer. */
export async function createQuoteMessage(
  quoteId: string,
  input: QuoteMessageInput,
  event: H3Event,
): Promise<{ id: string }> {
  const sdk = await getTenantSDK(event);
  const result = await onReadableQuote(quoteId, event, () =>
    wrapServiceCall(
      () =>
        sdk.core.graphql.mutation({
          queryAsString: loadQuery('quotes/create-quotation-message.graphql'),
          variables: {
            quotationId: quoteId,
            message: input.message,
            ...(input.answerRef ? { answerRef: input.answerRef } : {}),
            ...getRequestChannelVariables(sdk, event),
          },
          userToken: buildRequestContext(event)?.userToken,
          // No timeout: a message Geins saves after a cut would read as failed.
          requestOptions: { context: { timeoutMs: 0 } },
        }),
      'quotes',
    ),
  );
  const created = unwrapGraphQL(result) as { id?: string } | null;
  if (!created?.id) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `Geins answered no message for quote ${quoteId}`,
    );
  }
  return { id: created.id };
}

/**
 * Delete a message of the signed-in buyer's. The thread is read again first,
 * so a message the seller has answered or an event has followed is refused
 * here, not only hidden in the page.
 */
export async function deleteQuoteMessage(
  quoteId: string,
  messageId: string,
  event: H3Event,
): Promise<void> {
  const { entries } = await getQuoteThread(quoteId, event);
  const entry = entries.find((e) => e.id === messageId);
  if (!entry) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `No message ${messageId} on quote ${quoteId}`,
    );
  }
  if (!entry.deletable) {
    throw createAppError(
      ErrorCode.CONFLICT,
      `Message ${messageId} on quote ${quoteId} can no longer be deleted`,
    );
  }
  const sdk = await getTenantSDK(event);
  const result = await onReadableQuote(quoteId, event, () =>
    wrapServiceCall(
      () =>
        sdk.core.graphql.mutation({
          queryAsString: loadQuery('quotes/delete-quotation-message.graphql'),
          variables: {
            quotationId: quoteId,
            messageId,
            ...getRequestChannelVariables(sdk, event),
          },
          userToken: buildRequestContext(event)?.userToken,
          // No timeout: a delete Geins makes after a cut would read as failed.
          requestOptions: { context: { timeoutMs: 0 } },
        }),
      'quotes',
    ),
  );
  if (unwrapGraphQL(result) !== true) {
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `Geins deleted no message ${messageId} on quote ${quoteId}`,
    );
  }
}
