import { useIntervalFn } from '@vueuse/core';
import { computed, onScopeDispose, ref } from 'vue';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
} from '#shared/types/configurator';
import { isBrowser } from '~/utils/client-helpers';

// ---------------------------------------------------------------------------
// One configuration session: create it, post every choice as a batch, renew it,
// commit or release it. Given a way to add a line, a commit also puts the
// committed configuration in the cart and carries on in a session reopened from
// that line, so the page stays a live configurator after every add.
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
}

export function useConfiguratorSession({
  addLine,
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

    const added = await run(async (signal) => {
      const result = await $fetch<CommittedConfiguration>(
        `/api/configurations/${id}/commit`,
        { method: 'POST', signal },
      );
      if (addLine) return add(result, addLine);
      committed.value = result;
      close();
      return undefined;
    });
    if (added) await carryOn(added.line);
  }

  async function retryAdd(): Promise<void> {
    const record = committed.value;
    if (!addLine || !record) return;

    const added = await run(() => add(record, addLine));
    if (added) await carryOn(added.line);
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
      close();
    }
  }

  return {
    configuration,
    committed,
    notReopened,
    status,
    busy,
    error,
    expiresAt,
    remainingMs,
    start,
    applyChanges,
    renew,
    commit,
    retryAdd,
    release,
  };
}
