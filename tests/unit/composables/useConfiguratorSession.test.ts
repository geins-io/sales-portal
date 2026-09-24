import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, type EffectScope } from 'vue';
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
    productId: config.articleNumber,
    quantity: config.quantity,
    unitPrice: config.unitPrice,
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
