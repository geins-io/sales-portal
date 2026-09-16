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
// commit or release it.
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
}

interface RequestFailure {
  name?: string;
  message?: string;
  status?: number;
  statusCode?: number;
  data?: { message?: string; statusMessage?: string };
}

/** An abandoned request is not a failure the page should be told about. */
function wasAborted(cause: unknown): boolean {
  return (cause as RequestFailure).name === 'AbortError';
}

function describe(cause: unknown): ConfiguratorSessionError {
  const failed = cause as RequestFailure;
  return {
    status: failed.statusCode ?? failed.status ?? 0,
    message:
      failed.data?.message ??
      failed.data?.statusMessage ??
      failed.message ??
      'the request failed',
  };
}

export function useConfiguratorSession() {
  const configuration = ref<Configuration | null>(null);
  const committed = ref<CommittedConfiguration | null>(null);
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

  onScopeDispose(() => {
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
    if (busy.value) return undefined;

    const controller = new AbortController();
    inFlight = controller;
    busy.value = true;
    error.value = null;

    try {
      return await task(controller.signal);
    } catch (cause) {
      if (wasAborted(cause)) return undefined;
      const failure = describe(cause);
      if (failure.status === 410) {
        status.value = 'expired';
        clock.pause();
      } else {
        error.value = failure;
      }
      return undefined;
    } finally {
      if (inFlight === controller) inFlight = null;
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
  async function start(productId: string, quantity = 1): Promise<void> {
    if (!isBrowser() || status.value === 'active') return;

    const created = await run((signal) =>
      $fetch<Configuration>('/api/configurations', {
        method: 'POST',
        body: { productId, quantity },
        signal,
      }),
    );
    if (!created) return;

    configuration.value = created;
    committed.value = null;
    status.value = 'active';
    now.value = Date.now();
    clock.resume();
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

  async function commit(): Promise<void> {
    const id = liveId();
    if (!id) return;

    const result = await run((signal) =>
      $fetch<CommittedConfiguration>(`/api/configurations/${id}/commit`, {
        method: 'POST',
        signal,
      }),
    );
    if (!result) return;

    committed.value = result;
    close();
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
    if (released) close();
  }

  return {
    configuration,
    committed,
    status,
    busy,
    error,
    expiresAt,
    remainingMs,
    start,
    applyChanges,
    renew,
    commit,
    release,
  };
}
