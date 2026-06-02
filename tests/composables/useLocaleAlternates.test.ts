import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type { LocaleAlternateUrl } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// Mocks for the thin composable layer
// ---------------------------------------------------------------------------

const mockAvailableLocales = ref<string[]>(['sv', 'en']);
const mockCurrentMarket = ref<string>('se');
const localeAlternatesState = ref<Record<string, string>>({});
let afterEachHandler: (() => void) | null = null;

vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    availableLocales: computed(() => mockAvailableLocales.value),
  }),
}));

vi.mock('~/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: computed(() => mockCurrentMarket.value),
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
vi.stubGlobal('useLocaleMarket', () => ({
  currentMarket: computed(() => mockCurrentMarket.value),
}));
vi.stubGlobal('useRouter', () => ({
  afterEach: (fn: () => void) => {
    afterEachHandler = fn;
  },
}));

// Import after mocks/stubs are in place
const {
  useLocaleAlternates,
  mapAlternatesToShortCodes,
  normalizeAlternatePath,
} = await import('~/composables/useLocaleAlternates');

function entry(over: Partial<LocaleAlternateUrl>): LocaleAlternateUrl {
  return {
    language: 'en',
    culture: 'en-SE',
    country: 'SE',
    url: '/se/en/materials/x',
    channelId: '1|se',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Pure helper: normalizeAlternatePath
// ---------------------------------------------------------------------------

describe('normalizeAlternatePath', () => {
  it('injects /p/ into a prefix-less product path (tenant-a shape)', () => {
    expect(
      normalizeAlternatePath(
        '/se/en/materials/branch-pipes/manifold-150-150-88',
        'p',
      ),
    ).toBe('/se/en/p/materials/branch-pipes/manifold-150-150-88');
  });

  it('injects /c/ into a prefix-less category path', () => {
    expect(normalizeAlternatePath('/se/en/materials/branch-pipes', 'c')).toBe(
      '/se/en/c/materials/branch-pipes',
    );
  });

  it('leaves an already-prefixed path unchanged (tinatest shape, no /p/p/)', () => {
    expect(
      normalizeAlternatePath('/se/en/p/category-1/cutting-edge', 'p'),
    ).toBe('/se/en/p/category-1/cutting-edge');
  });

  it('drops query and hash from the normalized path', () => {
    expect(normalizeAlternatePath('/se/en/materials/x?foo=1#bar', 'p')).toBe(
      '/se/en/p/materials/x',
    );
  });

  it('rejects absolute, protocol-relative, and too-few-segment paths', () => {
    expect(normalizeAlternatePath('https://evil.example/x', 'p')).toBeNull();
    expect(normalizeAlternatePath('//evil/x', 'p')).toBeNull();
    expect(normalizeAlternatePath('cutting-edge', 'p')).toBeNull();
    expect(normalizeAlternatePath('/se/en', 'p')).toBeNull();
    expect(normalizeAlternatePath('/SE/EN/x', 'p')).toBeNull();
    expect(normalizeAlternatePath(123 as unknown as string, 'p')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pure helper: mapAlternatesToShortCodes
// ---------------------------------------------------------------------------

describe('mapAlternatesToShortCodes', () => {
  const opts = {
    availableShort: ['sv', 'en'],
    currentMarket: 'se',
    typePrefix: 'p',
  };

  it('picks the current-market entry and drops other markets', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({ culture: 'en-SE', url: '/se/en/materials/x' }),
          entry({ culture: 'en-FI', url: '/fi/en/materials/x' }),
        ],
        opts,
      ),
    ).toEqual({ en: '/se/en/p/materials/x' });
  });

  it('maps both sv and en for the current market', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'en-SE',
            language: 'en',
            url: '/se/en/materials/x',
          }),
          entry({
            culture: 'sv-SE',
            language: 'sv',
            url: '/se/sv/materials/x',
          }),
        ],
        opts,
      ),
    ).toEqual({
      en: '/se/en/p/materials/x',
      sv: '/se/sv/p/materials/x',
    });
  });

  it('dedups identical same-market urls across channels (last-wins, one key)', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'en-SE',
            url: '/se/en/materials/x',
            channelId: '1|se',
          }),
          entry({
            culture: 'en-SE',
            url: '/se/en/materials/x',
            channelId: '2|se',
          }),
        ],
        opts,
      ),
    ).toEqual({ en: '/se/en/p/materials/x' });
  });

  it('drops locales not in tenant available short codes', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'de-SE',
            language: 'de',
            url: '/se/de/materials/x',
          }),
        ],
        opts,
      ),
    ).toEqual({});
  });

  it('falls back to language when culture is blank', () => {
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: '', language: 'en', url: '/se/en/materials/x' })],
        opts,
      ),
    ).toEqual({ en: '/se/en/p/materials/x' });
  });

  it('falls back to language when culture does not collapse to 2 letters', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'english',
            language: 'sv',
            url: '/se/sv/material/x',
            channelId: '1',
          }),
        ],
        opts,
      ),
    ).toEqual({ sv: '/se/sv/p/material/x' });
  });

  it('drops the entry when neither culture nor language yields a 2-letter code', () => {
    expect(
      mapAlternatesToShortCodes(
        [
          entry({
            culture: 'english',
            language: 'svenska',
            url: '/se/sv/material/x',
            channelId: '1',
          }),
        ],
        opts,
      ),
    ).toEqual({});
  });

  it('leaves already-prefixed current-market urls unchanged', () => {
    expect(
      mapAlternatesToShortCodes(
        [entry({ culture: 'en-SE', url: '/se/en/p/category-1/cutting-edge' })],
        opts,
      ),
    ).toEqual({ en: '/se/en/p/category-1/cutting-edge' });
  });

  it('handles null/empty entries and tolerates null array members', () => {
    expect(mapAlternatesToShortCodes(null, opts)).toEqual({});
    expect(mapAlternatesToShortCodes(undefined, opts)).toEqual({});
    expect(mapAlternatesToShortCodes([], opts)).toEqual({});
    expect(
      mapAlternatesToShortCodes(
        [
          null as unknown as LocaleAlternateUrl,
          entry({ culture: 'en-SE', url: '/se/en/materials/x' }),
        ],
        opts,
      ),
    ).toEqual({ en: '/se/en/p/materials/x' });
  });
});

