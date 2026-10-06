import { useIntervalFn } from '@vueuse/core';
import { computed, onScopeDispose, ref } from 'vue';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
} from '#shared/types/configurator';
import { isBrowser } from '~/utils/client-helpers';
import type { OrderRowRef } from '~/utils/configurator-replay';

// ---------------------------------------------------------------------------
// One configuration session: create it, post every choice as a batch, renew it,
// commit or release it. Given a way to add a line, a commit also puts the
// committed configuration in the cart and carries on in a session reopened from
// that line, so the page stays a live configurator after every add.
//
// A session can also edit a configured line: it is reopened from the line, and
// a commit then puts the new configuration on that same line instead of adding
// one. The line keeps its old configuration until that swap has answered.
//
// The rule engine runs server-side and is not on the wire, so nothing here
// interprets a document. A change response is the whole re-evaluated state and
// replaces what is held; patching it locally would invent an outcome the
// provider never returned.
//
// Expiry is a state, not a failure: a session that answers 410 is gone and the
// page renders a way to start over. A session that was committed or released is
// `closed` instead, and nothing more is sent to it — which is what keeps the
// same 410 from telling a buyer who just ordered that their session ran out.
// ---------------------------------------------------------------------------

export type ConfiguratorSessionStatus =
  | 'idle'
  | 'active'
  | 'expired'
  | 'closed';

export interface ConfiguratorSessionError {
  status: number;
  message: string;
  /** The portal's error code, which the production body keeps. */
  code?: string;
}

interface RequestFailure {
  name?: string;
  message?: string;
  status?: number;
  statusCode?: number;
  data?: {
    message?: string;
    statusMessage?: string;
    data?: { code?: unknown };
  };
}

/** An abandoned request is not a failure the page should be told about. */
function wasAborted(cause: unknown): boolean {
  return (cause as RequestFailure).name === 'AbortError';
}

function describe(cause: unknown): ConfiguratorSessionError {
  const failed = cause as RequestFailure;
  const code = failed.data?.data?.code;
  return {
    status: failed.statusCode ?? failed.status ?? 0,
    message:
      failed.data?.message ??
      failed.data?.statusMessage ??
      failed.message ??
      'the request failed',
    ...(typeof code === 'string' ? { code } : {}),
  };
}

/** A configured cart line, by its cart and its own id. */
export interface CartLineRef {
  cartId: string;
  itemId: string;
}

export interface ConfiguratorSessionOptions {
  /**
   * Puts a committed configuration in the cart and answers the line, or none
   * when the cart does not say. Throws when the add fails.
   */
  addLine?: (committed: CommittedConfiguration) => Promise<CartLineRef | null>;
  /**
   * Puts a committed configuration on the line being edited and answers it.
   * Throws when the swap fails, which leaves the line as it was.
   */
  replaceLine?: (
    committed: CommittedConfiguration,
    line: CartLineRef,
  ) => Promise<CartLineRef | null>;
}

/**
 * Why an edit is not on the line's own choices: the line's configuration
 * cannot be reopened, so the buyer configures it again from nothing; or the
 * line is not one this buyer can edit any more, so the page is an ordinary one.
 */
export type ConfiguratorEditNotice = 'not_reopenable' | 'line_gone';

/**
 * What a failed reopen for an edit means. The line is read as gone only by the
 * portal's codes for the line and the cart: a 404 or a 403 alone could be an
 * unknown configuration, a buyer the provider refuses or a catalogue tenant.
 * Anything else — the provider's replay budget, a timeout, an unreachable
 * backend — is worth another try, so it stays an error the page offers a retry
 * for.
 */
export function reopenFailure(
  failure: ConfiguratorSessionError,
): ConfiguratorEditNotice | null {
  if (failure.status === 422) return 'not_reopenable';
  if (failure.code === 'CART_LINE_GONE' || failure.code === 'CART_NOT_OWN') {
    return 'line_gone';
  }
  return null;
}

