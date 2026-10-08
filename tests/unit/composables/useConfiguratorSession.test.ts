// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, watch, type EffectScope } from 'vue';
import type {
  CommittedConfiguration,
  Configuration,
} from '#shared/types/configurator';
import {
  makeCascadedConfiguration,
  makeInitialConfiguration,
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';

// ---------------------------------------------------------------------------
// The configuration session, driven through a mocked `$fetch`.
//
// The documents are the example ones rather than hand-built objects: the point
// of most of these tests is that the composable does not read the document it
// is given, and a stub shaped like a document would hide a composable that
// quietly patched one.
//
// `import.meta.client` cannot carry the SSR rule here. Vite replaces it at
// build time and the node tier compiles it to `true`, so the server branch can
// never run in a test — which is why the composable asks `isBrowser()` and the
// mock below is what makes that clause provable.
// ---------------------------------------------------------------------------

const browser = vi.hoisted(() => ({ value: true }));
vi.mock('~/utils/client-helpers', () => ({
  isBrowser: () => browser.value,
}));

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

const mockFetch = vi.fn<(url: string, options?: RequestOptions) => unknown>();
vi.stubGlobal('$fetch', mockFetch);

const { useConfiguratorSession } =
  await import('../../../app/composables/useConfiguratorSession');
const { choicesOf } = await import('../../../app/utils/configurator-replay');

const PRODUCT_ID = '900000000000123';
const NOW = new Date('2026-01-01T12:00:00.000Z');

/**
 * The composable in a scope of its own, so `scope.stop()` is the unmount the
 * abort clause is about. A component's setup scope disposes exactly this way.
 */
function startSession(): {
  session: ReturnType<typeof useConfiguratorSession>;
  scope: EffectScope;
} {
  const scope = effectScope();
  const session = scope.run(() => useConfiguratorSession());
  if (!session) throw new Error('The scope produced no session');
  return { session, scope };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/**
 * What ofetch throws: the status on the error itself, the body under `data`,
 * and the portal's own code under the body's `data`.
 */
function fetchError(status: number, message = 'no', code?: string): Error {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    data: { message, ...(code ? { data: { code } } : {}) },
  });
}

function committedFrom(config: Configuration): CommittedConfiguration {
  return {
    committedConfigurationId: 'committed-1',
    configurationId: config.configurationId,
    articleNumber: config.articleNumber,
    quantity: config.quantity,
    unitPrice: config.unitPrice,
    discountPercent: config.discountPercent,
    summary: [{ label: 'Table top', value: 'Stainless steel' }],
  };
}

/** The last call's options, which is where the body and the signal are. */
function lastRequest(): { url: string; options: RequestOptions } {
  const call = mockFetch.mock.calls.at(-1);
  if (!call) throw new Error('Nothing was requested');
  return { url: call[0], options: call[1] ?? {} };
}

let scopes: EffectScope[] = [];

function open(): ReturnType<typeof useConfiguratorSession> {
  const { session, scope } = startSession();
  scopes.push(scope);
  return session;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockFetch.mockReset();
  browser.value = true;
  scopes = [];
});

afterEach(() => {
  for (const scope of scopes) scope.stop();
  vi.useRealTimers();
});

