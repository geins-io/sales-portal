import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type { LocaleAlternateUrl } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// Proves the cross-locale alternate data path END TO END for the PDP publisher:
//   ProductDetails.vue calls setAlternates(product.alternativeUrls, { type:
//   'product' }); LocaleSwitcher.vue reads hrefFor(loc). Here we drive the
//   real useLocaleAlternates composable (002) with the LIVE-VERIFIED tenant-a
//   product shape (prefix-less, multi-market) and assert hrefFor returns the
//   injected /p/ current-market path: the EN slug, not the SV slug, not /fi/.
// Mocks mirror tests/composables/useCmsSlot.test.ts + useLocaleAlternates.test.ts.
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

// LIVE-VERIFIED tenant-a product 1335 shape: prefix-less pretty paths spanning
// multiple markets (se, fi), with SV + EN cultures.
const productAlternativeUrls: LocaleAlternateUrl[] = [
  {
    language: 'en',
    culture: 'en-SE',
    country: 'se',
    url: '/se/en/materials/branch-pipes/manifold-150-150-88',
    channelId: '1|se',
  },
  {
    language: 'en',
    culture: 'en-FI',
    country: 'fi',
    url: '/fi/en/materials/branch-pipes/manifold-150-150-88',
    channelId: '1|se',
  },
  {
    language: 'sv',
    culture: 'sv-SE',
    country: 'se',
    url: '/se/sv/material/grenror/grenror-150-150-88',
    channelId: '1|se',
  },
];

describe('ProductDetails publishes product alternates', () => {
  beforeEach(() => {
    localeAlternatesState.value = {};
    mockAvailableLocales.value = ['sv', 'en'];
    mockCurrentMarket.value = 'se';
  });

  it('hrefFor("en") resolves the injected /p/ current-market EN slug', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    // Mirrors the watch in ProductDetails.vue.
    setAlternates(productAlternativeUrls, { type: 'product' });

    const en = hrefFor('en');
    expect(en).toBe('/se/en/p/materials/branch-pipes/manifold-150-150-88');
    // Current market se, not the /fi/ sibling.
    expect(en).not.toContain('/fi/');
    // The EN target must never carry the SV slug.
    expect(en).not.toContain('grenror');
  });

  it('hrefFor("sv") resolves the injected /p/ current-market SV slug', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates(productAlternativeUrls, { type: 'product' });

    expect(hrefFor('sv')).toBe('/se/sv/p/material/grenror/grenror-150-150-88');
  });

  it('setAlternates(null) clears when the product is null (404/empty page)', () => {
    const { setAlternates, hrefFor } = useLocaleAlternates();
    setAlternates(productAlternativeUrls, { type: 'product' });
    expect(hrefFor('en')).toBe(
      '/se/en/p/materials/branch-pipes/manifold-150-150-88',
    );

    // Mirrors the watch firing with p === null.
    setAlternates(null, { type: 'product' });
    expect(hrefFor('en')).toBeUndefined();
    expect(hrefFor('sv')).toBeUndefined();
  });
});
