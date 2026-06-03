import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ---------------------------------------------------------------------------
// Stub the Nuxt auto-imports the composable relies on. Runs in the node test
// tier (no Nuxt runtime), so each import is a controllable spy. The shared
// `stripLocaleMarketPrefix` util is NOT mocked: it runs for real so the
// rename ({ redirect }) branch exercises the actual prefix-strip + re-apply.
// ---------------------------------------------------------------------------
const mockUseFetch = vi.fn();
const mockNavigateTo = vi.fn((target: string, opts?: unknown) => ({
  target,
  opts,
}));
const mockCreateError = vi.fn(
  (opts: { statusCode: number; fatal?: boolean }) => {
    const err = new Error(`H3Error: ${opts.statusCode}`);
    (err as unknown as Record<string, unknown>).statusCode = opts.statusCode;
    (err as unknown as Record<string, unknown>).fatal = opts.fatal;
    return err;
  },
);

// localePath re-applies a fixed /se/sv/ prefix to a locale-free path so we can
// assert the rename branch routes through it.
const mockLocalePath = vi.fn((p: string) =>
  p.startsWith('/se/sv') ? p : `/se/sv${p}`,
);

// `recoverEntityUrl` captures the Nuxt app before the await and runs the
// post-await navigateTo through `nuxtApp.runWithContext`. The stub is a
// pass-through so the wrapped navigateTo still executes, and the spy lets us
// assert the composable routes the redirect THROUGH runWithContext. NB: this
// only documents the contract; a node-tier unit test cannot reproduce the
// real async-context loss, so the true guard is the live/E2E verification.
const mockRunWithContext = vi.fn(<T>(fn: () => T): T => fn());
const mockUseNuxtApp = vi.fn(() => ({ runWithContext: mockRunWithContext }));

vi.stubGlobal('useFetch', mockUseFetch);
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('useNuxtApp', mockUseNuxtApp);

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));
vi.mock('#app/composables/router', () => ({
  navigateTo: (...args: unknown[]) =>
    mockNavigateTo(...(args as [string, unknown])),
}));
vi.mock('#app/composables/error', () => ({
  createError: (opts: { statusCode: number; fatal?: boolean }) =>
    mockCreateError(opts),
}));
vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => mockUseNuxtApp(),
}));

// `useLocaleMarket` is a real composable that calls useI18n()/useTenant(),
// neither of which is available outside a Nuxt setup context. Mock the module
// so only its localePath helper (the part recoverEntityUrl uses) is exercised.
vi.mock('../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({ localePath: mockLocalePath }),
}));

const { recoverEntityUrl } =
  await import('../../app/composables/useEntityUrlRecovery');

function fetchResult(value: unknown, errored = false) {
  return {
    data: ref(errored ? null : value),
    error: ref(errored ? new Error('boom') : null),
  };
}

