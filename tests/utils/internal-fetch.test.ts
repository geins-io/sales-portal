import { describe, it, expect, vi, beforeEach } from 'vitest';

// The node tier has no Nuxt runtime: the auto-imports the helper reaches for
// are spies, both as globals and at the module Nuxt's transform resolves them
// to. `import.meta.server` is replaced at build time and is `false` here,
// which is why the helper exposes `internalFetcher(server)`.
const { mockGlobalFetch, mockRequestFetch, mockUseRequestFetch } = vi.hoisted(
  () => {
    const mockRequestFetch = vi.fn();
    return {
      mockGlobalFetch: vi.fn(),
      mockRequestFetch,
      mockUseRequestFetch: vi.fn(() => mockRequestFetch),
    };
  },
);

vi.stubGlobal('$fetch', mockGlobalFetch);
vi.stubGlobal('useRequestFetch', mockUseRequestFetch);
vi.mock('#app/composables/ssr', () => ({
  useRequestFetch: (...args: unknown[]) => mockUseRequestFetch(...args),
}));
vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockGlobalFetch(...args),
}));

const { internalFetch, internalFetcher } =
  await import('../../app/utils/internal-fetch');

describe('internalFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('internalFetcher', () => {
    it('on the server calls the request-bound fetch, which forwards the incoming headers', async () => {
      // `useRequestFetch()` is Nuxt's `event.$fetch`: h3 copies every header
      // of the incoming request except hop-by-hop ones and `accept`, and
      // includes `host` for a relative URL. That is what carries the tenant
      // hostname across the internal hop.
      mockRequestFetch.mockResolvedValue({ user: null });
      const options = { query: { a: '1' } };

      const result = await internalFetcher(true)('/api/auth/me', options);

      expect(mockUseRequestFetch).toHaveBeenCalledTimes(1);
      expect(mockRequestFetch).toHaveBeenCalledWith('/api/auth/me', options);
      expect(mockGlobalFetch).not.toHaveBeenCalled();
      expect(result).toEqual({ user: null });
    });

    it('on the client calls the global $fetch (the browser sends host and cookies itself)', async () => {
      mockGlobalFetch.mockResolvedValue({ user: null });

      await internalFetcher(false)('/api/auth/me');

      expect(mockUseRequestFetch).not.toHaveBeenCalled();
      expect(mockRequestFetch).not.toHaveBeenCalled();
      expect(mockGlobalFetch).toHaveBeenCalledWith('/api/auth/me', undefined);
    });
  });

  it('passes url and options through unchanged', async () => {
    mockGlobalFetch.mockResolvedValue({ ok: true });
    const options = {
      query: { cartId: 'c1' },
      headers: { 'x-test': '1' },
    };

    const result = await internalFetch<{ ok: boolean }>('/api/cart', options);

    expect(result).toEqual({ ok: true });
    expect(mockGlobalFetch).toHaveBeenCalledWith('/api/cart', options);
  });

  it('defaults options to an empty object', async () => {
    mockGlobalFetch.mockResolvedValue(null);

    await internalFetch('/api/auth/me');

    expect(mockGlobalFetch).toHaveBeenCalledWith('/api/auth/me', {});
  });
});
