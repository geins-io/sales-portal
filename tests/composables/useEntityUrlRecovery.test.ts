// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, onErrorCaptured, ref, type Ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

// ---------------------------------------------------------------------------
// Stub the Nuxt auto-imports the composable relies on. The shared
// `stripLocaleMarketPrefix` and `isSafeInternalPath` utils are NOT mocked: they
// run for real so the rename and open-redirect branches exercise them.
// ---------------------------------------------------------------------------
const mockInternalFetch = vi.fn();
const mockNavigateTo = vi.fn((target: string, opts?: unknown) => ({
  target,
  opts,
}));
const mockCreateError = vi.fn(
  (opts: { statusCode: number; statusMessage?: string; fatal?: boolean }) =>
    Object.assign(new Error(`H3Error: ${opts.statusCode}`), opts),
);

// localePath re-applies a fixed /se/sv/ prefix to a locale-free path so we can
// assert the rename branch routes through it.
const mockLocalePath = vi.fn((p: string) =>
  p.startsWith('/se/sv') ? p : `/se/sv${p}`,
);

// The post-await navigateTo and the resolver fetch run through the Nuxt app
// captured in setup. A pass-through stub; the spy pins that they go through it.
const mockRunWithContext = vi.fn(<T>(fn: () => T): T => fn());
const mockUseNuxtApp = vi.fn(() => ({ runWithContext: mockRunWithContext }));

// The route the visitor is on; a navigation away changes it.
const currentRoute = ref({ path: '/se/sv/p/foo' });

vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('useNuxtApp', mockUseNuxtApp);
vi.stubGlobal('useRouter', () => ({ currentRoute }));

vi.mock('#app/composables/router', () => ({
  navigateTo: (...args: unknown[]) =>
    mockNavigateTo(...(args as [string, unknown])),
  useRouter: () => ({ currentRoute }),
}));
vi.mock('#app/composables/error', () => ({
  createError: (opts: { statusCode: number; fatal?: boolean }) =>
    mockCreateError(opts),
}));
vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => mockUseNuxtApp(),
}));
vi.mock('../../app/utils/internal-fetch', () => ({
  internalFetch: (...args: unknown[]) => mockInternalFetch(...args),
}));

// `useLocaleMarket` calls useI18n()/useTenant(), neither available here. Only
// its localePath helper is exercised.
vi.mock('../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({ localePath: mockLocalePath }),
}));

const { useEntityUrlRecovery } =
  await import('../../app/composables/useEntityUrlRecovery');

type ReadError = { statusCode?: number; statusMessage?: string };

interface Read {
  error: Ref<ReadError | undefined>;
  status: Ref<string>;
}

function answered(error?: ReadError): Read {
  return { error: ref(error), status: ref(error ? 'error' : 'success') };
}

/**
 * Mounts a page stand-in that calls `settle` in its setup, under a parent that
 * captures errors the way NuxtRoot does. `settled` is what the page awaits;
 * `captured` is what reaches the error page.
 */
function mountPage(read: Read, isMissing: () => boolean, path: string) {
  const captured: Array<Error & { statusCode?: number; fatal?: boolean }> = [];
  let settled!: Promise<void>;
  const Page = defineComponent({
    setup() {
      const { settle } = useEntityUrlRecovery();
      settled = settle(read, isMissing, path);
      // The answered path throws from here in a real page; keep it observable.
      settled.catch(() => {});
      return () => null;
    },
  });
  const Root = defineComponent({
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as (typeof captured)[number]);
        return false;
      });
      return () => h(Page);
    },
  });
  const wrapper = mount(Root);
  return { wrapper, captured, settled };
}

beforeEach(() => {
  mockInternalFetch.mockReset();
  mockNavigateTo.mockClear();
  mockCreateError.mockClear();
  mockLocalePath.mockClear();
  mockRunWithContext.mockClear();
  currentRoute.value = { path: '/se/sv/p/foo' };
});