export function useConfiguratorSession({
  addLine,
  replaceLine,
}: ConfiguratorSessionOptions = {}) {
  const configuration = ref<Configuration | null>(null);
  /**
   * A committed configuration the page holds: one whose add failed, kept for
   * the retry, or one committed without a way to add.
   */
  const committed = ref<CommittedConfiguration | null>(null);
  /**
   * Set when the session after an add is a fresh one rather than the line
   * reopened, so the page can say the buyer's choices did not come back.
   */
  const notReopened = ref(false);
  /**
   * Set when a session opened from an order row is on the defaults rather than
   * the order's choices.
   */
  const notReplayed = ref(false);
  /** The cart line being edited, while the page edits one. */
  const editing = ref<CartLineRef | null>(null);
  const editNotice = ref<ConfiguratorEditNotice | null>(null);
  const status = ref<ConfiguratorSessionStatus>('idle');
  const busy = ref(false);
  const error = ref<ConfiguratorSessionError | null>(null);

  const now = ref(Date.now());
  const clock = useIntervalFn(
    () => {
      now.value = Date.now();
    },
    1000,
    { immediate: false },
  );

  const expiresAt = computed(() => configuration.value?.expiresAt ?? null);

  const remainingMs = computed(() => {
    if (status.value !== 'active' || !expiresAt.value) return 0;
    return Math.max(0, Date.parse(expiresAt.value) - now.value);
  });

  let inFlight: AbortController | null = null;

  /**
   * Set once the page has gone. A step that was not in flight then, such as the
   * reopen after an add the page left behind, must not send anything after it.
   */
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
    inFlight?.abort();
  });

  /**
   * The one place a request is made. While a batch is in flight the form is
   * locked and a second one is dropped rather than queued: the response is the
   * whole state, so two batches in the air would race over what the buyer sees.
   */
  async function run<T>(
    task: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    if (busy.value || disposed) return undefined;

    const controller = new AbortController();
    inFlight = controller;
    busy.value = true;
    error.value = null;

    try {
      return await task(controller.signal);
    } catch (cause) {
      if (wasAborted(cause)) return undefined;
      const failure = describe(cause);
      // With a record held the session is finished; a 410 then belongs to the
      // add and is a failure like any other.
      if (failure.status === 410 && !committed.value) {
        status.value = 'expired';
        clock.pause();
      } else {
        error.value = failure;
      }
      return undefined;
    } finally {
      inFlight = null;
      busy.value = false;
    }
  }

  /** The id of a session that is still worth talking to. */
  function liveId(): string | null {
    return status.value === 'active' && configuration.value
      ? configuration.value.configurationId
      : null;
  }

  function close(): void {
    status.value = 'closed';
    clock.pause();
  }

  /**
   * Never during SSR: the same POST runs again after hydration and every page
   * load would leak a session.
   */
  /** What the last start asked for, which a failed reopen starts again. */
  let started: { productId: string; quantity: number } | null = null;

  function hold(document: Configuration): void {
    configuration.value = document;
    committed.value = null;
    status.value = 'active';
    now.value = Date.now();
    clock.resume();
  }

  async function start(productId: string, quantity = 1): Promise<void> {
    if (!isBrowser() || status.value === 'active') return;
    started = { productId, quantity };

    const created = await run((signal) =>
      $fetch<Configuration>('/api/configurations', {
        method: 'POST',
        body: { productId, quantity },
        signal,
      }),
    );
    if (created) hold(created);
  }

  /**
   * A new session holding an order row's choices, which the server replays.
   * Not on the server, for the same reason as `start`.
   */
  async function replay(productId: string, row: OrderRowRef): Promise<void> {
    if (!isBrowser() || status.value === 'active') return;
    started = { productId, quantity: 1 };

    const result = await run((signal) =>
      $fetch<{ configuration: Configuration; replayed: boolean }>(
        '/api/configurations/from-order',
        { method: 'POST', body: { productId, ...row }, signal },
      ),
    );
    if (!result) return;
    notReplayed.value = !result.replayed;
    hold(result.configuration);
  }

  /**
   * The line being edited, reopened with its committed choices. Not on the
   * server, for the same reason as `start`.
   */
  async function edit(productId: string, line: CartLineRef): Promise<void> {
    if (!isBrowser() || status.value === 'active') return;
    started = { productId, quantity: 1 };
    editing.value = line;
    editNotice.value = null;
    await reopenLine();
  }

  /**
   * Opens the line being edited again: first, after a failed try, after the
   * session expired, and to revert. The line itself is untouched until a swap.
   */
  async function reopenLine(): Promise<void> {
    const line = editing.value;
    if (!line) return;
    // The page shows loading rather than the expired face while it reopens.
    if (status.value === 'expired') status.value = 'closed';

    const result = await run(
      async (
        signal,
      ): Promise<
        { document: Configuration } | { notice: ConfiguratorEditNotice }
      > => {
        try {
          return {
            document: await $fetch<Configuration>(
              '/api/configurations/reopen',
              {
                method: 'POST',
                body: line,
                signal,
              },
            ),
          };
        } catch (cause) {
          const notice = wasAborted(cause)
            ? null
            : reopenFailure(describe(cause));
          if (!notice) throw cause;
          return { notice };
        }
      },
    );
    if (!result) return;
    if ('document' in result) {
      editNotice.value = null;
      return hold(result.document);
    }
    editNotice.value = result.notice;
    if (result.notice === 'line_gone') editing.value = null;
    if (started) await start(started.productId, started.quantity);
  }

  /** The caller decides when — a measurement field on blur, an option at once. */
  async function applyChanges(changes: ConfigurationChange[]): Promise<void> {
    const id = liveId();
    // The route rejects an empty batch, and there is nothing to re-evaluate.
    if (!id || changes.length === 0) return;

    const updated = await run((signal) =>
      $fetch<Configuration>(`/api/configurations/${id}/changes`, {
        method: 'POST',
        body: { changes },
        signal,
      }),
    );
    if (updated) configuration.value = updated;
  }

  async function renew(): Promise<void> {
    const id = liveId();
    if (!id) return;

    const renewed = await run((signal) =>
      $fetch<{ expiresAt: string }>(`/api/configurations/${id}/renew`, {
        method: 'POST',
        signal,
      }),
    );
    if (renewed && configuration.value) {
      configuration.value.expiresAt = renewed.expiresAt;
    }
  }

  /**
   * Adds the record. Once it is in, the document goes too, which the page shows
   * as loading until `carryOn` has a session again. A failed add keeps the
   * record instead, so the retry adds it rather than committing again, which
   * the finished session would refuse.
   */
  async function add(
    record: CommittedConfiguration,
    addTo: NonNullable<ConfiguratorSessionOptions['addLine']>,
  ): Promise<{ line: CartLineRef | null }> {
    try {
      const line = await addTo(record);
      committed.value = null;
      configuration.value = null;
      close();
      return { line };
    } catch (cause) {
      committed.value = record;
      close();
      throw cause;
    }
  }

  /** `add`'s counterpart for an edit: the record goes onto the edited line. */
  async function swap(
    record: CommittedConfiguration,
    line: CartLineRef,
    swapOnto: NonNullable<ConfiguratorSessionOptions['replaceLine']>,
  ): Promise<{ line: CartLineRef | null }> {
    try {
      const swapped = await swapOnto(record, line);
      committed.value = null;
      configuration.value = null;
      editing.value = null;
      editNotice.value = null;
      close();
      return { line: swapped ?? line };
    } catch (cause) {
      committed.value = record;
      close();
      throw cause;
    }
  }

  /** What a commit does with its record: onto the edited line, or a new one. */
  function place(
    record: CommittedConfiguration,
  ): Promise<{ line: CartLineRef | null }> | undefined {
    const line = editing.value;
    if (line && replaceLine) return swap(record, line, replaceLine);
    if (addLine) return add(record, addLine);
    return undefined;
  }

  /**
   * The page after an add: the session reopened from the new line, with the
   * buyer's choices, or a fresh one when there is no line or the reopen fails.
   * Either way the form and its action are back for another add.
   */
  async function carryOn(line: CartLineRef | null): Promise<void> {
    if (line) {
      // A failed reopen is not the buyer's failure: it answers null rather than
      // an error, which would show for a moment before the fresh start. Once
      // the page has gone, `run` sends nothing, the start included.
      const reopened = await run((signal) =>
        $fetch<Configuration>('/api/configurations/reopen', {
          method: 'POST',
          body: line,
          signal,
        }).catch(() => null),
      );
      if (reopened) return hold(reopened);
    }
    notReopened.value = true;
    if (started) await start(started.productId, started.quantity);
  }

  /**
   * Commit, then add the line, in one request window: a second press in between
   * would add the same committed id twice, and that gives two lines. The form
   * stays on screen, busy, until the add has answered, so the buyer sees
   * progress from the press to the drawer.
   */
  async function commit(): Promise<void> {
    const id = liveId();
    if (!id) return;
    notReopened.value = false;
    notReplayed.value = false;

    const added = await run(async (signal) => {
      const result = await $fetch<CommittedConfiguration>(
        `/api/configurations/${id}/commit`,
        { method: 'POST', signal },
      );
      const placed = place(result);
      if (placed) return placed;
      committed.value = result;
      close();
      return undefined;
    });
    if (added) await carryOn(added.line);
  }

  /** Sends the kept record again, onto the edited line or as a new one. */
  async function retryAdd(): Promise<void> {
    const record = committed.value;
    if (!record) return;

    const added = await run(() => place(record) ?? Promise.resolve(undefined));
    if (added) await carryOn(added.line);
  }

  /** Back to the line's own choices, still editing it. */
  async function revertEdit(): Promise<void> {
    if (!editing.value) return;
    if (liveId()) {
      await release();
      if (status.value !== 'closed') return;
    }
    await reopenLine();
  }

  /**
   * Leaves the line as it is: the session is released, and the page carries on
   * from the line as after an add, no longer editing it.
   */
  async function cancelEdit(): Promise<void> {
    const line = editing.value;
    if (!line) return;
    if (liveId()) {
      await release();
      if (status.value !== 'closed') return;
    }
    editing.value = null;
    editNotice.value = null;
    committed.value = null;
    await carryOn(line);
  }

  async function release(): Promise<void> {
    const id = liveId();
    if (!id) return;

    // The route answers a bare 204, so success is the absence of a throw rather
    // than a body — and leaving the body type to be inferred is what overflows
    // Nitro's route types.
    const released = await run(async (signal) => {
      await $fetch<null>(`/api/configurations/${id}`, {
        method: 'DELETE',
        signal,
      });
      return true;
    });
    if (released) {
      notReopened.value = false;
      notReplayed.value = false;
      close();
    }
  }

  return {
    configuration,
    committed,
    notReopened,
    notReplayed,
    editing,
    editNotice,
    status,
    busy,
    error,
    expiresAt,
    remainingMs,
    start,
    edit,
    replay,
    reopenLine,
    revertEdit,
    cancelEdit,
    applyChanges,
    renew,
    commit,
    retryAdd,
    release,
  };
}