describe('recoverEntityUrl', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockNavigateTo.mockClear();
    mockCreateError.mockClear();
    mockLocalePath.mockClear();
    mockRunWithContext.mockClear();
    mockUseNuxtApp.mockClear();
  });

  it('calls the resolver with the path and dedupe defer', async () => {
    mockUseFetch.mockReturnValue(
      fetchResult({ type: 'product', canonicalAppPath: '/se/sv/p/foo/bar' }),
    );

    await recoverEntityUrl('/se/sv/foo');

    const [url, opts] = mockUseFetch.mock.calls[0] as [
      string,
      { query: { path: string }; dedupe: string },
    ];
    expect(url).toBe('/api/resolve-url');
    expect(opts.query.path).toBe('/se/sv/foo');
    expect(opts.dedupe).toBe('defer');
  });

  it('{ type, canonicalAppPath } different from path -> navigateTo 301 replace', async () => {
    mockUseFetch.mockReturnValue(
      fetchResult({
        type: 'product',
        canonicalAppPath: '/se/sv/p/material/grenror/grenror-150-150-88',
      }),
    );

    await recoverEntityUrl('/se/sv/grenror-150-150-88');

    expect(mockNavigateTo).toHaveBeenCalledWith(
      '/se/sv/p/material/grenror/grenror-150-150-88',
      { redirectCode: 301, replace: true },
    );
    expect(mockCreateError).not.toHaveBeenCalled();
  });

  // Contract guard: the post-await navigateTo MUST run through the Nuxt app
  // context captured before the await (runWithContext), otherwise navigateTo
  // -> useRouter -> useNuxtApp throws the out-of-context error at runtime.
  // The node-tier stub cannot reproduce that loss, so this only pins the
  // contract; the real guard is live/E2E verification.
  it('routes the post-fetch navigateTo through nuxtApp.runWithContext', async () => {
    mockUseFetch.mockReturnValue(
      fetchResult({
        type: 'category',
        canonicalAppPath: '/se/sv/c/material/grenror',
      }),
    );

    await recoverEntityUrl('/se/sv/material/grenror');

    expect(mockRunWithContext).toHaveBeenCalledTimes(1);
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/c/material/grenror', {
      redirectCode: 301,
      replace: true,
    });
    // The navigateTo invocation came from inside the runWithContext callback.
    expect(mockRunWithContext).toHaveBeenCalledBefore(mockNavigateTo);
  });

  it('{ type, canonicalAppPath } equal to path -> throws 404 fatal (no loop)', async () => {
    mockUseFetch.mockReturnValue(
      fetchResult({ type: 'category', canonicalAppPath: '/se/sv/c/foo' }),
    );

    await expect(recoverEntityUrl('/se/sv/c/foo')).rejects.toThrow(
      'H3Error: 404',
    );
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 404,
      fatal: true,
    });
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('{ redirect } -> navigateTo to the locale-prefixed renamed slug, 301 replace', async () => {
    mockUseFetch.mockReturnValue(fetchResult({ redirect: '/se/sv/new-slug' }));

    await recoverEntityUrl('/se/sv/old-slug');

    // stripLocaleMarketPrefix('/se/sv/new-slug') -> '/new-slug',
    // then mocked localePath('/new-slug') -> '/se/sv/new-slug'.
    expect(mockLocalePath).toHaveBeenCalledWith('/new-slug');
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/new-slug', {
      redirectCode: 301,
      replace: true,
    });
  });

  it('{ redirect } that resolves back to the current path -> 404 (no loop)', async () => {
    mockUseFetch.mockReturnValue(fetchResult({ redirect: '/se/sv/old-slug' }));

    await expect(recoverEntityUrl('/se/sv/old-slug')).rejects.toThrow(
      'H3Error: 404',
    );
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('null resolver result -> throws createError 404 fatal', async () => {
    mockUseFetch.mockReturnValue(fetchResult(null));

    await expect(recoverEntityUrl('/se/sv/missing')).rejects.toThrow(
      'H3Error: 404',
    );
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 404,
      fatal: true,
    });
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('fetch error -> throws createError 404 fatal', async () => {
    mockUseFetch.mockReturnValue(fetchResult(null, true));

    await expect(recoverEntityUrl('/se/sv/oops')).rejects.toThrow(
      'H3Error: 404',
    );
    expect(mockCreateError).toHaveBeenCalledWith({
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
  ])(
    'throws 404 fatal when canonicalAppPath is an unsafe %s',
    async (_label, unsafe) => {
      mockUseFetch.mockReturnValue(
        fetchResult({ type: 'product', canonicalAppPath: unsafe }),
      );

      await expect(recoverEntityUrl('/se/sv/foo')).rejects.toThrow(
        'H3Error: 404',
      );
      expect(mockCreateError).toHaveBeenCalledWith({
        statusCode: 404,
        fatal: true,
      });
      expect(mockNavigateTo).not.toHaveBeenCalled();
    },
  );
});
