import type {
  ConfiguratorEditNotice,
  ConfiguratorSessionError,
} from '~/composables/useConfiguratorSession';
import type {
  ConfiguratorAction,
  ConfiguratorStage,
} from '~/utils/configurator-page';

// ---------------------------------------------------------------------------
// A configured line of a quotation draft opened in the configurator lives in
// the product page's URL, as ids only, so a reload still knows which line the
// page changes. The server reads the line's choices itself.
// ---------------------------------------------------------------------------

const QUOTE = 'quote';
const LINE = 'quoteLine';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A configured draft line, by the draft's id and its own. */
export interface QuoteLineRef {
  quoteId: string;
  lineId: string;
}

/** The product page changing a draft line: the page's path plus the two ids. */
export function quoteLineHref(path: string, ref: QuoteLineRef): string {
  const query = new URLSearchParams({
    [QUOTE]: ref.quoteId,
    [LINE]: ref.lineId,
  });
  return `${path}?${query.toString()}`;
}

/**
 * The draft line a product page's query names. `stale` is a link the page
 * cannot open — half a link, an id that is not one — which the page says
 * rather than ignore.
 */
export function quoteLineTarget(query: Record<string, unknown>): {
  line: QuoteLineRef | null;
  stale: boolean;
} {
  if (!(QUOTE in query) && !(LINE in query))
    return { line: null, stale: false };
  const quote = query[QUOTE];
  const line = query[LINE];
  if (
    typeof quote !== 'string' ||
    typeof line !== 'string' ||
    !GUID.test(quote) ||
    line === ''
  ) {
    return { line: null, stale: true };
  }
  return { line: { quoteId: quote, lineId: line }, stale: false };
}

/** The query without the draft line, once the page no longer changes it. */
export function withoutQuoteLine<T extends Record<string, unknown>>(
  query: T,
): Omit<T, typeof QUOTE | typeof LINE> {
  const { [QUOTE]: _quote, [LINE]: _line, ...rest } = query;
  return rest;
}

const NOT_AVAILABLE = 'CONFIGURATOR_NOT_AVAILABLE';

/**
 * What the page shows in place of the form while a draft line is edited and
 * there is nothing to configure: the message, which retry it offers, and the
 * label of the way back to the draft.
 */
export interface QuoteFace {
  message:
    | 'configurator.quote.line_gone'
    | 'configurator.quote.open_failed'
    | 'configurator.quote.update_failed'
    | 'configurator.not_available';
  retry: 'open' | 'save' | null;
  leave: 'configurator.edit.cancel' | 'configurator.quote.back';
}

/**
 * A line that is gone, or a draft that was sent, leaves only the way back,
 * whether the open or the save found it. A failure is the save's when the save
 * was the last thing asked for, and the open's otherwise; a product that
 * cannot be configured now would answer the same on a retry.
 */
export function quoteFace(state: {
  draft: boolean;
  notice: ConfiguratorEditNotice | null;
  stage: ConfiguratorStage;
  lastAction: ConfiguratorAction;
  error: ConfiguratorSessionError | null;
}): QuoteFace | null {
  if (!state.draft) return null;
  const leave = 'configurator.quote.back';
  if (state.notice === 'line_gone') {
    return { message: 'configurator.quote.line_gone', retry: null, leave };
  }
  if (state.stage !== 'error') return null;
  if (state.lastAction === 'commit') {
    return {
      message: 'configurator.quote.update_failed',
      retry: 'save',
      leave: 'configurator.edit.cancel',
    };
  }
  if (state.error?.code === NOT_AVAILABLE) {
    return { message: 'configurator.not_available', retry: null, leave };
  }
  return { message: 'configurator.quote.open_failed', retry: 'open', leave };
}
