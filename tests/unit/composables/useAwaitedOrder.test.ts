import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';

const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

const { useAwaitedOrder, AWAITING_BOUND_MS, AWAITING_INTERVAL_MS } =
  await import('../../../app/composables/useAwaitedOrder');

const URL = '/api/orders/new-order';

/** What `$fetch` throws while the order is not readable yet. */
function notFound(): Error {
  return Object.assign(new Error('Order not found'), { statusCode: 404 });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('useAwaitedOrder', () => {
  let scope: EffectScope;
  const url = ref<string | null>(URL);
  const settled = ref(true);
  const hasOrder = ref(false);
  const onOrder = vi.fn();
  const onGiveUp = vi.fn();

  function start() {
    scope = effectScope();
    const result = scope.run(() =>
      useAwaitedOrder<{ order: { id: string } }>({
        url,
        settled,
        hasOrder,
        onOrder,
        onGiveUp,
      }),
    );
    if (!result) throw new Error('The scope produced nothing');
    return result;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    onOrder.mockReset();
    onGiveUp.mockReset();
    url.value = URL;
    settled.value = true;
    hasOrder.value = false;
  });

  afterEach(() => {
    scope?.stop();
    vi.useRealTimers();
  });

  it('polls every 2.5 s with the browser cache bypassed', async () => {
    mockFetch.mockRejectedValue(notFound());
    const { waiting } = start();

    expect(waiting.value).toBe(true);
    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS - 1);
    expect(mockFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // The order endpoint answers `private, max-age=30`: without the bypass the
    // browser would hand back its cached 404 for half a minute.
    for (const call of mockFetch.mock.calls) {
      expect(call).toEqual([URL, { cache: 'no-store' }]);
    }
  });

  it('does not start without a url', async () => {
    url.value = null;
    const { waiting } = start();

    await vi.advanceTimersByTimeAsync(10000);

    expect(waiting.value).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not start before the first response has settled', async () => {
    settled.value = false;
    const { waiting } = start();

    await vi.advanceTimersByTimeAsync(10000);
    expect(waiting.value).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockRejectedValue(notFound());
    settled.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not start when the first response already has the order', async () => {
    hasOrder.value = true;
    const { waiting } = start();

    await vi.advanceTimersByTimeAsync(10000);

    expect(waiting.value).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('hands over the first answer that carries the order, then stops', async () => {
    const found = { order: { id: '1100' } };
    mockFetch.mockRejectedValueOnce(notFound()).mockResolvedValue(found);
    const { waiting } = start();

    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);
    expect(onOrder).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);

    expect(onOrder).toHaveBeenCalledTimes(1);
    expect(onOrder).toHaveBeenCalledWith(found);
    expect(waiting.value).toBe(false);

    await vi.advanceTimersByTimeAsync(20000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('stops when the page gets the order some other way', async () => {
    mockFetch.mockRejectedValue(notFound());
    const { waiting } = start();
    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);

    hasOrder.value = true;
    await nextTick();
    const calls = mockFetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20000);

    expect(waiting.value).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(calls);
  });

  it('keeps going through a failed request', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Bad gateway'))
      .mockResolvedValue({ order: { id: '1' } });
    start();

    await vi.advanceTimersByTimeAsync(2 * AWAITING_INTERVAL_MS);

    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('never lets two requests overlap, however slow one is', async () => {
    const slow = deferred<unknown>();
    mockFetch.mockReturnValueOnce(slow.promise);
    start();

    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3 * AWAITING_INTERVAL_MS);
    expect(
      mockFetch,
      'a second request started while the first was still in flight',
    ).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValue({ order: { id: '1' } });
    slow.resolve({ order: { id: '1' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('gives up at the bound, once, even with a request that never returns', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { waiting } = start();

    // At exactly the bound it is still waiting; the tick after it gives up.
    await vi.advanceTimersByTimeAsync(AWAITING_BOUND_MS);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(waiting.value).toBe(true);

    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(waiting.value).toBe(false);

    await vi.advanceTimersByTimeAsync(30000);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('ignores an answer that lands after the scope is gone', async () => {
    const slow = deferred<unknown>();
    mockFetch.mockReturnValueOnce(slow.promise);
    start();
    await vi.advanceTimersByTimeAsync(AWAITING_INTERVAL_MS);

    scope.stop();
    slow.resolve({ order: { id: '1' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(onOrder).not.toHaveBeenCalled();
  });

  it('makes no further requests once the scope is gone', async () => {
    mockFetch.mockRejectedValue(notFound());
    start();
    await vi.advanceTimersByTimeAsync(2 * AWAITING_INTERVAL_MS);
    const calls = mockFetch.mock.calls.length;

    scope.stop();
    await vi.advanceTimersByTimeAsync(60000);

    expect(mockFetch).toHaveBeenCalledTimes(calls);
    expect(onGiveUp).not.toHaveBeenCalled();
  });
});