// ---------------------------------------------------------------------------
// The read has answered: decide in setup, as SSR and client navigation do.
// ---------------------------------------------------------------------------
describe('settle, read answered', () => {
  it('does nothing when the content is there', async () => {
    const { settled, captured } = mountPage(
      answered(),
      () => false,
      '/se/sv/p/foo',
    );

    await expect(settled).resolves.toBeUndefined();
    expect(mockInternalFetch).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
  });

  it('asks the resolver for the path when the content is missing', async () => {
    mockInternalFetch.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/foo',
    });

    const { settled } = mountPage(answered(), () => true, '/se/sv/p/foo');
    await settled;

    expect(mockInternalFetch).toHaveBeenCalledWith('/api/resolve-url', {
      query: { path: '/se/sv/p/foo' },
    });
    expect(mockRunWithContext).toHaveBeenCalledBefore(mockInternalFetch);
  });

  it('asks the resolver when the read answered 404', async () => {
    mockInternalFetch.mockResolvedValue(null);

    const { settled } = mountPage(
      answered({ statusCode: 404 }),
      () => true,
      '/se/sv/p/foo',
    );

    await expect(settled).rejects.toMatchObject({ statusCode: 404 });
    expect(mockInternalFetch).toHaveBeenCalledTimes(1);
  });

  // A timed-out read answers 502; the resolver would still find the entity,
  // and its loop guard would answer 404 for a page that exists.
  it('throws the error page with the status of a failed read, without the resolver', async () => {
    const { settled } = mountPage(
      answered({ statusCode: 502, statusMessage: 'Bad Gateway' }),
      () => true,
      '/se/sv/p/foo',
    );

    await expect(settled).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      fatal: true,
    });
    expect(mockInternalFetch).not.toHaveBeenCalled();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('throws a 500 for a failed read that carries no status', async () => {
    const { settled } = mountPage(answered({}), () => true, '/se/sv/p/foo');

    await expect(settled).rejects.toMatchObject({
      statusCode: 500,
      fatal: true,
    });
    expect(mockInternalFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The resolver's answer: the shared recovery contract.
// ---------------------------------------------------------------------------
describe('settle, recovering a miss', () => {
  async function recover(resolved: unknown, path = '/se/sv/p/foo') {
    if (resolved instanceof Error)
      mockInternalFetch.mockRejectedValue(resolved);
    else mockInternalFetch.mockResolvedValue(resolved);
    currentRoute.value = { path };
    return mountPage(answered({ statusCode: 404 }), () => true, path).settled;
  }

  it('301s to a canonical that differs from the path', async () => {
    await recover(
      {
        type: 'product',
        canonicalAppPath: '/se/sv/p/material/grenror/grenror-150-150-88',
      },
      '/se/sv/grenror-150-150-88',
    );

    expect(mockNavigateTo).toHaveBeenCalledWith(
      '/se/sv/p/material/grenror/grenror-150-150-88',
      { redirectCode: 301, replace: true },
    );
    expect(mockCreateError).not.toHaveBeenCalled();
  });

  // The post-await navigateTo must run through the Nuxt app captured in setup,
  // otherwise navigateTo -> useRouter -> useNuxtApp throws out of context.
  it('runs the navigateTo through nuxtApp.runWithContext', async () => {
    await recover(
      { type: 'category', canonicalAppPath: '/se/sv/c/material/grenror' },
      '/se/sv/material/grenror',
    );

    expect(mockRunWithContext).toHaveBeenCalledTimes(2);
    expect(mockRunWithContext.mock.invocationCallOrder[1]).toBeLessThan(
      mockNavigateTo.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('throws a fatal 404 when the canonical is the path itself (no loop)', async () => {
    await expect(
      recover(
        { type: 'category', canonicalAppPath: '/se/sv/c/foo' },
        '/se/sv/c/foo',
      ),
    ).rejects.toMatchObject({ statusCode: 404, fatal: true });
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('301s a renamed slug to its locale-prefixed path', async () => {
    await recover({ redirect: '/se/sv/new-slug' }, '/se/sv/old-slug');

    // stripLocaleMarketPrefix('/se/sv/new-slug') -> '/new-slug',
    // then mocked localePath('/new-slug') -> '/se/sv/new-slug'.
    expect(mockLocalePath).toHaveBeenCalledWith('/new-slug');
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/new-slug', {
      redirectCode: 301,
      replace: true,
    });
  });

  it('throws a fatal 404 when a rename resolves back to the path (no loop)', async () => {
    await expect(
      recover({ redirect: '/se/sv/old-slug' }, '/se/sv/old-slug'),
    ).rejects.toMatchObject({ statusCode: 404, fatal: true });
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it.each([
    ['no answer', null],
    ['a failed resolver', new Error('boom')],
  ])('throws a fatal 404 for %s', async (_label, resolved) => {
    await expect(recover(resolved)).rejects.toMatchObject({
      statusCode: 404,
      fatal: true,
    });
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  // Open-redirect guard (defense in depth): an unsafe canonicalAppPath must
  // throw a 404 rather than navigate the browser off-origin.
  it.each([
    ['absolute https URL', 'https://evil.example.com/phish'],
    ['protocol-relative URL', '//evil.example.com/phish'],
    ['javascript scheme', 'javascript:alert(1)'],
  ])('throws a fatal 404 for an unsafe %s', async (_label, unsafe) => {
    await expect(
      recover({ type: 'product', canonicalAppPath: unsafe }),
    ).rejects.toMatchObject({ statusCode: 404, fatal: true });
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The read was deferred: hydrating, its key not in the payload.
// ---------------------------------------------------------------------------
describe('settle, read deferred', () => {
  function deferred(): Read {
    return { error: ref(undefined), status: ref('idle') };
  }

  it('does not decide before the read answers', async () => {
    const { settled, captured } = mountPage(
      deferred(),
      () => true,
      '/se/sv/p/foo',
    );

    await expect(settled).resolves.toBeUndefined();
    await flushPromises();
    expect(mockInternalFetch).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
  });

  it('leaves the page alone when the read brings the content', async () => {
    const read = deferred();
    let missing = true;
    const { captured } = mountPage(read, () => missing, '/se/sv/p/foo');

    read.status.value = 'pending';
    await flushPromises();
    missing = false;
    read.status.value = 'success';
    await flushPromises();

    expect(mockInternalFetch).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
  });

  it('recovers when the read answers 404, and shows the error page on a terminal miss', async () => {
    mockInternalFetch.mockResolvedValue(null);
    const read = deferred();
    const { captured } = mountPage(read, () => true, '/se/sv/p/foo');

    read.error.value = { statusCode: 404 };
    read.status.value = 'error';
    await flushPromises();

    expect(mockInternalFetch).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
  });

  it('redirects when the deferred miss is a renamed entity', async () => {
    mockInternalFetch.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/foo',
    });
    const read = deferred();
    const { captured } = mountPage(read, () => true, '/se/sv/p/foo');

    read.status.value = 'success';
    await flushPromises();

    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/p/material/foo', {
      redirectCode: 301,
      replace: true,
    });
    expect(captured).toEqual([]);
  });

  it('shows the error page with the status of a failed deferred read', async () => {
    const read = deferred();
    const { captured } = mountPage(read, () => true, '/se/sv/p/foo');

    read.error.value = { statusCode: 502, statusMessage: 'Bad Gateway' };
    read.status.value = 'error';
    await flushPromises();

    expect(mockInternalFetch).not.toHaveBeenCalled();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ statusCode: 502, fatal: true });
  });

  // An aborted read goes back to idle; it has not answered.
  it('keeps waiting when an aborted read goes back to idle', async () => {
    mockInternalFetch.mockResolvedValue(null);
    const read = deferred();
    const { captured } = mountPage(read, () => true, '/se/sv/p/foo');

    read.status.value = 'pending';
    await flushPromises();
    read.status.value = 'idle';
    await flushPromises();
    expect(mockInternalFetch).not.toHaveBeenCalled();

    read.error.value = { statusCode: 404 };
    read.status.value = 'error';
    await flushPromises();
    expect(mockInternalFetch).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
  });

  it('decides once, even if the read answers again', async () => {
    mockInternalFetch.mockResolvedValue(null);
    const read = deferred();
    const { captured } = mountPage(read, () => true, '/se/sv/p/foo');

    read.status.value = 'success';
    await flushPromises();
    read.status.value = 'pending';
    await flushPromises();
    read.status.value = 'success';
    await flushPromises();

    expect(mockInternalFetch).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
  });

  // Suspense keeps the old page mounted until the next one resolves, so a
  // decision can still be under way after the visitor has left.
  describe('after the visitor has left', () => {
    function resolverInFlight() {
      let answer!: (value: unknown) => void;
      mockInternalFetch.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      return (value: unknown) => answer(value);
    }

    it('neither redirects nor throws once the route has changed', async () => {
      const answer = resolverInFlight();
      const read = deferred();
      const { captured } = mountPage(read, () => true, '/se/sv/p/foo');

      read.status.value = 'success';
      await flushPromises();
      expect(mockInternalFetch).toHaveBeenCalledTimes(1);

      currentRoute.value = { path: '/se/sv/c/elsewhere' };
      answer({ type: 'product', canonicalAppPath: '/se/sv/p/material/foo' });
      await flushPromises();

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(captured).toEqual([]);
    });

    it('neither redirects nor throws once the page is unmounted', async () => {
      const answer = resolverInFlight();
      const read = deferred();
      const { wrapper, captured } = mountPage(read, () => true, '/se/sv/p/foo');

      read.status.value = 'success';
      await flushPromises();
      wrapper.unmount();
      answer(null);
      await flushPromises();

      expect(mockCreateError).not.toHaveBeenCalled();
      expect(captured).toEqual([]);
    });

    it('does not start deciding when the read answers after the visitor left', async () => {
      const read = deferred();
      mountPage(read, () => true, '/se/sv/p/foo');

      currentRoute.value = { path: '/se/sv/c/elsewhere' };
      read.status.value = 'success';
      await flushPromises();

      expect(mockInternalFetch).not.toHaveBeenCalled();
    });
  });
});
