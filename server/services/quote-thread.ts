import type { H3Event } from 'h3';
import { H3Error } from 'h3';
import type {
  QuoteStatus,
  QuoteThread,
  QuoteThreadEntry,
  QuoteThreadEvent,
  QuoteThreadEventType,
} from '#shared/types/quote';
import type { QuoteDisplayNumber } from '#shared/types/tenant-config';
import {
  versionNames,
  type QuoteVersionName,
} from '#shared/utils/quote-versions';
import type { QuoteMessageInput } from '../schemas/api-input';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { getQuote } from './quotes';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { logger } from '../utils/logger';

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
  /** The version it was written on. */
  quotationNumber?: string | null;
  tags?: { key?: string | null; value?: string | null }[] | null;
}

/** A version in the quotation's `revisions`: newest first, a request last. */
export interface RawQuotationRevision {
  quotationId: string;
  quotationNumber: string;
  /** Sent; none for the buyer's request. */
  validFrom?: string | null;
}

/** A row of the quotation's `statusHistory`, as the merchant API answers it. */
export interface RawQuotationStatusChange {
  timestamp: string;
  action: string;
  statusFrom?: string | null;
  statusTo: string;
  /** `CUSTOMER`, `SELLER`, `SYSTEM` or `EXTERNAL` (synced from Monitor). */
  actor: string;
  quotationNumber?: string | null;
}

interface RawPerson {
  firstName?: string | null;
  lastName?: string | null;
}

/** What the thread reads of the quotation beside its messages. */
export interface RawThreadQuotation {
  orderId?: string | null;
  customer?: RawPerson | null;
  statusHistory?: RawQuotationStatusChange[] | null;
  revisions?: RawQuotationRevision[] | null;
}

type Side = QuoteThreadEntry['side'];

