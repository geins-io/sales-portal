import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

// ---------------------------------------------------------------------------
// Stub the Nuxt auto-imports the middleware relies on. The node test tier has
// no Nuxt runtime, so each composable/global is a controllable spy.
//
// `import.meta.server` is bundle-time replaced and resolves to `false` in the
// node test env, so the server-only `useRequestHeaders` branch never fires
// here (it is verified by live SSR curl during dev). The stub still exists so
// an accidental call does not throw.
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
const mockNavigateTo = vi.fn((target: string, opts?: unknown) => ({
  target,
  opts,
}));
const mockAbortNavigation = vi.fn((err?: unknown) => ({ aborted: true, err }));
const mockCreateError = vi.fn((opts: { statusCode: number }) => {
  const err = new Error(`H3Error: ${opts.statusCode}`);
  (err as unknown as Record<string, unknown>).statusCode = opts.statusCode;
  return err;
});

vi.stubGlobal('$fetch', mockFetch);
vi.stubGlobal(
  'useRequestHeaders',
  vi.fn(() => ({})),
);

vi.mock('#app/composables/router', () => ({
  navigateTo: (...args: unknown[]) =>
    mockNavigateTo(...(args as [string, unknown])),
  abortNavigation: (...args: unknown[]) => mockAbortNavigation(...args),
  defineNuxtRouteMiddleware: (fn: (to: RouteLocationNormalized) => unknown) =>
    fn,
}));

vi.mock('#app/composables/error', () => ({
  createError: (opts: { statusCode: number }) => mockCreateError(opts),
}));

// Must import after the mocks are registered.
const resolveUrlMiddleware = (
  await import('../../../app/middleware/resolve-url.global')
).default as (to: RouteLocationNormalized) => unknown | Promise<unknown>;

function createRoute(
  overrides: Partial<RouteLocationNormalized> = {},
): RouteLocationNormalized {
  return {
    path: '/',
    name: undefined,
    params: {},
    query: {},
    hash: '',
    fullPath: '/',
    matched: [],
    redirectedFrom: undefined,
    meta: {},
    ...overrides,
  } as RouteLocationNormalized;
}

describe('resolve-url.global middleware', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockNavigateTo.mockClear();
    mockAbortNavigation.mockClear();
    mockCreateError.mockClear();
  });

  // -------------------------------------------------------------------------
  // Fast path-shape guard: no engagement, zero network.
  // -------------------------------------------------------------------------
  it('no-ops on a prefix-less path (CMS / catch-all territory)', async () => {
    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/sv/material/grenror' }),
    );

    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockNavigateTo).not.toHaveBeenCalled();
    expect(mockAbortNavigation).not.toHaveBeenCalled();
  });

  it('no-ops on an already-typed category route (/c)', async () => {
    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/sv/c/epoxy' }),
    );

    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('no-ops on already-typed product/brand/search routes', async () => {
    for (const path of [
      '/se/sv/p/foo/bar',
      '/se/sv/b/acme',
      '/se/sv/s/query',
    ]) {
      mockFetch.mockClear();
      const result = await resolveUrlMiddleware(createRoute({ path }));
      expect(result).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    }
  });

  it('no-ops on a non-prefixed path (no market/locale segments)', async () => {
    const result = await resolveUrlMiddleware(createRoute({ path: '/cart' }));

    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('no-ops when only one leading 2-letter segment is present', async () => {
    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/l/category-1' }),
    );

    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Engagement on wrong shapes (/l/, /dc/).
  // -------------------------------------------------------------------------
  it('engages on /l/ and 301-redirects to the resolved canonicalAppPath', async () => {
    mockFetch.mockResolvedValue({
      type: 'category',
      canonicalAppPath: '/se/sv/c/category-1',
    });

    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/sv/l/category-1' }),
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [
      string,
      { query: { path: string } },
    ];
    expect(url).toBe('/api/resolve-url');
    expect(opts.query.path).toBe('/se/sv/l/category-1');

    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/c/category-1', {
      redirectCode: 301,
      replace: true,
    });
    expect(result).toEqual(mockNavigateTo.mock.results[0]!.value);
    expect(mockAbortNavigation).not.toHaveBeenCalled();
  });

  it('aborts with a 404 when /dc/ does not resolve (terminal miss)', async () => {
    mockFetch.mockResolvedValue(null);

    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/sv/dc/black-friday' }),
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockCreateError).toHaveBeenCalledWith({ statusCode: 404 });
    expect(mockAbortNavigation).toHaveBeenCalledTimes(1);
    expect(mockNavigateTo).not.toHaveBeenCalled();
    expect(result).toEqual(mockAbortNavigation.mock.results[0]!.value);
  });

  it('aborts with a 404 when the resolver fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    await resolveUrlMiddleware(createRoute({ path: '/se/sv/dc/foo' }));

    expect(mockCreateError).toHaveBeenCalledWith({ statusCode: 404 });
    expect(mockAbortNavigation).toHaveBeenCalledTimes(1);
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('no-ops (no redirect) when the resolved target equals the incoming path', async () => {
    // Loop guard: a self-referential resolution must not navigate.
    mockFetch.mockResolvedValue({
      type: 'category',
      canonicalAppPath: '/se/sv/l/category-1',
    });

    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/sv/l/category-1' }),
    );

    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
    expect(mockAbortNavigation).not.toHaveBeenCalled();
  });

  it('preserves ?query and #hash through the 301 redirect target', async () => {
    mockFetch.mockResolvedValue({
      type: 'category',
      canonicalAppPath: '/se/sv/c/category-1',
    });

    await resolveUrlMiddleware(
      createRoute({
        path: '/se/sv/l/category-1',
        query: { page: '2', sort: 'price' },
        hash: '#reviews',
      }),
    );

    const [target] = mockNavigateTo.mock.calls[0] as [string, unknown];
    expect(target).toBe('/se/sv/c/category-1?page=2&sort=price#reviews');
  });

  it('follows a { redirect } shape (renamed slug) to the redirect target', async () => {
    mockFetch.mockResolvedValue({ redirect: '/se/sv/c/renamed-category' });

    const result = await resolveUrlMiddleware(
      createRoute({ path: '/se/sv/l/old-category' }),
    );

    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/c/renamed-category', {
      redirectCode: 301,
      replace: true,
    });
    expect(result).toEqual(mockNavigateTo.mock.results[0]!.value);
  });
});
