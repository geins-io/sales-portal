import { useIntervalFn } from '@vueuse/core';
import { readonly, toValue, watch, type MaybeRefOrGetter } from 'vue';

/** 120s, and the order-placement e2e spec gives the platform exactly the same
 * number. Two different bounds would disagree about a platform that landed
 * between them — one calling it healthy while the other called it late. It
 * rests on five samples measured 2026-09-13 with a 46.7s maximum, so roughly
 * two and a half times the worst seen. Raising it needs new measurements. */
export const AWAITING_BOUND_MS = 120000;

/** The window is 5-47s, so tighter buys nothing and looser wastes the wait. */
export const AWAITING_INTERVAL_MS = 2500;

/**
 * Waiting for a just-placed order to become readable.
 *
 * The platform makes an order readable 5 to 47 seconds after confirming it was
 * created (five samples, 2026-09-13), and the order endpoint answers 404 until
 * then. This polls `url` until it answers, starting only once the page's own
 * first fetch has settled without the order, and hands that answer to
 * `onOrder`. Nothing polls without a url. Silent by design: the page decides
 * what, if anything, it shows meanwhile.
 *
 * The page keeps its own `useFetch`; this is the retry around it, not a
 * replacement for it.
 */
export function useAwaitedOrder<T>(options: {
  /** The order to wait for, or null when there is nothing to wait for. */
  url: MaybeRefOrGetter<string | null>;
  /** True once the page's own first fetch has answered, either way. */
  settled: MaybeRefOrGetter<boolean>;
  /** True while the page already holds the order. */
  hasOrder: MaybeRefOrGetter<boolean>;
  onOrder: (response: T) => void;
  /** Called once, when the bound ends the wait without the order. */
  onGiveUp?: () => void | Promise<void>;
}) {
  let startedAt = 0;
  let inFlight = false;

  /**
   * One request, with the browser cache bypassed: the order endpoint answers
   * `private, max-age=30`, so an ordinary request would be served the cached
   * 404 for up to thirty seconds and never reach the server.
   */
  async function poll() {
    // The bound is checked before the in-flight guard, so a request that never
    // comes back cannot postpone it for ever.
    if (Date.now() - startedAt > AWAITING_BOUND_MS) {
      pause();
      await options.onGiveUp?.();
      return;
    }

    // The interval fires on a timer, not on the previous response, so without
    // this two requests overlap once the endpoint outlasts the interval.
    const url = toValue(options.url);
    if (inFlight || !url) return;
    inFlight = true;

    try {
      const fresh = await $fetch<T>(url, { cache: 'no-store' });
      // Stopped at the bound, or the scope is gone: the answer is not wanted.
      if (!isActive.value) return;
      pause();
      options.onOrder(fresh);
    } catch {
      // Not readable yet, or a failed request — not a failed order. The next
      // tick tries again, and the bound ends it either way.
    } finally {
      inFlight = false;
    }
  }

  // Paused on scope dispose, so leaving the page stops it without any teardown
  // of our own.
  const { pause, resume, isActive } = useIntervalFn(
    poll,
    AWAITING_INTERVAL_MS,
    { immediate: false },
  );

  watch(
    [
      () => toValue(options.settled),
      () => toValue(options.hasOrder),
      () => toValue(options.url),
    ],
    ([settled, hasOrder, url]) => {
      if (hasOrder) {
        pause();
        return;
      }
      // Explicit rather than implied: this never starts on the server.
      if (!import.meta.client || !settled || !url || isActive.value) return;
      startedAt = Date.now();
      resume();
    },
    { immediate: true },
  );

  return { waiting: readonly(isActive) };
}