const SIDE_OF_TYPE: Record<string, Side> = {
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

/** What a status change is called, when it names a known one. */
function nameEvent(
  action: string,
  fromValue: string | null | undefined,
  toValue: string,
  byBuyer: boolean,
): QuoteThreadEvent | undefined {
  const from = fromValue ? statusOf(fromValue) : undefined;
  const to = statusOf(toValue);
  let type =
    EVENT_OF_ACTION[action.toLowerCase()] ??
    (to ? EVENT_OF_STATUS[to] : undefined);
  if (!type) return undefined;
  if (type === 'quote_rejected') {
    if (from === 'requested') type = byBuyer ? 'withdrawn' : 'request_rejected';
    else if (byBuyer) type = 'declined';
  }
  return { type, ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

/** The status change a message was written with, when it names a known one. */
function eventOf(m: RawQuotationMessage): QuoteThreadEvent | undefined {
  const action = tag(m, 'action');
  const fromTag = tag(m, 'statusFrom');
  const toTag = tag(m, 'statusTo');
  if (!action || !fromTag || !toTag) return undefined;
  return nameEvent(action, fromTag, toTag, SIDE_OF_TYPE[m.type] === 'buyer');
}

interface HistoryEvent {
  index: number;
  row: RawQuotationStatusChange;
  at: number;
  side: Side;
  event: QuoteThreadEvent;
}

/**
 * The history rows the buyer sees, oldest first. A `revise` is never shown on
 * its own: it names the `send` of the new version after it, which answers a
 * request ("sent the quotation") or replaces a sent quotation ("sent a new
 * version").
 */
function eventsFromHistory(rows: RawQuotationStatusChange[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  let revise: RawQuotationStatusChange | undefined;
  const sorted = [...rows].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  sorted.forEach((row, index) => {
    const action = row.action.toLowerCase();
    if (action === 'revise') {
      revise = row;
      return;
    }
    const byBuyer = row.actor === 'CUSTOMER';
    let event = nameEvent(action, row.statusFrom, row.statusTo, byBuyer);
    if (action === 'send' && revise) {
      const from = statusOf(revise.statusFrom ?? '');
      revise = undefined;
      event = event && {
        ...event,
        type: from === 'requested' ? 'quote_sent' : 'revision_sent',
        ...(from ? { from } : {}),
      };
    }
    if (!event) return;
    // Monitor and Geins act for the seller; only expiry is nobody's doing.
    const side: Side = byBuyer
      ? 'buyer'
      : row.actor === 'SYSTEM' && event.type === 'expired'
        ? 'system'
        : 'seller';
    events.push({ index, row, at: Date.parse(row.timestamp), side, event });
  });
  return events;
}

/** Leaves out what is undefined, so an entry carries only what it has. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

function nameOf(person: RawPerson | null | undefined): string | undefined {
  return (
    [person?.firstName, person?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') || undefined
  );
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

/** A version's name by its number; none for a number it does not know. */
type VersionOf = (
  quotationNumber: string | null | undefined,
) => QuoteVersionName | undefined;

/**
 * Names each version by the number the store shows. With one version there
 * is nothing to tell apart, so it names none. Revisions carry no external
 * number, so with that choice an offer has none to show and is not named.
 */
function versionsByNumber(
  revisions: RawQuotationRevision[] | null | undefined,
  choice: QuoteDisplayNumber | undefined,
): VersionOf {
  const names = versionNames(
    revisions?.map((r) => ({
      quotationId: r.quotationId,
      quoteNumber: choice === 'externalNumber' ? '' : r.quotationNumber,
      validFrom: r.validFrom,
    })),
  );
  const byNumber = new Map<string, QuoteVersionName>();
  for (const r of names.size > 1 ? revisions! : []) {
    const name = names.get(r.quotationId)!;
    if (name.kind === 'request' || name.number) {
      byNumber.set(r.quotationNumber, name);
    }
  }
  return (quotationNumber) =>
    quotationNumber ? byNumber.get(quotationNumber) : undefined;
}

/**
 * Each message the buyer may see as an entry; a blank plain one is dropped.
 * A message written with a status change takes its history row's name: the
 * two share the instant and the new status. The history rows left over come
 * back in `unmatched`.
 */
function entriesFromMessages(
  messages: RawQuotationMessage[],
  history: HistoryEvent[],
  versionOf: VersionOf,
): { entries: QuoteThreadEntry[]; unmatched: HistoryEvent[] } {
  const shown = messages.filter((m) => SIDE_OF_TYPE[m.type]);
  const byId = new Map(shown.map((m) => [m.id, m]));
  const comment = requestCommentOf(shown);
  const unmatched = [...history];
  const take = (match: (h: HistoryEvent) => boolean) => {
    const i = unmatched.findIndex(match);
    return i < 0 ? undefined : unmatched.splice(i, 1)[0];
  };
  // The comment is written just before the release, so it stands for it.
  if (comment) take((h) => h.event.type === 'request_sent');
  const entries: QuoteThreadEntry[] = [];

  for (const m of shown) {
    let event: QuoteThreadEvent | undefined =
      m === comment
        ? { type: 'request_sent', from: 'request_draft', to: 'requested' }
        : eventOf(m);
    if (event && m !== comment) {
      const at = Date.parse(m.timestamp);
      const to = tag(m, 'statusTo')!.toLowerCase();
      event =
        take((h) => h.at === at && h.row.statusTo.toLowerCase() === to)
          ?.event ?? event;
    }
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
        version: versionOf(m.quotationNumber),
      }),
    );
  }
  return { entries, unmatched };
}

/**
 * A history row nobody wrote anything with. The buyer's side is named after
 * the quotation's buyer; the seller's side by the side alone, since the
 * quotation's owner need not be who acted.
 */
function entryFromHistory(
  h: HistoryEvent,
  quotation: RawThreadQuotation,
  versionOf: VersionOf,
): QuoteThreadEntry {
  return defined({
    id: `history-${h.index}`,
    at: h.row.timestamp,
    side: h.side,
    authorName: h.side === 'buyer' ? nameOf(quotation.customer) : undefined,
    event: h.event,
    version: versionOf(h.row.quotationNumber),
  });
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

/**
 * The quotation's messages and status changes as the buyer reads them,
 * oldest first. Without a history (a quotation from before Geins kept one),
 * the messages alone.
 */
export function buildQuoteThread(
  messages: RawQuotationMessage[],
  quotation?: RawThreadQuotation | null,
  numberChoice?: QuoteDisplayNumber,
): QuoteThread {
  const versionOf = versionsByNumber(quotation?.revisions, numberChoice);
  const { entries: fromMessages, unmatched } = entriesFromMessages(
    messages,
    eventsFromHistory(quotation?.statusHistory ?? []),
    versionOf,
  );
  const orderNumber = quotation?.orderId || undefined;
  const all = [
    ...fromMessages,
    ...unmatched.map((h) => entryFromHistory(h, quotation!, versionOf)),
  ].map((entry) =>
    orderNumber && entry.event?.type === 'ordered'
      ? { ...entry, event: { ...entry.event, orderNumber } }
      : entry,
  );
  const entries = markDeletable(
    oldestFirst(all),
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

/**
 * Read the messages and the status history side by side. `historyRequired`
 * fails the read with the history; otherwise a failed history read leaves
 * the messages alone.
 */
async function readQuoteThread(
  quoteId: string,
  event: H3Event,
  historyRequired: boolean,
): Promise<QuoteThread> {
  const sdk = await getTenantSDK(event);
  const userToken = buildRequestContext(event)?.userToken;
  const read = (file: string) =>
    wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString: loadQuery(file),
          variables: { quotationId: quoteId },
          userToken,
        }),
      'quotes',
    );
  const history = read('quotes/quotation-history.graphql').then((result) => {
    const cart = (
      result as {
        getQuotationCart?: { quotation?: RawThreadQuotation | null } | null;
      } | null
    )?.getQuotationCart;
    if (!cart && historyRequired) {
      throw createAppError(
        ErrorCode.EXTERNAL_API_ERROR,
        `Geins answered no status history for quote ${quoteId}`,
      );
    }
    return cart?.quotation;
  });
  const [messages, quotation] = await onReadableQuote(quoteId, event, () =>
    Promise.all([
      read('quotes/quotation-messages.graphql'),
      historyRequired
        ? history
        : history.catch((error: unknown) => {
            logger.warn('[quotes] status history unavailable; messages only', {
              quoteId,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          }),
    ]),
  );
  return buildQuoteThread(
    (unwrapGraphQL(messages) as RawQuotationMessage[] | null) ?? [],
    quotation,
    event.context.tenant?.config?.quoteDisplayNumber,
  );
}

/**
 * The thread of a quotation the signed-in buyer can read. The history only
 * adds events: without it the messages still show.
 */
export function getQuoteThread(
  quoteId: string,
  event: H3Event,
): Promise<QuoteThread> {
  return readQuoteThread(quoteId, event, false);
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
  // Without the history an event after the message could go unseen.
  const { entries } = await readQuoteThread(quoteId, event, true);
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