describe('useConfiguratorSession', () => {
  describe('start', () => {
    it('opens no session on the server', async () => {
      browser.value = false;
      const session = open();

      await session.start(PRODUCT_ID);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(session.status.value).toBe('idle');
      expect(session.configuration.value).toBeNull();
    });

    it('posts the product id with quantity 1 and holds the document', async () => {
      const initial = makeInitialConfiguration();
      mockFetch.mockResolvedValue(initial);
      const session = open();

      await session.start(PRODUCT_ID);

      const { url, options } = lastRequest();
      expect(url).toBe('/api/configurations');
      expect(options.method).toBe('POST');
      expect(options.body).toEqual({ productId: PRODUCT_ID, quantity: 1 });
      expect(session.configuration.value).toEqual(initial);
      expect(session.status.value).toBe('active');
      expect(session.busy.value).toBe(false);
    });

    it('sends an explicit quantity when one is given', async () => {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();

      await session.start(PRODUCT_ID, 4);

      expect(lastRequest().options.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 4,
      });
    });

    it('keeps the server’s message and stays idle when create fails', async () => {
      mockFetch.mockRejectedValue(fetchError(404, 'No configurator here'));
      const session = open();

      await session.start(PRODUCT_ID);

      expect(session.status.value).toBe('idle');
      expect(session.error.value).toEqual({
        status: 404,
        message: 'No configurator here',
      });
    });

    // Three shapes of the same rejection, because ofetch does not guarantee one:
    // the status sits on `statusCode` or on `status`, the text under `data` or
    // on the error itself, and a request that never reached the server has
    // neither. The last one is the one that bites — reading `data.message`
    // without the optional chain throws inside the catch.
    it.each([
      [
        'only a status',
        Object.assign(new Error('failed'), {
          status: 502,
          data: { statusMessage: 'Bad gateway' },
        }),
        { status: 502, message: 'Bad gateway' },
      ],
      [
        'no body at all',
        new Error('Failed to fetch'),
        { status: 0, message: 'Failed to fetch' },
      ],
      [
        'nothing that is an Error',
        { status: 500 },
        { status: 500, message: 'the request failed' },
      ],
    ])('reads a rejection with %s', async (_shape, thrown, expected) => {
      mockFetch.mockRejectedValue(thrown);
      const session = open();

      await session.start(PRODUCT_ID);

      expect(session.error.value).toEqual(expected);
      expect(session.status.value).toBe('idle');
    });

    it('opens no second session while one is active', async () => {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();

      await session.start(PRODUCT_ID);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('applyChanges', () => {
    async function started(): Promise<
      ReturnType<typeof useConfiguratorSession>
    > {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      return session;
    }

    it('keeps the document and reads the code when the provider refuses a batch', async () => {
      const session = await started();
      const held = session.configuration.value;
      // What the route answers for the seam's VALIDATION_ERROR: Nitro's error
      // body, with the code under `data` where production still sends it.
      mockFetch.mockRejectedValue(
        Object.assign(new Error('[POST] 422 Validation failed'), {
          status: 422,
          statusCode: 422,
          data: {
            statusCode: 422,
            statusMessage: 'Validation failed',
            message: 'Validation failed',
            data: { code: 'VALIDATION_ERROR' },
          },
        }),
      );

      await session.applyChanges([
        { type: 'variable', variableId: 'width', value: 0 },
      ]);

      expect(session.error.value).toEqual({
        status: 422,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      expect(session.configuration.value).toBe(held);
      expect(session.status.value).toBe('active');
    });

    it('reads no code that is not a string', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(
        Object.assign(new Error('failed'), {
          status: 422,
          data: { message: 'Validation failed', data: { code: 422 } },
        }),
      );

      await session.applyChanges([
        { type: 'variable', variableId: 'width', value: 0 },
      ]);

      expect(session.error.value).toStrictEqual({
        status: 422,
        message: 'Validation failed',
      });
    });

    it('posts the batch to the session and replaces the whole document', async () => {
      const session = await started();
      const cascaded = makeCascadedConfiguration();
      mockFetch.mockResolvedValue(cascaded);

      await session.applyChanges([
        {
          type: 'option',
          optionId: 'legs-electric',
          instanceId: '0',
          selected: true,
          quantity: 1,
          lock: 'none',
        },
      ]);

      const { url, options } = lastRequest();
      expect(url).toBe(
        `/api/configurations/${cascaded.configurationId}/changes`,
      );
      expect(options.method).toBe('POST');
      expect(options.body).toEqual({
        changes: [
          {
            type: 'option',
            optionId: 'legs-electric',
            instanceId: '0',
            selected: true,
            quantity: 1,
            lock: 'none',
          },
        ],
      });
      expect(session.configuration.value).toEqual(cascaded);
    });

    it('does not merge the response into what it held', async () => {
      const session = await started();
      // One section, so a merged document would keep the other four groups of
      // the initial one alongside it.
      const trimmed = makeCascadedConfiguration({
        sections: makeCascadedConfiguration().sections.slice(0, 1),
        messages: [{ severity: 'error', text: 'Select a colour.' }],
      });
      mockFetch.mockResolvedValue(trimmed);

      await session.applyChanges([
        { type: 'variable', variableId: 'width', value: 1800 },
      ]);

      expect(session.configuration.value?.sections).toHaveLength(1);
      expect(session.configuration.value?.messages).toEqual(trimmed.messages);
    });

    it('sends no second batch while one is in flight', async () => {
      const session = await started();
      const pending = deferred<Configuration>();
      mockFetch.mockReturnValue(pending.promise);

      const first = session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      expect(session.busy.value).toBe(true);

      await session.applyChanges([{ type: 'quantity', quantity: 3 }]);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      pending.resolve(makeCascadedConfiguration());
      await first;
      expect(session.busy.value).toBe(false);
    });

    it('refuses an empty batch without a request', async () => {
      const session = await started();

      await session.applyChanges([]);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('the silent renew', () => {
    const MINUTE = 60_000;
    const EXTENDED = new Date(NOW.getTime() + 240 * MINUTE).toISOString();

    /** A session ten minutes from expiry, answered at NOW. */
    async function startedNearExpiry(): Promise<{
      session: ReturnType<typeof useConfiguratorSession>;
      scope: EffectScope;
      held: Configuration;
    }> {
      const held = makeInitialConfiguration({
        expiresAt: new Date(NOW.getTime() + 10 * MINUTE).toISOString(),
      });
      mockFetch.mockResolvedValue(held);
      const { session, scope } = startSession();
      scopes.push(scope);
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      return { session, scope, held };
    }

    function renewCalls(): string[] {
      return mockFetch.mock.calls
        .map(([url]) => url)
        .filter((url) => url.endsWith('/renew'));
    }

    function act(type = 'pointerdown'): void {
      window.dispatchEvent(new Event(type));
    }

    it('renews, near expiry, a session whose buyer has been active since it last answered', async () => {
      const { session, held } = await startedNearExpiry();
      mockFetch.mockResolvedValue({ expiresAt: EXTENDED });

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);

      expect(renewCalls()).toEqual([
        `/api/configurations/${held.configurationId}/renew`,
      ]);
      expect(lastRequest().options.method).toBe('POST');
      expect(session.configuration.value?.expiresAt).toBe(EXTENDED);
      expect(session.configuration.value?.sections).toEqual(held.sections);
    });

    it.each(['pointerdown', 'keydown', 'wheel', 'touchmove', 'scroll'])(
      'counts a %s as activity',
      async (type) => {
        await startedNearExpiry();
        mockFetch.mockResolvedValue({ expiresAt: EXTENDED });

        await vi.advanceTimersByTimeAsync(MINUTE);
        act(type);
        await vi.advanceTimersByTimeAsync(5 * MINUTE);

        expect(renewCalls()).toHaveLength(1);
      },
    );

    it('does not count a moving cursor, or coming back to the tab, as activity', async () => {
      await startedNearExpiry();

      await vi.advanceTimersByTimeAsync(MINUTE);
      act('mousemove');
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(8 * MINUTE + MINUTE / 2);

      expect(renewCalls()).toEqual([]);
    });

    it('sends nothing from an idle page, right up to expiry', async () => {
      await startedNearExpiry();

      await vi.advanceTimersByTimeAsync(10 * MINUTE - 1);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('renews on the first touch inside the last five minutes, without waiting for the next check', async () => {
      await startedNearExpiry();
      mockFetch.mockResolvedValue({ expiresAt: EXTENDED });
      // Just past the check at five minutes before expiry, which found the buyer idle.
      await vi.advanceTimersByTimeAsync(5 * MINUTE + 1000);
      expect(renewCalls()).toEqual([]);

      act();
      await vi.advanceTimersByTimeAsync(1000);

      expect(renewCalls()).toHaveLength(1);
    });

    it('asks at most every five seconds while the buyer scrolls against a renew that keeps failing', async () => {
      await startedNearExpiry();
      mockFetch.mockRejectedValue(fetchError(500, 'down'));
      // Inside the last five minutes, between two checks.
      await vi.advanceTimersByTimeAsync(5 * MINUTE + 1000);

      for (let tick = 0; tick < 300; tick++) {
        act('scroll');
        await vi.advanceTimersByTimeAsync(100);
      }

      // Every five seconds over 30 s, and the 30 s check: not one per answer.
      expect(renewCalls().length).toBeGreaterThan(0);
      expect(renewCalls().length).toBeLessThanOrEqual(8);
    });

    it('sends nothing on activity while expiry is further away', async () => {
      await startedNearExpiry();

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(1000);
      act('keydown');
      await vi.advanceTimersByTimeAsync(10_000);

      expect(renewCalls()).toEqual([]);
    });

    describe('once expiry has passed on an idle page', () => {
      it('asks the server once, and shows the expired face when it answers 410', async () => {
        const { session } = await startedNearExpiry();
        mockFetch.mockRejectedValue(fetchError(410, 'gone'));

        await vi.advanceTimersByTimeAsync(10 * MINUTE);

        expect(renewCalls()).toHaveLength(1);
        expect(session.status.value).toBe('expired');
        expect(session.error.value).toBeNull();

        await vi.advanceTimersByTimeAsync(5 * MINUTE);
        expect(renewCalls()).toHaveLength(1);
      });

      it('carries on, renewed, when the server still holds the session', async () => {
        const { session } = await startedNearExpiry();
        mockFetch.mockResolvedValue({ expiresAt: EXTENDED });

        await vi.advanceTimersByTimeAsync(10 * MINUTE);

        expect(renewCalls()).toHaveLength(1);
        expect(session.status.value).toBe('active');
        expect(session.configuration.value?.expiresAt).toBe(EXTENDED);

        await vi.advanceTimersByTimeAsync(10 * MINUTE);
        expect(renewCalls()).toHaveLength(1);
      });

      it('does not show the expired face while that renew is in flight; its answer decides', async () => {
        const { session } = await startedNearExpiry();
        const pending = deferred<{ expiresAt: string }>();
        mockFetch.mockReturnValue(pending.promise);

        await vi.advanceTimersByTimeAsync(10 * MINUTE);
        expect(renewCalls()).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(2 * MINUTE);

        expect(session.status.value).toBe('active');
        expect(renewCalls()).toHaveLength(1);

        pending.resolve({ expiresAt: EXTENDED });
        await vi.advanceTimersByTimeAsync(0);
        expect(session.status.value).toBe('active');
        expect(session.configuration.value?.expiresAt).toBe(EXTENDED);
      });

      it('tries again on the next check when the renew fails another way', async () => {
        const { session } = await startedNearExpiry();
        mockFetch.mockRejectedValue(fetchError(500, 'down'));

        await vi.advanceTimersByTimeAsync(10 * MINUTE);
        expect(renewCalls()).toHaveLength(1);
        expect(session.status.value).toBe('active');

        await vi.advanceTimersByTimeAsync(MINUTE / 2);
        expect(renewCalls()).toHaveLength(2);
      });
    });

    describe('coming back to the tab', () => {
      afterEach(() => {
        Reflect.deleteProperty(document, 'visibilityState');
      });

      function showTab(state: 'visible' | 'hidden'): void {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => state,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }

      it('asks at once, without waiting for a check the background tab held back', async () => {
        const { session } = await startedNearExpiry();
        mockFetch.mockRejectedValue(fetchError(410, 'gone'));
        // A background tab's timers lag: the clock moves on, the checks do not.
        vi.setSystemTime(NOW.getTime() + 11 * MINUTE);

        showTab('visible');
        await vi.advanceTimersByTimeAsync(0);

        expect(renewCalls()).toHaveLength(1);
        expect(session.status.value).toBe('expired');
      });

      it('asks nothing when the tab goes to the background', async () => {
        await startedNearExpiry();
        vi.setSystemTime(NOW.getTime() + 11 * MINUTE);

        showTab('hidden');
        await vi.advanceTimersByTimeAsync(0);

        expect(renewCalls()).toEqual([]);
      });
    });

    it('does not count activity from before the last change batch answered', async () => {
      const { session } = await startedNearExpiry();
      act();
      await vi.advanceTimersByTimeAsync(MINUTE);
      mockFetch.mockResolvedValue(
        makeCascadedConfiguration({
          expiresAt: new Date(NOW.getTime() + 11 * MINUTE).toISOString(),
        }),
      );
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      mockFetch.mockReset();

      await vi.advanceTimersByTimeAsync(10 * MINUTE - 1);

      expect(renewCalls()).toEqual([]);
    });

    it('waits for the last five minutes, however active the buyer', async () => {
      await startedNearExpiry();
      mockFetch.mockResolvedValue({ expiresAt: EXTENDED });

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(3 * MINUTE + MINUTE / 2);

      expect(renewCalls()).toEqual([]);
    });

    it('renews once, then waits for the next approach to expiry', async () => {
      await startedNearExpiry();
      mockFetch.mockResolvedValue({
        expiresAt: new Date(NOW.getTime() + 20 * MINUTE).toISOString(),
      });

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(renewCalls()).toHaveLength(1);

      // Idle since the renew answered: nothing more, however near expiry.
      await vi.advanceTimersByTimeAsync(10 * MINUTE);
      expect(renewCalls()).toHaveLength(1);

      act();
      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(renewCalls()).toHaveLength(2);
    });

    it('never locks the form and never reports, so a change during it still goes out', async () => {
      const { session, held } = await startedNearExpiry();
      const pending = deferred<{ expiresAt: string }>();
      const changed = makeCascadedConfiguration({
        configurationId: held.configurationId,
        expiresAt: new Date(NOW.getTime() + 60 * MINUTE).toISOString(),
      });
      mockFetch.mockImplementation((url) =>
        url.endsWith('/renew') ? pending.promise : Promise.resolve(changed),
      );

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(renewCalls()).toHaveLength(1);
      expect(session.busy.value).toBe(false);

      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      expect(lastRequest().url).toBe(
        `/api/configurations/${held.configurationId}/changes`,
      );
      expect(session.configuration.value).toEqual(changed);

      pending.resolve({ expiresAt: EXTENDED });
      await vi.advanceTimersByTimeAsync(0);
      expect(session.configuration.value?.expiresAt).toBe(EXTENDED);
      expect(session.configuration.value?.sections).toEqual(changed.sections);
      expect(session.error.value).toBeNull();
    });

    it('keeps the later expiry when a batch answered after the renew was sent', async () => {
      const { session, held } = await startedNearExpiry();
      const pending = deferred<{ expiresAt: string }>();
      const later = new Date(NOW.getTime() + 245 * MINUTE).toISOString();
      mockFetch.mockImplementation((url) =>
        url.endsWith('/renew')
          ? pending.promise
          : Promise.resolve(
              makeCascadedConfiguration({
                configurationId: held.configurationId,
                expiresAt: later,
              }),
            ),
      );

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(4 * MINUTE);
      expect(renewCalls()).toHaveLength(1);
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);

      // Sent before the batch, so its expiry is the earlier of the two.
      pending.resolve({ expiresAt: EXTENDED });
      await vi.advanceTimersByTimeAsync(0);
      expect(session.configuration.value?.expiresAt).toBe(later);
    });

    it('leaves a check to the batch in flight, which moves expiry itself', async () => {
      const { session } = await startedNearExpiry();
      const pending = deferred<Configuration>();
      mockFetch.mockReturnValue(pending.promise);

      await vi.advanceTimersByTimeAsync(5 * MINUTE + MINUTE / 2);
      act();
      const batch = session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      await vi.advanceTimersByTimeAsync(MINUTE);

      expect(renewCalls()).toEqual([]);
      pending.resolve(makeCascadedConfiguration());
      await batch;
    });

    it('shows the expired state at once when the renew answers 410', async () => {
      const { session } = await startedNearExpiry();
      mockFetch.mockRejectedValue(fetchError(410, 'gone'));

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);

      expect(session.status.value).toBe('expired');
      expect(session.error.value).toBeNull();
    });

    it('shows nothing when the renew fails another way, and tries again on the next check', async () => {
      const { session, held } = await startedNearExpiry();
      mockFetch.mockRejectedValue(fetchError(500, 'down'));

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      // The first check inside the window, five minutes before expiry.
      await vi.advanceTimersByTimeAsync(4 * MINUTE);

      expect(renewCalls()).toHaveLength(1);
      expect(session.status.value).toBe('active');
      expect(session.error.value).toBeNull();
      expect(session.busy.value).toBe(false);
      expect(session.configuration.value?.expiresAt).toBe(held.expiresAt);

      await vi.advanceTimersByTimeAsync(MINUTE / 2);
      expect(renewCalls()).toHaveLength(2);
    });

    it('drops an answer for a session the page no longer holds', async () => {
      const { session } = await startedNearExpiry();
      const pending = deferred<{ expiresAt: string }>();
      mockFetch.mockReturnValue(pending.promise);

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(renewCalls()).toHaveLength(1);

      // Earlier than the renew's, so only the session check keeps it.
      const soon = new Date(NOW.getTime() + 30 * MINUTE).toISOString();
      const next = makeInitialConfiguration({
        configurationId: 'next',
        expiresAt: soon,
      });
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(null);
      await session.release();
      mockFetch.mockResolvedValue(next);
      await session.start(PRODUCT_ID);

      pending.resolve({ expiresAt: EXTENDED });
      await vi.advanceTimersByTimeAsync(0);
      expect(session.configuration.value?.configurationId).toBe('next');
      expect(session.configuration.value?.expiresAt).toBe(soon);
    });

    it('renews nothing once the session has expired, however active the buyer', async () => {
      const { session } = await startedNearExpiry();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      mockFetch.mockReset();

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);

      expect(session.status.value).toBe('expired');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not expire a session the page no longer holds on a late 410', async () => {
      const { session } = await startedNearExpiry();
      let fail!: (cause: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise((_, reject) => {
          fail = reject;
        }),
      );

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);

      mockFetch.mockReset();
      mockFetch.mockResolvedValue(null);
      await session.release();
      mockFetch.mockResolvedValue(
        makeInitialConfiguration({ configurationId: 'next' }),
      );
      await session.start(PRODUCT_ID);

      fail(fetchError(410));
      await vi.advanceTimersByTimeAsync(0);
      expect(session.status.value).toBe('active');
    });

    it('renews nothing once the session is committed', async () => {
      const { session, held } = await startedNearExpiry();
      mockFetch.mockResolvedValue(committedFrom(held));
      await session.commit();
      mockFetch.mockReset();

      act();
      await vi.advanceTimersByTimeAsync(10 * MINUTE);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('renews nothing, and drops what is in flight, once the page has gone', async () => {
      const { scope } = await startedNearExpiry();
      mockFetch.mockReturnValue(new Promise(() => {}));

      await vi.advanceTimersByTimeAsync(MINUTE);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(renewCalls()).toHaveLength(1);
      const { signal } = lastRequest().options;

      scope.stop();
      expect(signal?.aborted).toBe(true);
      act();
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(renewCalls()).toHaveLength(1);
    });

    it('reads expiresAt from a change response too', async () => {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();
      await session.start(PRODUCT_ID);

      const later = new Date(NOW.getTime() + 1_800_000).toISOString();
      mockFetch.mockResolvedValue(
        makeCascadedConfiguration({ expiresAt: later }),
      );
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);

      expect(session.configuration.value?.expiresAt).toBe(later);
    });
  });

  describe('expiry', () => {
    async function started(): Promise<
      ReturnType<typeof useConfiguratorSession>
    > {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      return session;
    }

    it('turns a 410 into the expired state, not an error', async () => {
      const session = await started();
      const held = session.configuration.value;
      mockFetch.mockRejectedValue(fetchError(410, 'The configuration expired'));

      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);

      expect(session.status.value).toBe('expired');
      expect(session.busy.value).toBe(false);
      expect(session.error.value).toBeNull();
      // The page still renders what the buyer chose, next to the way back.
      expect(session.configuration.value).toEqual(held);
    });

    it('sends nothing more once the session has expired', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      mockFetch.mockReset();

      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      await session.commit();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('starts over on a fresh session after one expired', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);

      const replacement = makeInitialConfiguration({
        configurationId: 'second-session',
      });
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(replacement);
      await session.start(PRODUCT_ID);

      expect(session.status.value).toBe('active');
      expect(session.configuration.value).toEqual(replacement);
    });
  });

  describe('commit and release', () => {
    async function started(): Promise<{
      session: ReturnType<typeof useConfiguratorSession>;
      initial: Configuration;
    }> {
      const initial = makeInitialConfiguration();
      mockFetch.mockResolvedValue(initial);
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      return { session, initial };
    }

    it('holds the committed summary and closes the session', async () => {
      const { session, initial } = await started();
      const committed = committedFrom(initial);
      mockFetch.mockResolvedValue(committed);

      await session.commit();

      const { url, options } = lastRequest();
      expect(url).toBe(`/api/configurations/${initial.configurationId}/commit`);
      expect(options.method).toBe('POST');
      expect(session.committed.value).toEqual(committed);
      expect(session.status.value).toBe('closed');
    });

    it('deletes the session on release and closes it', async () => {
      const { session, initial } = await started();
      mockFetch.mockResolvedValue(null);

      await session.release();

      const { url, options } = lastRequest();
      expect(url).toBe(`/api/configurations/${initial.configurationId}`);
      expect(options.method).toBe('DELETE');
      expect(session.status.value).toBe('closed');
    });

    // The same 410 covers a finished session and an expired one, so a committed
    // session that kept talking would report itself as expired to a buyer who
    // had just ordered. Staying quiet is what keeps the two states apart.
    it('sends nothing more once it has committed', async () => {
      const { session, initial } = await started();
      mockFetch.mockResolvedValue(committedFrom(initial));
      await session.commit();
      mockFetch.mockReset();

      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      await session.release();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(session.status.value).toBe('closed');
    });

    it('stays open when the release fails', async () => {
      const { session } = await started();
      mockFetch.mockRejectedValue(fetchError(500, 'Nope'));

      await session.release();

      expect(session.status.value).toBe('active');
    });

    it('reports a 410 raised by the commit itself as expired', async () => {
      const { session } = await started();
      mockFetch.mockRejectedValue(fetchError(410, 'The configuration expired'));

      await session.commit();

      expect(session.status.value).toBe('expired');
      expect(session.committed.value).toBeNull();
    });
  });

  describe('adding the committed configuration to the cart', () => {
    const LINE = { cartId: 'cart-1', itemId: 'item-1' };
    const addLine =
      vi.fn<(committed: CommittedConfiguration) => Promise<unknown>>();

    /**
     * Answers by route, so the order of the calls is the composable's own. A
     * promise every time, as `$fetch` answers.
     */
    function answering(routes: {
      commit?: () => unknown;
      reopen?: () => unknown;
      create?: () => unknown;
    }): void {
      mockFetch.mockImplementation(async (url) => {
        if (url.endsWith('/commit')) return (routes.commit ?? never)();
        if (url === '/api/configurations/reopen')
          return (routes.reopen ?? never)();
        if (url === '/api/configurations') return (routes.create ?? never)();
        return never();
      });
    }

    function never(): never {
      throw new Error('unexpected request');
    }

    function urls(): string[] {
      return mockFetch.mock.calls.map(([url]) => url);
    }

    async function startedWithCart(): Promise<{
      session: ReturnType<typeof useConfiguratorSession>;
      initial: Configuration;
    }> {
      const initial = makeInitialConfiguration();
      mockFetch.mockResolvedValue(initial);
      const scope = effectScope();
      const session = scope.run(() =>
        useConfiguratorSession({
          addLine: addLine as (
            committed: CommittedConfiguration,
          ) => Promise<{ cartId: string; itemId: string } | null>,
        }),
      );
      if (!session) throw new Error('The scope produced no session');
      scopes.push(scope);
      await session.start(PRODUCT_ID, 2);
      mockFetch.mockReset();
      return { session, initial };
    }

    function reopenedDocument(): Configuration {
      return { ...makeCascadedConfiguration(), configurationId: 'reopened-1' };
    }

    beforeEach(() => {
      addLine.mockReset().mockResolvedValue(LINE);
    });

    it('commits, adds the record, then holds a session reopened from the new line', async () => {
      const { session, initial } = await startedWithCart();
      const committed = committedFrom(initial);
      const reopened = reopenedDocument();
      answering({ commit: () => committed, reopen: () => reopened });

      await session.commit();

      expect(addLine).toHaveBeenCalledWith(committed);
      expect(urls()).toEqual([
        `/api/configurations/${initial.configurationId}/commit`,
        '/api/configurations/reopen',
      ]);
      expect(lastRequest().options).toMatchObject({
        method: 'POST',
        body: LINE,
      });
      expect(session.configuration.value).toEqual(reopened);
      expect(session.status.value).toBe('active');
      expect(session.committed.value).toBeNull();
      expect(session.error.value).toBeNull();
    });

    it('keeps the form busy, with nothing committed on screen, until the add has answered', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => reopenedDocument(),
      });
      const add = deferred<unknown>();
      addLine.mockReturnValue(add.promise);

      const submitted = session.commit();
      await vi.waitFor(() => expect(addLine).toHaveBeenCalled());

      expect(session.configuration.value).toEqual(initial);
      expect(session.committed.value).toBeNull();
      expect(session.status.value).toBe('active');
      expect(session.busy.value).toBe(true);

      add.resolve(LINE);
      await submitted;
      expect(session.busy.value).toBe(false);
    });

    it('holds neither a document nor a summary while the reopen runs, which the page shows as loading', async () => {
      const { session, initial } = await startedWithCart();
      const reopen = deferred<Configuration>();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => reopen.promise,
      });

      const submitted = session.commit();
      await vi.waitFor(() =>
        expect(urls()).toContain('/api/configurations/reopen'),
      );

      expect(session.configuration.value).toBeNull();
      expect(session.committed.value).toBeNull();
      expect(session.error.value).toBeNull();

      reopen.resolve(reopenedDocument());
      await submitted;
      expect(session.status.value).toBe('active');
    });

    it('sends nothing else to the session while the add is under way', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => reopenedDocument(),
      });
      const add = deferred<unknown>();
      addLine.mockReturnValue(add.promise);

      const submitted = session.commit();
      await vi.waitFor(() => expect(addLine).toHaveBeenCalled());
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      await session.release();
      await session.commit();
      await session.retryAdd();
      add.resolve(LINE);
      await submitted;

      expect(addLine).toHaveBeenCalledOnce();
      expect(urls().filter((url) => url.endsWith('/commit'))).toHaveLength(1);
    });

    it('starts a fresh session for the same product when the reopen fails', async () => {
      const { session, initial } = await startedWithCart();
      const fresh = makeInitialConfiguration();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => {
          throw fetchError(422, 'The configuration cannot be reopened');
        },
        create: () => fresh,
      });

      await session.commit();

      expect(urls().at(-1)).toBe('/api/configurations');
      expect(lastRequest().options.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 2,
      });
      expect(session.configuration.value).toEqual(fresh);
      expect(session.status.value).toBe('active');
      expect(session.committed.value).toBeNull();
      expect(session.error.value).toBeNull();
    });

    it('shows no failure while it falls back from a failed reopen', async () => {
      const { session, initial } = await startedWithCart();
      const create = deferred<Configuration>();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => Promise.reject(fetchError(503, 'unavailable')),
        create: () => create.promise,
      });

      // Every value the error takes, before any render could pick it up.
      const seen: unknown[] = [];
      watch(session.error, (value) => seen.push(value), { flush: 'sync' });

      const submitted = session.commit();
      await vi.waitFor(() => expect(urls().at(-1)).toBe('/api/configurations'));

      expect(seen.filter((value) => value !== null)).toEqual([]);
      expect(session.configuration.value).toBeNull();
      create.resolve(makeInitialConfiguration());
      await submitted;
    });

    it('starts nothing once the page has gone while the reopen ran', async () => {
      const initial = makeInitialConfiguration();
      mockFetch.mockResolvedValue(initial);
      const scope = effectScope();
      const session = scope.run(() =>
        useConfiguratorSession({ addLine: async () => LINE }),
      )!;
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      mockFetch.mockImplementation((url, options) => {
        if (url.endsWith('/commit')) return committedFrom(initial);
        // What ofetch does once the signal fires.
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        });
      });

      const submitted = session.commit();
      await vi.waitFor(() =>
        expect(urls()).toContain('/api/configurations/reopen'),
      );
      scope.stop();
      await submitted;

      expect(urls().filter((url) => url === '/api/configurations')).toEqual([]);
    });

    it.each([
      ['a line to reopen', { cartId: 'cart-1', itemId: 'item-1' }],
      ['no line, which would start afresh', null],
    ])(
      'sends nothing and runs no clock once the page has gone while the add ran, with %s',
      async (_case, line) => {
        const initial = makeInitialConfiguration();
        mockFetch.mockResolvedValue(initial);
        const add = deferred<{ cartId: string; itemId: string } | null>();
        const scope = effectScope();
        const session = scope.run(() =>
          useConfiguratorSession({ addLine: () => add.promise }),
        )!;
        await session.start(PRODUCT_ID);
        mockFetch.mockReset();
        mockFetch.mockImplementation(async (url) =>
          url.endsWith('/commit') ? committedFrom(initial) : initial,
        );

        const submitted = session.commit();
        await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
        await Promise.resolve();
        scope.stop();
        add.resolve(line);
        await submitted;

        expect(urls()).toEqual([
          `/api/configurations/${initial.configurationId}/commit`,
        ]);
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it('waits out a slow reopen and holds what it answers, saying nothing was lost', async () => {
      const { session, initial } = await startedWithCart();
      const reopen = deferred<Configuration>();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => reopen.promise,
      });

      const submitted = session.commit();
      await vi.waitFor(() =>
        expect(urls()).toContain('/api/configurations/reopen'),
      );
      // A long change log: the provider takes its time.
      await vi.advanceTimersByTimeAsync(30_000);
      reopen.resolve(reopenedDocument());
      await submitted;

      expect(session.configuration.value?.configurationId).toBe('reopened-1');
      expect(session.notReopened.value).toBe(false);
    });

    it('says nothing of the kind before any add', async () => {
      const { session } = await startedWithCart();

      expect(session.notReopened.value).toBe(false);
    });

    it('says the choices were not brought back when it fell back to a fresh session', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => {
          throw fetchError(502, 'replay over budget');
        },
        create: () => makeInitialConfiguration(),
      });

      await session.commit();

      expect(session.status.value).toBe('active');
      expect(session.notReopened.value).toBe(true);
    });

    it('says the same when the add answered no line to reopen', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => committedFrom(initial),
        create: () => makeInitialConfiguration(),
      });
      addLine.mockResolvedValue(null);

      await session.commit();

      expect(session.notReopened.value).toBe(true);
    });

    it('forgets the notice on the next add, and on a restart', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => {
          throw fetchError(502, 'replay over budget');
        },
        create: () => makeInitialConfiguration(),
      });
      await session.commit();
      expect(session.notReopened.value).toBe(true);

      answering({
        commit: () => committedFrom(initial),
        reopen: () => reopenedDocument(),
      });
      await session.commit();
      expect(session.notReopened.value).toBe(false);

      answering({
        commit: () => committedFrom(initial),
        reopen: () => {
          throw fetchError(502, 'replay over budget');
        },
        create: () => makeInitialConfiguration(),
      });
      await session.commit();
      mockFetch.mockResolvedValue(null);
      await session.release();
      expect(session.notReopened.value).toBe(false);
    });

    it('starts a fresh session when the add answers no line to reopen', async () => {
      const { session, initial } = await startedWithCart();
      const fresh = makeInitialConfiguration();
      answering({ commit: () => committedFrom(initial), create: () => fresh });
      addLine.mockResolvedValue(null);

      await session.commit();

      expect(urls()).not.toContain('/api/configurations/reopen');
      expect(session.configuration.value).toEqual(fresh);
      expect(session.status.value).toBe('active');
    });

    it('keeps the committed record and says the add failed when only the add fails', async () => {
      const { session, initial } = await startedWithCart();
      const committed = committedFrom(initial);
      answering({ commit: () => committed });
      addLine.mockRejectedValue(
        fetchError(409, 'The configured line was not added'),
      );

      await session.commit();

      expect(session.committed.value).toEqual(committed);
      expect(session.status.value).toBe('closed');
      expect(session.error.value).toMatchObject({
        status: 409,
        message: 'The configured line was not added',
      });
      expect(urls()).not.toContain('/api/configurations/reopen');
    });

    it('does not call a committed session expired when its add answers 410', async () => {
      const { session, initial } = await startedWithCart();
      answering({ commit: () => committedFrom(initial) });
      addLine.mockRejectedValue(fetchError(410, 'gone'));

      await session.commit();

      expect(session.status.value).toBe('closed');
      expect(session.error.value).toMatchObject({ status: 410 });
    });

    it('adds nothing when the commit fails', async () => {
      const { session } = await startedWithCart();
      answering({
        commit: () => {
          throw fetchError(422, 'Not complete');
        },
      });

      await session.commit();

      expect(addLine).not.toHaveBeenCalled();
      expect(session.committed.value).toBeNull();
      expect(session.status.value).toBe('active');
    });

    it('adds nothing, and closes the session, when the commit is priced in another currency', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => {
          throw fetchError(409, 'currency', 'CURRENCY_MISMATCH');
        },
      });

      await session.commit();

      expect(addLine).not.toHaveBeenCalled();
      expect(session.committed.value).toBeNull();
      expect(session.status.value).toBe('closed');
      expect(session.configuration.value).toEqual(initial);
      expect(session.error.value).toMatchObject({
        status: 409,
        code: 'CURRENCY_MISMATCH',
      });
    });

    it('then releases nothing, and restores the held choices in a new session', async () => {
      const { session } = await startedWithCart();
      answering({
        commit: () => {
          throw fetchError(409, 'currency', 'CURRENCY_MISMATCH');
        },
      });
      await session.commit();
      mockFetch.mockReset();
      const fresh = makeInitialConfiguration();
      mockFetch.mockResolvedValue({ configuration: fresh, replayed: true });

      await session.release();
      await session.restore(PRODUCT_ID);

      expect(urls()).toEqual(['/api/configurations/restore']);
      expect(session.status.value).toBe('active');
      expect(session.configuration.value).toEqual(fresh);
      expect(session.error.value).toBeNull();
    });

    it('closes the session when a change batch is priced in another currency', async () => {
      const { session } = await startedWithCart();
      mockFetch.mockRejectedValue(
        fetchError(409, 'currency', 'CURRENCY_MISMATCH'),
      );

      await session.applyChanges([{ type: 'quantity', quantity: 3 }]);

      expect(session.status.value).toBe('closed');
    });

    it('keeps the session for a 409 of another kind', async () => {
      const { session } = await startedWithCart();
      mockFetch.mockRejectedValue(fetchError(409, 'conflict', 'CONFLICT'));

      await session.applyChanges([{ type: 'quantity', quantity: 3 }]);

      expect(session.status.value).toBe('active');
    });

    it('retries the add with the record it kept, never commits again, then reopens', async () => {
      const { session, initial } = await startedWithCart();
      const committed = committedFrom(initial);
      const reopened = reopenedDocument();
      answering({ commit: () => committed, reopen: () => reopened });
      addLine.mockRejectedValueOnce(fetchError(502, 'unreachable'));
      await session.commit();

      await session.retryAdd();

      expect(addLine).toHaveBeenCalledTimes(2);
      expect(addLine).toHaveBeenLastCalledWith(committed);
      expect(urls().filter((url) => url.endsWith('/commit'))).toHaveLength(1);
      expect(session.configuration.value).toEqual(reopened);
      expect(session.committed.value).toBeNull();
      expect(session.status.value).toBe('active');
    });

    it('keeps the record when the retry fails too', async () => {
      const { session, initial } = await startedWithCart();
      const committed = committedFrom(initial);
      answering({ commit: () => committed });
      addLine.mockRejectedValue(fetchError(502, 'unreachable'));
      await session.commit();

      await session.retryAdd();

      expect(addLine).toHaveBeenCalledTimes(2);
      expect(session.committed.value).toEqual(committed);
      expect(session.error.value).toMatchObject({ status: 502 });
    });

    it('adds nothing on a retry before anything is committed', async () => {
      const { session } = await startedWithCart();

      await session.retryAdd();

      expect(addLine).not.toHaveBeenCalled();
    });

    it('posts the next change to the reopened session', async () => {
      const { session, initial } = await startedWithCart();
      answering({
        commit: () => committedFrom(initial),
        reopen: () => reopenedDocument(),
      });
      await session.commit();
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(reopenedDocument());

      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);

      expect(lastRequest().url).toBe('/api/configurations/reopened-1/changes');
    });

    it('only commits, and holds the record, when it was given no way to add', async () => {
      const initial = makeInitialConfiguration();
      mockFetch.mockResolvedValue(initial);
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockResolvedValue(committedFrom(initial));

      await session.commit();
      await session.retryAdd();

      expect(session.committed.value).not.toBeNull();
      expect(session.status.value).toBe('closed');
      expect(session.error.value).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // The blur that sends a typed value starts its batch on the mouse-down that
  // also presses the action, so the press arrives with the form busy.
  describe('a press during a change batch', () => {
    const LINE = { cartId: 'cart-1', itemId: 'item-1' };
    const CHANGE = {
      type: 'variable',
      variableId: 'width',
      value: 140,
    } as const;
    const addLine =
      vi.fn<(committed: CommittedConfiguration) => Promise<unknown>>();

    let batch: ReturnType<typeof deferred<Configuration>>;
    let commitAnswer: ReturnType<typeof deferred<CommittedConfiguration>>;

    function urls(): string[] {
      return mockFetch.mock.calls.map(([url]) => url);
    }

    function commits(): number {
      return urls().filter((url) => url.endsWith('/commit')).length;
    }

    async function startedWith(document: Configuration): Promise<{
      session: ReturnType<typeof useConfiguratorSession>;
      scope: EffectScope;
    }> {
      mockFetch.mockResolvedValue(document);
      const scope = effectScope();
      const session = scope.run(() =>
        useConfiguratorSession({
          addLine: addLine as (
            committed: CommittedConfiguration,
          ) => Promise<{ cartId: string; itemId: string } | null>,
        }),
      );
      if (!session) throw new Error('The scope produced no session');
      scopes.push(scope);
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url) => {
        if (url.endsWith('/changes')) return batch.promise;
        if (url.endsWith('/commit')) return commitAnswer.promise;
        if (url === '/api/configurations/reopen') {
          return { ...makeValidConfiguration(), configurationId: 'reopened-1' };
        }
        throw new Error(`unexpected request ${url}`);
      });
      return { session, scope };
    }

    beforeEach(() => {
      addLine.mockReset().mockResolvedValue(LINE);
      batch = deferred<Configuration>();
      commitAnswer = deferred<CommittedConfiguration>();
    });

    it('commits once and adds once after the batch answers valid', async () => {
      const { session } = await startedWith(makeInitialConfiguration());
      const valid = makeValidConfiguration();
      commitAnswer.resolve(committedFrom(valid));

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      expect(commits()).toBe(0);

      batch.resolve(valid);
      await changed;

      expect(commits()).toBe(1);
      expect(addLine).toHaveBeenCalledTimes(1);
      expect(session.configuration.value?.configurationId).toBe('reopened-1');
    });

    it('drops the press when the answered document is not valid', async () => {
      const { session } = await startedWith(makeInitialConfiguration());

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      batch.resolve(makeInvalidConfiguration());
      await changed;

      expect(commits()).toBe(0);
      expect(addLine).not.toHaveBeenCalled();
      expect(session.status.value).toBe('active');
    });

    it('drops the press when the provider refuses the batch, and keeps the refusal', async () => {
      const { session } = await startedWith(makeValidConfiguration());
      mockFetch.mockRejectedValueOnce(
        fetchError(422, 'Validation failed', 'VALIDATION_ERROR'),
      );

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      await changed;

      expect(commits()).toBe(0);
      expect(addLine).not.toHaveBeenCalled();
      expect(session.error.value?.code).toBe('VALIDATION_ERROR');
    });

    it('drops the press when the batch finds the session expired', async () => {
      const { session } = await startedWith(makeValidConfiguration());
      mockFetch.mockRejectedValueOnce(fetchError(410, 'Gone'));

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      await changed;

      expect(commits()).toBe(0);
      expect(session.status.value).toBe('expired');
    });

    it('commits once for two presses during one batch', async () => {
      const { session } = await startedWith(makeInitialConfiguration());
      const valid = makeValidConfiguration();
      commitAnswer.resolve(committedFrom(valid));

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      void session.commit();
      batch.resolve(valid);
      await changed;

      expect(commits()).toBe(1);
      expect(addLine).toHaveBeenCalledTimes(1);
    });

    // The second batch is dropped while the first runs; the press is still
    // the first batch's to answer.
    it('leaves the press to the running batch when another batch is dropped', async () => {
      const { session } = await startedWith(makeInitialConfiguration());
      const valid = makeValidConfiguration();
      commitAnswer.resolve(committedFrom(valid));

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      await session.applyChanges([{ ...CHANGE, value: 160 }]);
      batch.resolve(valid);
      await changed;

      expect(urls().filter((url) => url.endsWith('/changes'))).toHaveLength(1);
      expect(commits()).toBe(1);
      expect(addLine).toHaveBeenCalledTimes(1);
    });

    it('does not remember a press made while the commit is in flight', async () => {
      const valid = makeValidConfiguration();
      const { session } = await startedWith(valid);

      const first = session.commit();
      void session.commit();
      commitAnswer.resolve(committedFrom(valid));
      await first;

      expect(commits()).toBe(1);
      expect(addLine).toHaveBeenCalledTimes(1);
      // The session reopened from the new line is the buyer's, not a press's,
      // and its next batch carries no press either.
      expect(session.configuration.value?.configurationId).toBe('reopened-1');
      expect(session.status.value).toBe('active');
      batch.resolve(makeValidConfiguration());
      await session.applyChanges([CHANGE]);
      expect(commits()).toBe(1);
    });

    it('does not remember a press made while the add is in flight', async () => {
      const valid = makeValidConfiguration();
      const { session } = await startedWith(valid);
      const added = deferred<{ cartId: string; itemId: string }>();
      addLine.mockReturnValueOnce(added.promise);
      commitAnswer.resolve(committedFrom(valid));

      const first = session.commit();
      await vi.waitFor(() => expect(addLine).toHaveBeenCalledTimes(1));
      void session.commit();
      added.resolve(LINE);
      await first;

      expect(commits()).toBe(1);
      expect(addLine).toHaveBeenCalledTimes(1);
    });

    it('runs the caller’s hook when the remembered commit goes out, not at the press', async () => {
      const { session } = await startedWith(makeInitialConfiguration());
      const valid = makeValidConfiguration();
      commitAnswer.resolve(committedFrom(valid));
      const onRun = vi.fn(() => {
        expect(commits()).toBe(0);
      });

      const changed = session.applyChanges([CHANGE]);
      void session.commit(onRun);
      expect(onRun).not.toHaveBeenCalled();

      batch.resolve(valid);
      await changed;

      expect(onRun).toHaveBeenCalledTimes(1);
      expect(commits()).toBe(1);
    });

    it('does not run the hook for a dropped press', async () => {
      const { session } = await startedWith(makeInitialConfiguration());
      const onRun = vi.fn();

      const changed = session.applyChanges([CHANGE]);
      void session.commit(onRun);
      batch.resolve(makeInvalidConfiguration());
      await changed;

      expect(onRun).not.toHaveBeenCalled();
    });

    it('commits nothing once the page has gone during the batch', async () => {
      const { session, scope } = await startedWith(makeInitialConfiguration());
      mockFetch.mockImplementation(async (url, options) => {
        if (url.endsWith('/changes')) {
          return new Promise((_, reject) =>
            options?.signal?.addEventListener('abort', () =>
              reject(
                Object.assign(new Error('aborted'), { name: 'AbortError' }),
              ),
            ),
          );
        }
        if (url.endsWith('/commit'))
          return committedFrom(makeValidConfiguration());
        return null;
      });

      const changed = session.applyChanges([CHANGE]);
      void session.commit();
      scope.stop();
      await changed;

      expect(commits()).toBe(0);
      expect(addLine).not.toHaveBeenCalled();
    });
  });

  describe('replaying an order row', () => {
    const ROW = {
      publicOrderId: '6f1c2a9e-0b8d-4e3f-9a51-2c7d8e4b1f03',
      row: 1,
    };

    it('opens no session on the server', async () => {
      browser.value = false;
      const session = open();

      await session.replay(PRODUCT_ID, ROW);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(session.status.value).toBe('idle');
    });

    it('asks the server to replay the row into a new session, and holds it', async () => {
      const replayed = makeCascadedConfiguration();
      mockFetch.mockResolvedValue({ configuration: replayed, replayed: true });
      const session = open();

      await session.replay(PRODUCT_ID, ROW);

      const { url, options } = lastRequest();
      expect(url).toBe('/api/configurations/from-order');
      expect(options.method).toBe('POST');
      expect(options.body).toEqual({ productId: PRODUCT_ID, ...ROW });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(session.configuration.value).toEqual(replayed);
      expect(session.status.value).toBe('active');
      expect(session.notReplayed.value).toBe(false);
    });

    it("holds the session it is given and says the order's choices did not come back", async () => {
      const fresh = makeInitialConfiguration();
      mockFetch.mockResolvedValue({ configuration: fresh, replayed: false });
      const session = open();

      await session.replay(PRODUCT_ID, ROW);

      expect(session.configuration.value).toEqual(fresh);
      expect(session.status.value).toBe('active');
      expect(session.notReplayed.value).toBe(true);
      expect(session.error.value).toBeNull();
    });

    it('fails as a start fails when no session could be created', async () => {
      mockFetch.mockRejectedValue(fetchError(403, 'No customer number'));
      const session = open();

      await session.replay(PRODUCT_ID, ROW);

      expect(session.status.value).toBe('idle');
      expect(session.error.value).toEqual({
        status: 403,
        message: 'No customer number',
      });
      expect(session.notReplayed.value).toBe(false);
    });

    it('starts a fresh session of one for the same product when the line added from it cannot be reopened', async () => {
      const replayed = makeInitialConfiguration();
      const fresh = makeCascadedConfiguration();
      const scope = effectScope();
      const session = scope.run(() =>
        useConfiguratorSession({
          addLine: async () => ({ cartId: 'cart-1', itemId: 'item-1' }),
        }),
      );
      if (!session) throw new Error('The scope produced no session');
      scopes.push(scope);
      mockFetch.mockResolvedValue({ configuration: replayed, replayed: true });
      await session.replay(PRODUCT_ID, ROW);
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url) => {
        if (url.endsWith('/commit')) return committedFrom(replayed);
        if (url === '/api/configurations/reopen') throw fetchError(503, 'no');
        if (url === '/api/configurations') return fresh;
        throw new Error(`unexpected request to ${url}`);
      });

      await session.commit();

      expect(lastRequest().url).toBe('/api/configurations');
      expect(lastRequest().options.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 1,
      });
      expect(session.configuration.value).toEqual(fresh);
    });

    it('replays nothing while a session is active', async () => {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();

      await session.replay(PRODUCT_ID, ROW);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('stops saying so once the buyer commits, and once the session is released', async () => {
      const fresh = makeInitialConfiguration();
      mockFetch.mockResolvedValue({ configuration: fresh, replayed: false });
      const session = open();
      await session.replay(PRODUCT_ID, ROW);

      mockFetch.mockResolvedValue(committedFrom(fresh));
      await session.commit();
      expect(session.notReplayed.value).toBe(false);

      mockFetch.mockResolvedValue({ configuration: fresh, replayed: false });
      const other = open();
      await other.replay(PRODUCT_ID, ROW);
      mockFetch.mockResolvedValue(null);
      await other.release();
      expect(other.notReplayed.value).toBe(false);
    });
  });

  describe('restoring the choices after expiry', () => {
    async function expired(
      held = makeCascadedConfiguration(),
    ): Promise<ReturnType<typeof useConfiguratorSession>> {
      mockFetch.mockResolvedValue(held);
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      mockFetch.mockReset();
      return session;
    }

    it("sends the expired document's choices and quantity to a new session, and holds it", async () => {
      const held = makeCascadedConfiguration({ quantity: 3 });
      const session = await expired(held);
      const restored = makeCascadedConfiguration({
        configurationId: 'restored',
      });
      mockFetch.mockResolvedValue({ configuration: restored, replayed: true });

      await session.restore(PRODUCT_ID);

      const { url, options } = lastRequest();
      expect(url).toBe('/api/configurations/restore');
      expect(options.method).toBe('POST');
      expect(options.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 3,
        ...choicesOf(held),
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(session.configuration.value).toEqual(restored);
      expect(session.status.value).toBe('active');
      expect(session.notRestored.value).toBe(false);
      expect(session.notReplayed.value).toBe(false);
    });

    it('holds the session it is given and says the choices did not come back', async () => {
      const session = await expired();
      const fresh = makeInitialConfiguration({ configurationId: 'fresh' });
      mockFetch.mockResolvedValue({ configuration: fresh, replayed: false });

      await session.restore(PRODUCT_ID);

      expect(session.configuration.value).toEqual(fresh);
      expect(session.status.value).toBe('active');
      expect(session.notRestored.value).toBe(true);
      expect(session.notReplayed.value).toBe(false);
      expect(session.error.value).toBeNull();
    });

    it('leaves the expired face while it runs, which the page shows as loading', async () => {
      const session = await expired();
      const pending = deferred<unknown>();
      mockFetch.mockReturnValue(pending.promise);

      const restoring = session.restore(PRODUCT_ID);

      expect(session.status.value).toBe('closed');
      expect(session.busy.value).toBe(true);
      pending.resolve({
        configuration: makeInitialConfiguration(),
        replayed: true,
      });
      await restoring;
    });

    it('fails as a start fails when no session could be created', async () => {
      const session = await expired();
      mockFetch.mockRejectedValue(fetchError(422, 'quantity refused'));

      await session.restore(PRODUCT_ID);

      expect(session.status.value).toBe('closed');
      expect(session.error.value).toEqual({
        status: 422,
        message: 'quantity refused',
      });
      expect(session.notRestored.value).toBe(false);
    });

    it("drops the order's notice once it restores an order row's session, which then says only its own", async () => {
      const held = makeCascadedConfiguration();
      mockFetch.mockResolvedValue({ configuration: held, replayed: false });
      const session = open();
      await session.replay(PRODUCT_ID, {
        publicOrderId: '6f1c2a9e-0b8d-4e3f-9a51-2c7d8e4b1f03',
        row: 0,
      });
      expect(session.notReplayed.value).toBe(true);
      mockFetch.mockReset();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        configuration: makeCascadedConfiguration({
          configurationId: 'restored',
        }),
        replayed: true,
      });

      await session.restore(PRODUCT_ID);

      expect(lastRequest().url).toBe('/api/configurations/restore');
      expect(session.notReplayed.value).toBe(false);
      expect(session.notRestored.value).toBe(false);
    });

    it('starts from the defaults when it holds no document to restore', async () => {
      const session = open();
      const fresh = makeInitialConfiguration();
      mockFetch.mockResolvedValue(fresh);

      await session.restore(PRODUCT_ID);

      expect(lastRequest().url).toBe('/api/configurations');
      expect(lastRequest().options.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 1,
      });
      expect(session.configuration.value).toEqual(fresh);
    });

    it('restores nothing while a session is active, nor on the server', async () => {
      mockFetch.mockResolvedValue(makeInitialConfiguration());
      const session = open();
      await session.start(PRODUCT_ID);
      mockFetch.mockReset();

      await session.restore(PRODUCT_ID);
      expect(mockFetch).not.toHaveBeenCalled();

      const other = await expired();
      browser.value = false;
      await other.restore(PRODUCT_ID);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(other.status.value).toBe('expired');
    });

    it('starts a later fresh session at the restored quantity', async () => {
      const held = makeCascadedConfiguration({ quantity: 3 });
      const scope = effectScope();
      const session = scope.run(() =>
        useConfiguratorSession({ addLine: async () => null }),
      );
      if (!session) throw new Error('The scope produced no session');
      scopes.push(scope);
      mockFetch.mockResolvedValue(held);
      await session.start(PRODUCT_ID);
      mockFetch.mockRejectedValue(fetchError(410));
      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      mockFetch.mockResolvedValue({ configuration: held, replayed: true });
      await session.restore(PRODUCT_ID);
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url) =>
        url.endsWith('/commit') ? committedFrom(held) : held,
      );

      await session.commit();

      expect(lastRequest().url).toBe('/api/configurations');
      expect(lastRequest().options.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 3,
      });
    });

    it('stops saying so once the buyer commits, and once the session is released', async () => {
      const fresh = makeInitialConfiguration();
      const session = await expired();
      mockFetch.mockResolvedValue({ configuration: fresh, replayed: false });
      await session.restore(PRODUCT_ID);
      mockFetch.mockResolvedValue(committedFrom(fresh));
      await session.commit();
      expect(session.notRestored.value).toBe(false);

      const other = await expired();
      mockFetch.mockResolvedValue({ configuration: fresh, replayed: false });
      await other.restore(PRODUCT_ID);
      mockFetch.mockResolvedValue(null);
      await other.release();
      expect(other.notRestored.value).toBe(false);
    });
  });

  describe('editing a configured cart line', () => {
    const LINE = { cartId: 'cart-1', itemId: 'item-1' };
    const addLine =
      vi.fn<(committed: CommittedConfiguration) => Promise<unknown>>();
    const replaceLine =
      vi.fn<
        (committed: CommittedConfiguration, line: unknown) => Promise<unknown>
      >();

    function reopened(id = 'reopened-1'): Configuration {
      return { ...makeCascadedConfiguration(), configurationId: id };
    }

    /** Answers by route; every reopen answers the next document in `reopens`. */
    function answering(routes: {
      reopen?: () => unknown;
      create?: () => unknown;
      commit?: () => unknown;
      release?: () => unknown;
      changes?: () => unknown;
    }): void {
      mockFetch.mockImplementation(async (url, options) => {
        if (url === '/api/configurations/reopen')
          return (routes.reopen ?? never)();
        if (url === '/api/configurations') return (routes.create ?? never)();
        if (url.endsWith('/commit')) return (routes.commit ?? never)();
        if (url.endsWith('/changes')) return (routes.changes ?? never)();
        if (options?.method === 'DELETE')
          return (routes.release ?? (() => null))();
        return never();
      });
    }

    function never(): never {
      throw new Error('unexpected request');
    }

    function calls(): string[] {
      return mockFetch.mock.calls.map(
        ([url, options]) => `${options?.method ?? 'GET'} ${url}`,
      );
    }

    function openEditing(): ReturnType<typeof useConfiguratorSession> {
      const scope = effectScope();
      const session = scope.run(() =>
        useConfiguratorSession({
          addLine: addLine as (
            committed: CommittedConfiguration,
          ) => Promise<{ cartId: string; itemId: string } | null>,
          replaceLine: replaceLine as (
            committed: CommittedConfiguration,
            line: { cartId: string; itemId: string },
          ) => Promise<{ cartId: string; itemId: string } | null>,
        }),
      );
      if (!session) throw new Error('The scope produced no session');
      scopes.push(scope);
      return session;
    }

    async function editing(): Promise<
      ReturnType<typeof useConfiguratorSession>
    > {
      const session = openEditing();
      answering({ reopen: () => reopened() });
      await session.edit(PRODUCT_ID, LINE);
      mockFetch.mockReset();
      return session;
    }

    beforeEach(() => {
      addLine.mockReset().mockResolvedValue(LINE);
      replaceLine.mockReset().mockResolvedValue(LINE);
    });

    describe('opening the line', () => {
      it('reopens the line rather than creating a session, and holds it as the line being edited', async () => {
        const session = openEditing();
        answering({ reopen: () => reopened() });

        await session.edit(PRODUCT_ID, LINE);

        expect(calls()).toEqual(['POST /api/configurations/reopen']);
        expect(lastRequest().options.body).toEqual(LINE);
        expect(session.configuration.value).toEqual(reopened());
        expect(session.status.value).toBe('active');
        expect(session.editing.value).toEqual(LINE);
        expect(session.editNotice.value).toBeNull();
      });

      it('opens nothing on the server', async () => {
        browser.value = false;
        const session = openEditing();

        await session.edit(PRODUCT_ID, LINE);

        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('starts afresh, still editing the line, when the configuration cannot be reopened', async () => {
        const session = openEditing();
        const fresh = makeInitialConfiguration();
        answering({
          reopen: () => {
            throw fetchError(422, 'The configuration cannot be reopened');
          },
          create: () => fresh,
        });

        await session.edit(PRODUCT_ID, LINE);

        expect(calls()).toEqual([
          'POST /api/configurations/reopen',
          'POST /api/configurations',
        ]);
        expect(lastRequest().options.body).toEqual({
          productId: PRODUCT_ID,
          quantity: 1,
        });
        expect(session.configuration.value).toEqual(fresh);
        expect(session.editing.value).toEqual(LINE);
        expect(session.editNotice.value).toBe('not_reopenable');
        expect(session.error.value).toBeNull();
      });

      it.each([
        ['the line is gone or carries no configuration', 404, 'CART_LINE_GONE'],
        ["the cart is another company's", 403, 'CART_NOT_OWN'],
      ])(
        'stops editing and starts afresh when %s',
        async (_case, status, code) => {
          const session = openEditing();
          const fresh = makeInitialConfiguration();
          answering({
            reopen: () => {
              throw fetchError(status, 'no', code);
            },
            create: () => fresh,
          });

          await session.edit(PRODUCT_ID, LINE);

          expect(session.configuration.value).toEqual(fresh);
          expect(session.editing.value).toBeNull();
          expect(session.editNotice.value).toBe('line_gone');
          expect(session.error.value).toBeNull();
        },
      );

      it.each([
        ['the replay over budget', 502, undefined],
        ['a timeout', 504, undefined],
        ['an unreachable backend', 0, undefined],
        ['a buyer without a customer number', 403, 'FORBIDDEN'],
        ['a catalogue-mode tenant', 403, undefined],
        ['an unknown configuration', 404, 'NOT_FOUND'],
      ])(
        'says the line could not be opened, still editing, on %s',
        async (_case, status, code) => {
          const session = openEditing();
          answering({
            reopen: () => {
              throw fetchError(status, 'no', code);
            },
          });

          await session.edit(PRODUCT_ID, LINE);

          expect(calls()).toEqual(['POST /api/configurations/reopen']);
          expect(session.configuration.value).toBeNull();
          expect(session.editing.value).toEqual(LINE);
          expect(session.error.value).toMatchObject({ status });
        },
      );

      it('opens the line again on a retry after it could not be opened', async () => {
        const session = openEditing();
        answering({
          reopen: () => {
            throw fetchError(502);
          },
        });
        await session.edit(PRODUCT_ID, LINE);
        answering({ reopen: () => reopened() });

        await session.reopenLine();

        expect(session.configuration.value).toEqual(reopened());
        expect(session.error.value).toBeNull();
        expect(session.status.value).toBe('active');
      });

      it('is not editing after an ordinary start, nor after an add', async () => {
        const initial = makeInitialConfiguration();
        const session = openEditing();
        mockFetch.mockResolvedValue(initial);
        await session.start(PRODUCT_ID);
        expect(session.editing.value).toBeNull();

        mockFetch.mockReset();
        answering({
          commit: () => committedFrom(initial),
          reopen: () => reopened(),
        });
        await session.commit();

        expect(addLine).toHaveBeenCalled();
        expect(replaceLine).not.toHaveBeenCalled();
        expect(session.editing.value).toBeNull();
      });
    });

    describe('updating the line', () => {
      it('commits, puts the record on the line instead of adding one, then carries on from the updated line, no longer editing', async () => {
        const session = await editing();
        const committed = committedFrom(reopened());
        const after = reopened('reopened-2');
        answering({ commit: () => committed, reopen: () => after });

        await session.commit();

        expect(replaceLine).toHaveBeenCalledWith(committed, LINE);
        expect(addLine).not.toHaveBeenCalled();
        expect(calls()).toEqual([
          'POST /api/configurations/reopened-1/commit',
          'POST /api/configurations/reopen',
        ]);
        expect(lastRequest().options.body).toEqual(LINE);
        expect(session.configuration.value).toEqual(after);
        expect(session.editing.value).toBeNull();
        expect(session.status.value).toBe('active');
      });

      it('keeps the record, still editing, when the swap fails after the commit', async () => {
        const session = await editing();
        const committed = committedFrom(reopened());
        answering({ commit: () => committed });
        replaceLine.mockRejectedValue(fetchError(409, 'not updated'));

        await session.commit();

        expect(session.committed.value).toEqual(committed);
        expect(session.status.value).toBe('closed');
        expect(session.editing.value).toEqual(LINE);
        expect(session.error.value).toMatchObject({ status: 409 });
      });

      it('retries the swap with the record it kept, never commits again', async () => {
        const session = await editing();
        const committed = committedFrom(reopened());
        answering({ commit: () => committed, reopen: () => reopened('r-2') });
        replaceLine.mockRejectedValueOnce(fetchError(502, 'unreachable'));
        await session.commit();

        await session.retryAdd();

        expect(replaceLine).toHaveBeenCalledTimes(2);
        expect(replaceLine).toHaveBeenLastCalledWith(committed, LINE);
        expect(addLine).not.toHaveBeenCalled();
        expect(calls().filter((call) => call.endsWith('/commit'))).toHaveLength(
          1,
        );
        expect(session.editing.value).toBeNull();
        expect(session.configuration.value?.configurationId).toBe('r-2');
      });
    });

    describe('reverting and cancelling', () => {
      it("reverts by releasing the session and opening the line's own choices again, still editing", async () => {
        const session = await editing();
        answering({ reopen: () => reopened('reopened-2') });

        await session.revertEdit();

        expect(calls()).toEqual([
          'DELETE /api/configurations/reopened-1',
          'POST /api/configurations/reopen',
        ]);
        expect(session.configuration.value?.configurationId).toBe('reopened-2');
        expect(session.editing.value).toEqual(LINE);
      });

      it('cancels by releasing the session, then carries on from the unchanged line, no longer editing', async () => {
        const session = await editing();
        answering({ reopen: () => reopened('reopened-2') });

        await session.cancelEdit();

        expect(calls()).toEqual([
          'DELETE /api/configurations/reopened-1',
          'POST /api/configurations/reopen',
        ]);
        expect(replaceLine).not.toHaveBeenCalled();
        expect(session.configuration.value?.configurationId).toBe('reopened-2');
        expect(session.editing.value).toBeNull();
      });

      it('cancels a session that has expired without releasing it again', async () => {
        const session = await editing();
        answering({
          changes: () => {
            throw fetchError(410, 'gone');
          },
          reopen: () => reopened('reopened-2'),
        });
        await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
        expect(session.status.value).toBe('expired');
        mockFetch.mockClear();

        await session.cancelEdit();

        expect(calls()).toEqual(['POST /api/configurations/reopen']);
        expect(session.editing.value).toBeNull();
      });

      it('cancels after a failed swap, leaving the kept record behind', async () => {
        const session = await editing();
        answering({ commit: () => committedFrom(reopened()) });
        replaceLine.mockRejectedValue(fetchError(409));
        await session.commit();
        answering({ reopen: () => reopened('reopened-2') });
        mockFetch.mockClear();

        await session.cancelEdit();

        expect(calls()).toEqual(['POST /api/configurations/reopen']);
        expect(session.committed.value).toBeNull();
        expect(session.editing.value).toBeNull();
        expect(session.status.value).toBe('active');
      });
    });

    describe('an expired session', () => {
      it("opens the line's choices again on a restart, still editing", async () => {
        const session = await editing();
        answering({
          changes: () => {
            throw fetchError(410, 'gone');
          },
          reopen: () => reopened('reopened-2'),
        });
        await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
        expect(session.status.value).toBe('expired');

        await session.reopenLine();

        expect(session.configuration.value?.configurationId).toBe('reopened-2');
        expect(session.status.value).toBe('active');
        expect(session.editing.value).toEqual(LINE);
      });
    });

    describe('guards', () => {
      it('opens no line while a session is active', async () => {
        const session = await editing();

        await session.edit(PRODUCT_ID, { cartId: 'cart-1', itemId: 'item-2' });

        expect(mockFetch).not.toHaveBeenCalled();
        expect(session.editing.value).toEqual(LINE);
      });

      it('reopens, reverts and cancels nothing when no line is being edited', async () => {
        const initial = makeInitialConfiguration();
        const session = openEditing();
        mockFetch.mockResolvedValue(initial);
        await session.start(PRODUCT_ID);
        mockFetch.mockReset();

        await session.reopenLine();
        await session.revertEdit();
        await session.cancelEdit();

        expect(mockFetch).not.toHaveBeenCalled();
        expect(session.configuration.value).toEqual(initial);
      });

      it.each(['revertEdit', 'cancelEdit'] as const)(
        '%s stops when the session could not be released',
        async (verb) => {
          const session = await editing();
          answering({
            release: () => {
              throw fetchError(502);
            },
            reopen: () => reopened('reopened-2'),
          });

          await session[verb]();

          expect(calls()).toEqual(['DELETE /api/configurations/reopened-1']);
          expect(session.editing.value).toEqual(LINE);
          expect(session.error.value).toMatchObject({ status: 502 });
        },
      );

      it("reverts an expired session to the line's choices without releasing it", async () => {
        const session = await editing();
        answering({
          changes: () => {
            throw fetchError(410, 'gone');
          },
          reopen: () => reopened('reopened-2'),
        });
        await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
        mockFetch.mockClear();

        await session.revertEdit();

        expect(calls()).toEqual(['POST /api/configurations/reopen']);
        expect(session.configuration.value?.configurationId).toBe('reopened-2');
      });

      it('leaves the expired face while the line is reopened, which the page shows as loading', async () => {
        const session = await editing();
        const reopen = deferred<Configuration>();
        answering({
          changes: () => {
            throw fetchError(410, 'gone');
          },
          reopen: () => reopen.promise,
        });
        await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
        expect(session.status.value).toBe('expired');

        const reopening = session.reopenLine();
        expect(session.status.value).toBe('closed');

        reopen.resolve(reopened('reopened-2'));
        await reopening;
        expect(session.status.value).toBe('active');
      });
    });

    it('carries on from the edited line when the swap answers no line of its own', async () => {
      const session = await editing();
      answering({
        commit: () => committedFrom(reopened()),
        reopen: () => reopened('reopened-2'),
      });
      replaceLine.mockResolvedValue(null);

      await session.commit();

      expect(lastRequest().url).toBe('/api/configurations/reopen');
      expect(lastRequest().options.body).toEqual(LINE);
      expect(session.configuration.value?.configurationId).toBe('reopened-2');
    });

    it('starts afresh, not editing, when the line cannot be reopened after the update', async () => {
      const session = await editing();
      const fresh = makeInitialConfiguration();
      answering({
        commit: () => committedFrom(reopened()),
        reopen: () => {
          throw fetchError(502);
        },
        create: () => fresh,
      });

      await session.commit();

      expect(session.configuration.value).toEqual(fresh);
      expect(session.status.value).toBe('active');
      expect(session.editing.value).toBeNull();
      expect(session.notReopened.value).toBe(true);
    });

    it('keeps editing through an ordinary restart, which starts from the defaults', async () => {
      const session = await editing();
      const fresh = makeInitialConfiguration();
      answering({ create: () => fresh });

      await session.release();
      await session.start(PRODUCT_ID);

      expect(session.configuration.value).toEqual(fresh);
      expect(session.editing.value).toEqual(LINE);
    });
  });

  describe('unmount', () => {
    it('aborts the request that is still in flight', async () => {
      mockFetch.mockReturnValue(deferred<Configuration>().promise);
      const { session, scope } = startSession();

      void session.start(PRODUCT_ID);
      const { options } = lastRequest();
      expect(options.signal?.aborted).toBe(false);

      scope.stop();

      expect(options.signal?.aborted).toBe(true);
    });

    it('leaves an aborted request without an error to render', async () => {
      // What ofetch rejects with once the signal fires — an abandoned request
      // is not a failure the page should be told about.
      mockFetch.mockRejectedValue(
        Object.assign(new Error('The operation was aborted'), {
          name: 'AbortError',
        }),
      );
      const { session, scope } = startSession();

      const started = session.start(PRODUCT_ID);
      scope.stop();
      await started;

      expect(session.error.value).toBeNull();
      expect(session.busy.value).toBe(false);
    });
  });
});
