import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type { LocaleAlternateUrl } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// Mocks for the thin composable layer
// ---------------------------------------------------------------------------

const mockAvailableLocales = ref<string[]>(['sv', 'en']);
const localeAlternatesState = ref<Record<string, string>>({});
let afterEachHandler: (() => void) | null = null;

vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    availableLocales: computed(() => mockAvailableLocales.value),
  }),
}));

vi.mock('#app/composables/state', () => ({
  useState: (_key: string, init: () => Record<string, string>) => {
    if (Object.keys(localeAlternatesState.value).length === 0) {
      localeAlternatesState.value = init();
    }
    return localeAlternatesState;
  },
}));

vi.mock('#app/composables/router', () => ({
  useRouter: () => ({
    afterEach: (fn: () => void) => {
      afterEachHandler = fn;
    },
  }),
}));

vi.stubGlobal('computed', computed);
vi.stubGlobal('ref', ref);
vi.stubGlobal('readonly', (v: unknown) => v);
vi.stubGlobal(
  'useState',
  (_key: string, init: () => Record<string, string>) => {
    if (Object.keys(localeAlternatesState.value).length === 0) {
      localeAlternatesState.value = init();
    }
    return localeAlternatesState;
  },
);
vi.stubGlobal('useRouter', () => ({
  afterEach: (fn: () => void) => {
    afterEachHandler = fn;
  },
}));

// Import after mocks/stubs are in place
const { useLocaleAlternates, mapAlternatesToShortCodes } =
  await import('~/composables/useLocaleAlternates');

function entry(over: Partial<LocaleAlternateUrl>): LocaleAlternateUrl {
  return {
    language: 'en',
    culture: 'en-US',
    country: 'US',
    url: '/se/en/p/cutting-edge',
    channelId: '1',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Pure helper: mapAlternatesToShortCodes
// ---------------------------------------------------------------------------

describe('mapAlternatesToShortCodes', () => {
  const available = ['sv', 'en'];

  it('maps culture en-US to short code en', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'en-US',
            language: 'en',
            url: '/se/en/p/cutting-edge',
          }),
        ],
        available,
      ),
    ).toEqual({ en: '/se/en/p/cutting-edge' });
  });

  it('maps culture sv-SE to sv', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'sv-SE',
            language: 'sv',
            url: '/se/sv/p/cutting-edge',
          }),
        ],
        available,
      ),
    ).toEqual({ sv: '/se/sv/p/cutting-edge' });
  });

  it('falls back to language when culture missing/blank', () => {
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: '', language: 'en', url: '/se/en/c/category-1' })],
        available,
      ),
    ).toEqual({ en: '/se/en/c/category-1' });
  });

  it('drops entries whose short code is not in tenant available locales', () => {
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'de-DE', language: 'de', url: '/se/de/p/x' })],
        available,
      ),
    ).toEqual({});
  });

  it('drops malformed urls (absolute, protocol-relative, prefix-less)', () => {
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: 'https://evil.example/x' })],
        available,
      ),
    ).toEqual({});
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: '//evil/x' })],
        available,
      ),
    ).toEqual({});
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: 'cutting-edge' })],
        available,
      ),
    ).toEqual({});
  });

  it('keeps well-formed type-prefixed paths for p/c/b/l', () => {
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: '/se/en/p/prod' })],
        available,
      ),
    ).toEqual({ en: '/se/en/p/prod' });
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: '/se/en/c/cat' })],
        available,
      ),
    ).toEqual({ en: '/se/en/c/cat' });
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: '/se/en/b/brand' })],
        available,
      ),
    ).toEqual({ en: '/se/en/b/brand' });
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-US', url: '/se/en/l/list' })],
        available,
      ),
    ).toEqual({ en: '/se/en/l/list' });
  });

  it('handles null/empty entries array', () => {
    expect(mapAlternatesToShortCodes(null, available)).toEqual({});
    expect(mapAlternatesToShortCodes(undefined, available)).toEqual({});
    expect(mapAlternatesToShortCodes([], available)).toEqual({});
  });

  it('tolerates null entries inside the array', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          null as unknown as LocaleAlternateUrl,
          entry({ culture: 'en-US', url: '/se/en/p/prod' }),
        ],
        available,
      ),
    ).toEqual({ en: '/se/en/p/prod' });
  });
});

// ---------------------------------------------------------------------------
// Thin composable: useLocaleAlternates
// ---------------------------------------------------------------------------

describe('useLocaleAlternates', () => {
  beforeEach(() => {
    localeAlternatesState.value = {};
    mockAvailableLocales.value = ['sv', 'en'];
    // afterEachHandler is intentionally NOT reset: the composable registers
    // its router.afterEach exactly once (module-level guard), so the handler
    // captured on the first call stays valid for the whole suite.
  });

  it('setAlternates populates alternates and hrefFor returns the url', () => {
    const { alternates, setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates([
      entry({ culture: 'en-US', url: '/se/en/p/prod' }),
      entry({ culture: 'sv-SE', language: 'sv', url: '/se/sv/p/prod' }),
    ]);
    expect(alternates.value).toEqual({
      en: '/se/en/p/prod',
      sv: '/se/sv/p/prod',
    });
    expect(hrefFor('en')).toBe('/se/en/p/prod');
  });

  it('hrefFor returns undefined for a locale with no alternate', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates([entry({ culture: 'en-US', url: '/se/en/p/prod' })]);
    expect(hrefFor('sv')).toBeUndefined();
  });

  it('setAlternates with null/empty assigns an empty record', () => {
    const { alternates, setAlternates } = useLocaleAlternates();
    setAlternates([entry({ culture: 'en-US', url: '/se/en/p/prod' })]);
    setAlternates(null);
    expect(alternates.value).toEqual({});
  });

  it('clear empties the record', () => {
    const { alternates, setAlternates, clear } = useLocaleAlternates();
    setAlternates([entry({ culture: 'en-US', url: '/se/en/p/prod' })]);
    clear();
    expect(alternates.value).toEqual({});
  });

  it('route change clears alternates', () => {
    const { alternates, setAlternates } = useLocaleAlternates();
    setAlternates([entry({ culture: 'en-US', url: '/se/en/p/prod' })]);
    expect(alternates.value).toEqual({ en: '/se/en/p/prod' });

    expect(afterEachHandler).toBeTypeOf('function');
    afterEachHandler!();
    expect(alternates.value).toEqual({});
  });
});