// ---------------------------------------------------------------------------
// Thin composable: useLocaleAlternates
// ---------------------------------------------------------------------------

describe('useLocaleAlternates', () => {
  const productAlternates: LocaleAlternateUrl[] = [
    entry({
      culture: 'en-SE',
      language: 'en',
      url: '/se/en/materials/branch-pipes/manifold-150-150-88',
    }),
    entry({
      culture: 'sv-SE',
      language: 'sv',
      url: '/se/sv/material/grenror/grenror-150-150-88',
    }),
    entry({
      culture: 'en-FI',
      language: 'en',
      url: '/fi/en/materials/branch-pipes/manifold-150-150-88',
    }),
  ];

  beforeEach(() => {
    localeAlternatesState.value = {};
    mockAvailableLocales.value = ['sv', 'en'];
    mockCurrentMarket.value = 'se';
    // afterEachHandler is intentionally NOT reset: the composable registers
    // its router.afterEach exactly once (module-level guard).
  });

  it('setAlternates(product) injects /p/ and drops the /fi/ sibling', () => {
    const { alternates, setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates(productAlternates, { type: 'product' });
    expect(alternates.value).toEqual({
      en: '/se/en/p/materials/branch-pipes/manifold-150-150-88',
      sv: '/se/sv/p/material/grenror/grenror-150-150-88',
    });
    expect(hrefFor('en')).toBe(
      '/se/en/p/materials/branch-pipes/manifold-150-150-88',
    );
    expect(hrefFor('sv')).toBe('/se/sv/p/material/grenror/grenror-150-150-88');
  });

  it('setAlternates(category) injects /c/', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates(
      [entry({ culture: 'en-SE', url: '/se/en/materials/branch-pipes' })],
      { type: 'category' },
    );
    expect(hrefFor('en')).toBe('/se/en/c/materials/branch-pipes');
  });

  it('hrefFor returns undefined for a locale with no current-market alternate', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates([entry({ culture: 'en-SE', url: '/se/en/materials/x' })], {
      type: 'product',
    });
    expect(hrefFor('sv')).toBeUndefined();
  });

  it('clear empties the record; route change clears too', () => {
    const { alternates, setAlternates, clear } = useLocaleAlternates();
    setAlternates(productAlternates, { type: 'product' });
    expect(Object.keys(alternates.value).length).toBeGreaterThan(0);

    clear();
    expect(alternates.value).toEqual({});

    setAlternates(productAlternates, { type: 'product' });
    expect(afterEachHandler).toBeTypeOf('function');
    afterEachHandler!();
    expect(alternates.value).toEqual({});
  });
});
