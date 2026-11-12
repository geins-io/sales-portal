// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, watch, type EffectScope } from 'vue';
import type { Configuration } from '#shared/types/configurator';
import {
  makeCascadedConfiguration,
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';

// ---------------------------------------------------------------------------
// The configuration on screen added to a request draft, or to a new one, from
// the configurator. The server commits; the page then carries on with the same
// choices in a new session, since a draft line cannot be reopened.
// ---------------------------------------------------------------------------

vi.mock('~/utils/client-helpers', () => ({ isBrowser: () => true }));

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  keepalive?: boolean;
}

const mockFetch = vi.fn<(url: string, options?: RequestOptions) => unknown>();
vi.stubGlobal('$fetch', mockFetch);

const { useConfiguratorSession } =
  await import('../../../app/composables/useConfiguratorSession');
const { choicesOf } = await import('../../../app/utils/configurator-replay');

const PRODUCT_ID = '1358';
const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
const QUOTE = { id: QUOTE_ID, name: 'Etapp 2', lineItems: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function fetchError(status: number, code?: string): Error {
  return Object.assign(new Error('no'), {
    status,
    statusCode: status,
    data: { message: 'no', ...(code ? { data: { code } } : {}) },
  });
}

let scopes: EffectScope[] = [];

async function started(document: Configuration) {
  mockFetch.mockResolvedValue(document);
  const scope = effectScope();
  const session = scope.run(() => useConfiguratorSession());
  if (!session) throw new Error('The scope produced no session');
  scopes.push(scope);
  await session.start(PRODUCT_ID);
  mockFetch.mockReset();
  return { session, scope };
}

const restored = () =>
  makeCascadedConfiguration({ configurationId: 'restored-1' });

/** Geins answers the add with `add`, and the restore with a new session. */
function server(add: () => unknown) {
  mockFetch.mockImplementation(async (url) => {
    if (url.endsWith('/quote-add')) return add();
    if (url === '/api/configurations/restore') {
      return { configuration: restored(), replayed: true };
    }
    if (url.startsWith('/api/configurations/')) return null;
    throw new Error(`unexpected request ${url}`);
  });
}

const urls = () => mockFetch.mock.calls.map(([url]) => url);

beforeEach(() => {
  mockFetch.mockReset();
  scopes = [];
});

afterEach(() => {
  for (const scope of scopes) scope.stop();
});

describe('useConfiguratorSession, adding to a quote request', () => {
  it('sends the session to the picked draft with the SKU, and answers the draft', async () => {
    const held = makeValidConfiguration();
    const { session } = await started(held);
    server(() => ({ quote: QUOTE }));

    await expect(
      session.addToQuote({ quoteId: QUOTE_ID }, 1534),
    ).resolves.toEqual(QUOTE);

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/configurations/${held.configurationId}/quote-add`,
      expect.objectContaining({
        method: 'POST',
        body: { skuId: 1534, quoteId: QUOTE_ID },
      }),
    );
  });

  it('sends a new draft by its name', async () => {
    const held = makeValidConfiguration();
    const { session } = await started(held);
    server(() => ({ quote: QUOTE }));

    await session.addToQuote({ name: 'Etapp 2' }, 1534);

    expect(mockFetch.mock.calls[0]![1]!.body).toEqual({
      skuId: 1534,
      name: 'Etapp 2',
    });
  });

  it('carries on with the same choices in a new session after the add', async () => {
    const held = makeValidConfiguration({ quantity: 3 });
    const { session } = await started(held);
    server(() => ({ quote: QUOTE }));

    await session.addToQuote({ quoteId: QUOTE_ID }, 1534);

    const restore = mockFetch.mock.calls.find(
      ([url]) => url === '/api/configurations/restore',
    );
    expect(restore![1]!.method).toBe('POST');
    expect(restore![1]!.body).toEqual({
      productId: PRODUCT_ID,
      quantity: 3,
      ...choicesOf(held),
    });
    expect(session.notReplayed.value).toBe(false);
    expect(session.configuration.value?.configurationId).toBe('restored-1');
    expect(session.status.value).toBe('active');
    expect(session.error.value).toBeNull();
    // The commit finished the session; there is nothing to delete.
    expect(
      mockFetch.mock.calls.some(([, options]) => options?.method === 'DELETE'),
    ).toBe(false);
  });

  it('answers null, deletes the session and carries on with the same choices when the add fails', async () => {
    const held = makeValidConfiguration();
    const { session } = await started(held);
    server(() => {
      throw fetchError(409, 'QUOTE_ADD_FAILED');
    });

    await expect(
      session.addToQuote({ quoteId: QUOTE_ID }, 1534),
    ).resolves.toBeNull();

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/configurations/${held.configurationId}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(urls()).toContain('/api/configurations/restore');
    expect(session.configuration.value?.configurationId).toBe('restored-1');
    expect(session.status.value).toBe('active');
  });

  it('sends nothing while the configuration is not valid', async () => {
    const { session } = await started(makeInvalidConfiguration());
    server(() => ({ quote: QUOTE }));

    await expect(
      session.addToQuote({ quoteId: QUOTE_ID }, 1534),
    ).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends nothing without a session', async () => {
    const { session } = await started(makeValidConfiguration());
    mockFetch.mockResolvedValue(null);
    await session.release();
    mockFetch.mockReset();
    server(() => ({ quote: QUOTE }));

    await expect(
      session.addToQuote({ quoteId: QUOTE_ID }, 1534),
    ).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('waits for a change batch in flight, then sends the session it answered', async () => {
    const { session } = await started(makeValidConfiguration());
    const batch = deferred<Configuration>();
    mockFetch.mockImplementation(async (url) => {
      if (url.endsWith('/changes')) return batch.promise;
      if (url.endsWith('/quote-add')) return { quote: QUOTE };
      return { configuration: restored(), replayed: true };
    });
    void session.applyChanges([{ type: 'quantity', quantity: 2 }]);

    const adding = session.addToQuote({ quoteId: QUOTE_ID }, 1534);
    expect(urls().some((url) => url.endsWith('/quote-add'))).toBe(false);
    batch.resolve(makeValidConfiguration({ configurationId: 'after-batch' }));

    await expect(adding).resolves.toEqual(QUOTE);
    expect(urls()).toContain('/api/configurations/after-batch/quote-add');
  });

  it('keeps the session while the add runs, even when the buyer leaves', async () => {
    const held = makeValidConfiguration();
    const { session } = await started(held);
    const answer = deferred<unknown>();
    server(() => answer.promise);

    const adding = session.addToQuote({ quoteId: QUOTE_ID }, 1534);
    window.dispatchEvent(new Event('pagehide'));

    expect(
      mockFetch.mock.calls.some(([, options]) => options?.method === 'DELETE'),
    ).toBe(false);
    answer.resolve({ quote: QUOTE });
    await adding;
  });

  describe('the form through a successful add', () => {
    it('stays on screen, busy, until the new session holds the same choices', async () => {
      const held = makeValidConfiguration();
      const { session, scope } = await started(held);
      server(() => ({ quote: QUOTE }));
      const seen: string[] = [];
      scope.run(() =>
        watch(
          () => [session.status.value, session.busy.value] as const,
          ([status, busy]) => seen.push(`${status}:${busy}`),
          { flush: 'sync' },
        ),
      );

      await session.addToQuote({ quoteId: QUOTE_ID }, 1534);

      // Never 'closed': the page would show its loading frame.
      expect(seen.every((step) => step.startsWith('active:'))).toBe(true);
      expect(seen).toContain('active:true');
      expect(session.configuration.value?.configurationId).toBe('restored-1');
      expect(session.busy.value).toBe(false);
    });

    it('says when the new session could not take every choice', async () => {
      const { session } = await started(makeValidConfiguration());
      mockFetch.mockImplementation(async (url) => {
        if (url.endsWith('/quote-add')) return { quote: QUOTE };
        if (url === '/api/configurations/restore') {
          return { configuration: restored(), replayed: false };
        }
        return null;
      });

      await expect(
        session.addToQuote({ quoteId: QUOTE_ID }, 1534),
      ).resolves.toEqual(QUOTE);

      expect(session.notRestored.value).toBe(true);
      expect(session.status.value).toBe('active');
    });

    it('answers the draft and starts afresh when no new session can hold the choices', async () => {
      const held = makeValidConfiguration();
      const { session } = await started(held);
      mockFetch.mockImplementation(async (url) => {
        if (url.endsWith('/quote-add')) return { quote: QUOTE };
        if (url === '/api/configurations/restore') throw fetchError(502);
        if (url === '/api/configurations') {
          return makeValidConfiguration({ configurationId: 'fresh-1' });
        }
        return null;
      });

      await expect(
        session.addToQuote({ quoteId: QUOTE_ID }, 1534),
      ).resolves.toEqual(QUOTE);

      expect(session.configuration.value?.configurationId).toBe('fresh-1');
      expect(session.status.value).toBe('active');
      expect(session.error.value).toBeNull();
      // Said, not a silent switch to the defaults.
      expect(session.notRestored.value).toBe(true);
    });
  });

  it('sends nothing more when the page has gone before a failed add answers', async () => {
    const { session, scope } = await started(makeValidConfiguration());
    let fail: (error: unknown) => void = () => {};
    mockFetch.mockImplementation(
      (url) =>
        new Promise((_, reject) => {
          if (url.endsWith('/quote-add')) fail = reject;
          else reject(new Error(`unexpected ${url}`));
        }),
    );

    const adding = session.addToQuote({ quoteId: QUOTE_ID }, 1534);
    scope.stop();
    fail(fetchError(502));

    await expect(adding).resolves.toBeNull();
    expect(urls()).not.toContain('/api/configurations/restore');
    expect(
      mockFetch.mock.calls.some(([, options]) => options?.method === 'DELETE'),
    ).toBe(false);
  });
});
