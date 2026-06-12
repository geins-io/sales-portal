// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

const useFetchMock = vi.fn();

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => useFetchMock(...args),
}));

vi.stubGlobal('useFetch', useFetchMock);

const localePathMock = (path: string) =>
  `/se/sv${path.startsWith('/') ? path : '/' + path}`;

vi.mock('../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    localeQuery: computed(() => ({ locale: 'sv', market: 'se' })),
    localePath: localePathMock,
  }),
}));

vi.stubGlobal('useLocaleMarket', () => ({
  localeQuery: computed(() => ({ locale: 'sv', market: 'se' })),
  localePath: localePathMock,
}));

vi.stubGlobal('useRequestURL', () => ({ host: 'example.com' }));

const { useCmsPageLink } = await import('../../app/composables/useCmsPageLink');

beforeEach(() => {
  useFetchMock.mockReset();
});

describe('useCmsPageLink', () => {
  it('(a) strips market+locale prefix and re-applies localePath for resolved URL', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: '/se/sv/kontakt' }),
      error: ref(null),
    });

    const { to, isResolved } = useCmsPageLink('contact');

    // normalizeMenuUrl('/se/sv/kontakt', 'example.com') -> '/kontakt'
    // localePathMock('/kontakt') -> '/se/sv/kontakt'
    expect(to.value).toBe(localePathMock('/kontakt'));
    expect(isResolved.value).toBe(true);
  });

  it('(a2) strips locale-only prefix for the /en/contact form, proving normalization not raw-binding', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: '/en/contact' }),
      error: ref(null),
    });

    const { to, isResolved } = useCmsPageLink('contact');

    // normalizeMenuUrl('/en/contact', 'example.com') -> '/contact' (locale-only strip)
    // localePathMock('/contact') -> '/se/sv/contact'
    // A raw binding would have yielded '/en/contact'; this proves normalization fired.
    expect(to.value).toBe(localePathMock('/contact'));
    expect(to.value).not.toBe('/en/contact');
    expect(isResolved.value).toBe(true);
  });

  it('(b) returns null and isResolved false when resolved URL is null', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: null }),
      error: ref(null),
    });

    const { to, isResolved } = useCmsPageLink('contact');

    expect(to.value == null).toBe(true);
    expect(isResolved.value).toBe(false);
  });

  it('(c) returns null and isResolved false when fetch returns an error', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: '/se/sv/kontakt' }),
      error: ref(new Error('boom')),
    });

    const { to, isResolved } = useCmsPageLink('contact');

    expect(to.value == null).toBe(true);
    expect(isResolved.value).toBe(false);
  });

  it('(d1) returns null and isResolved false when resolved URL is an external absolute URL', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: 'https://evil.com/page' }),
      error: ref(null),
    });

    const { to, isResolved } = useCmsPageLink('contact');

    expect(to.value == null).toBe(true);
    expect(isResolved.value).toBe(false);
  });

  it('(d2) returns null and isResolved false when resolved URL is protocol-relative (isSafeInternalPath rejects)', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: '//evil.com' }),
      error: ref(null),
    });

    const { to, isResolved } = useCmsPageLink('contact');

    expect(to.value == null).toBe(true);
    expect(isResolved.value).toBe(false);
  });

  it('(e) calls useFetch with the correct URL and query containing tag and locale/market', () => {
    useFetchMock.mockReturnValue({
      data: ref({ url: null }),
      error: ref(null),
    });

    useCmsPageLink('contact');

    const [url, opts] = useFetchMock.mock.calls[0];
    expect(url).toBe('/api/cms/page-link');
    expect(opts.dedupe).toBe('defer');
    const query = opts.query.value;
    expect(query).toMatchObject({ tag: 'contact', locale: 'sv', market: 'se' });
  });
});
