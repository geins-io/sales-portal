import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, watch, type EffectScope } from 'vue';
import type {
  CommittedConfiguration,
  Configuration,
} from '#shared/types/configurator';
import {
  makeCascadedConfiguration,
  makeInitialConfiguration,
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

/** What ofetch throws: the status on the error itself, the body under `data`. */
function fetchError(status: number, message = 'no'): Error {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    data: { message },
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

    it('has nothing to count down before it starts', () => {
      const session = open();

      expect(session.expiresAt.value).toBeNull();
      expect(session.remainingMs.value).toBe(0);
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

  describe('renew', () => {
    it('updates expiresAt and the remaining time', async () => {
      const initial = makeInitialConfiguration({
        expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
      });
      mockFetch.mockResolvedValue(initial);
      const session = open();
      await session.start(PRODUCT_ID);
      expect(session.remainingMs.value).toBe(60_000);

      const extended = new Date(NOW.getTime() + 900_000).toISOString();
      mockFetch.mockResolvedValue({ expiresAt: extended });

      await session.renew();

      const { url, options } = lastRequest();
      expect(url).toBe(`/api/configurations/${initial.configurationId}/renew`);
      expect(options.method).toBe('POST');
      expect(session.expiresAt.value).toBe(extended);
      expect(session.remainingMs.value).toBe(900_000);
      expect(session.configuration.value?.sections).toEqual(initial.sections);
    });

    it('counts down while the session is open', async () => {
      mockFetch.mockResolvedValue(
        makeInitialConfiguration({
          expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
        }),
      );
      const session = open();
      await session.start(PRODUCT_ID);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(session.remainingMs.value).toBe(50_000);
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

      expect(session.expiresAt.value).toBe(later);
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

    it('expires on a 410 from renew as well', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(fetchError(410, 'The configuration expired'));

      await session.renew();

      expect(session.status.value).toBe('expired');
    });

    it('sends nothing more once the session has expired', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.renew();
      mockFetch.mockReset();

      await session.applyChanges([{ type: 'quantity', quantity: 2 }]);
      await session.commit();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('stops the countdown when the session expires', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.renew();

      expect(session.remainingMs.value).toBe(0);
    });

    it('starts over on a fresh session after one expired', async () => {
      const session = await started();
      mockFetch.mockRejectedValue(fetchError(410));
      await session.renew();

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

      await session.renew();
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
      await session.renew();
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
