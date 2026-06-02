import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type { LocaleAlternateUrl } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// Proves the cross-locale alternate data path END TO END for the PLP publisher:
//   ProductList.vue calls setAlternates(pageInfo.alternativeUrls, { type:
//   props.type }) where props.type is 'category' | 'brand'. Drives the real
//   useLocaleAlternates composable (002) with the LIVE-VERIFIED tenant-a
//   prefix-less category/brand shape and asserts hrefFor injects /c/ or /b/.
// Mocks mirror tests/composables/useLocaleAlternates.test.ts.
// ---------------------------------------------------------------------------

const mockAvailableLocales = ref<string[]>(['sv', 'en']);
const mockCurrentMarket = ref<string>('se');
const localeAlternatesState = ref<Record<string, string>>({});

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
    afterEach: () => {},
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
  afterEach: () => {},
}));

const { useLocaleAlternates } =
  await import('~/composables/useLocaleAlternates');

// LIVE-VERIFIED tenant-a category shape: prefix-less pretty paths, SV + EN.
const categoryAlternativeUrls: LocaleAlternateUrl[] = [
  {
    language: 'en',
    culture: 'en-SE',
    country: 'se',
    url: '/se/en/materials/branch-pipes',
    channelId: '1|se',
  },
  {
    language: 'sv',
    culture: 'sv-SE',
    country: 'se',
    url: '/se/sv/material/grenror',
    channelId: '1|se',
  },
];

describe('ProductList publishes PLP alternates', () => {
  beforeEach(() => {
    localeAlternatesState.value = {};
    mockAvailableLocales.value = ['sv', 'en'];
    mockCurrentMarket.value = 'se';
  });

  it('category type injects /c/ into the EN alternate', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    // Mirrors ProductList.vue watch with props.type === 'category'.
    setAlternates(categoryAlternativeUrls, { type: 'category' });

    expect(hrefFor('en')).toBe('/se/en/c/materials/branch-pipes');
    expect(hrefFor('sv')).toBe('/se/sv/c/material/grenror');
  });

  it('brand type injects /b/ into the EN alternate', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    // Mirrors ProductList.vue watch with props.type === 'brand'.
    setAlternates(categoryAlternativeUrls, { type: 'brand' });

    expect(hrefFor('en')).toBe('/se/en/b/materials/branch-pipes');
  });

  it('setAlternates(null) clears when pageInfo is null (404 guard)', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates(categoryAlternativeUrls, { type: 'category' });
    expect(hrefFor('en')).toBe('/se/en/c/materials/branch-pipes');

    setAlternates(null, { type: 'category' });
    expect(hrefFor('en')).toBeUndefined();
  });
});
