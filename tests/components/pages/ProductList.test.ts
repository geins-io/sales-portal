import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, defineComponent, h, Suspense } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import ProductList from '../../../app/components/pages/ProductList.vue';

// ProductList uses `await useFetch(...)` so its setup is async. The top-level
// await makes the component require a Suspense parent to render. Wrap it
// here and flush promises so tests can observe the resolved state.
async function mountProductList(
  props: Record<string, unknown>,
  mountOptions: Parameters<typeof mount>[1] = {},
) {
  const Wrapper = defineComponent({
    components: { ProductList },
    props: Object.keys(props),
    setup(wrapperProps) {
      return () =>
        h(Suspense, null, {
          default: () => h(ProductList, wrapperProps),
        });
    },
  });
  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    ...mountOptions,
    props,
    global: {
      ...defaultMountOptions.global,
      ...mountOptions.global,
      stubs: {
        ...(defaultMountOptions.global?.stubs ?? {}),
        ...(mountOptions.global?.stubs ?? {}),
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// --- Mocks ---

// navigateTo + recoverEntityUrl are the redirect/recovery boundaries. The PLP
// issues a real 301 (navigateTo) for a same-prefix differing canonical SERVER
// SIDE ONLY, and delegates content misses to recoverEntityUrl on both server
// and client. Both are mocked as spies and asserted against; assertions watch
// the spies, never real navigation.
const { navigateToMock, recoverEntityUrlMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn(() => Promise.resolve()),
  recoverEntityUrlMock: vi.fn(() => Promise.resolve()),
}));

vi.stubGlobal('navigateTo', (...args: unknown[]) => navigateToMock(...args));
vi.mock('../../../app/composables/useEntityUrlRecovery', () => ({
  recoverEntityUrl: (...args: [string]) => recoverEntityUrlMock(...args),
}));
vi.stubGlobal('recoverEntityUrl', (...args: [string]) =>
  recoverEntityUrlMock(...args),
);

const mockProductsData = ref<Record<string, unknown> | null>(null);
const mockFiltersData = ref<Record<string, unknown> | null>(null);
const mockPageInfo = ref<Record<string, unknown> | null>(null);
const mockProductsStatus = ref('idle');

const mockUseFetch = vi.fn((...args: unknown[]) => {
  const url =
    typeof args[0] === 'function' ? (args[0] as () => string)() : args[0];
  if (typeof url === 'string' && url.includes('/products')) {
    return {
      data: mockProductsData,
      status: mockProductsStatus,
      error: ref(null),
      pending: ref(false),
      refresh: vi.fn(),
      execute: vi.fn(),
    };
  }
  if (typeof url === 'string' && url.includes('/filters')) {
    return {
      data: mockFiltersData,
      status: ref('idle'),
      error: ref(null),
      pending: ref(false),
      refresh: vi.fn(),
      execute: vi.fn(),
    };
  }
  // pageInfo fetch
  return {
    data: mockPageInfo,
    status: ref('idle'),
    error: ref(null),
    pending: ref(false),
    refresh: vi.fn(),
    execute: vi.fn(),
  };
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

// Override the global useLocaleMarket mock so localePath prepends the
// /se/sv prefix used by the live-verified canonical fixtures below. The
// real localePath re-adds the current /{market}/{locale}/ prefix to the
// locale-free path returned by the route helpers.
vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'sv' },
    localePath: (path: string) =>
      `/se/sv${path.startsWith('/') ? path : '/' + path}`,
    localeQuery: { value: {} },
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
// useState (used by useLocaleAlternates) needs a live Nuxt instance that the
// component tier does not provide. Stub it with a plain ref-backed store so
// the setup runs to completion and the canonical replaceState block executes.
const { stubUseState } = vi.hoisted(() => ({
  // A plain { value } box is enough; useLocaleAlternates only reads/writes
  // `.value`. Avoids needing Vue's ref inside the hoisted (pre-import) factory.
  stubUseState: (_key: string, init?: () => unknown) => ({
    value: typeof init === 'function' ? init() : undefined,
  }),
}));
vi.stubGlobal('useState', stubUseState);
vi.mock('#app/composables/state', () => ({ useState: stubUseState }));
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('useSeoMeta', vi.fn());
vi.stubGlobal('useSchemaOrg', vi.fn());
// Shared defineItemList spy so the JSON-LD migration test can read the exact
// ItemList args the component built (the SFC auto-imports defineItemList from
// @unhead/schema-org/vue, so the module mock and the global stub must share one
// spy instance).
const { defineItemListMock } = vi.hoisted(() => ({
  defineItemListMock: vi.fn(() => ({})),
}));
vi.stubGlobal(
  'defineBreadcrumb',
  vi.fn(() => ({})),
);
vi.stubGlobal('defineItemList', (...args: unknown[]) =>
  defineItemListMock(...args),
);

// Mock @unhead/schema-org/vue helpers (auto-imported by Nuxt)
vi.mock('@unhead/schema-org/vue', () => ({
  defineBreadcrumb: vi.fn(() => ({})),
  defineItemList: (...args: unknown[]) => defineItemListMock(...args),
}));

// Mock nuxt-schema-org runtime composable (auto-imported by Nuxt unimport).
const { schemaOrgComposablePath: plpSchemaOrgPath } = vi.hoisted(() => {
  const nodeModule = require.resolve('nuxt-schema-org/schema'); // exported subpath
  const pkgRoot = nodeModule.replace(/\/dist\/schema\..*$/, '');
  return {
    schemaOrgComposablePath: `${pkgRoot}/dist/runtime/app/composables/useSchemaOrg`,
  };
});
vi.mock(plpSchemaOrgPath, () => ({
  useSchemaOrg: vi.fn(),
}));
vi.stubGlobal(
  'useSeoLinks',
  vi.fn(() => ({ seoLinks: ref([]) })),
);
vi.stubGlobal(
  'useCookie',
  vi.fn(() => ref('grid')),
);
vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  // useLocaleAlternates registers a router.afterEach hook on the client;
  // without this the composable throws before the canonical rewrite runs.
  afterEach: vi.fn(),
};
vi.stubGlobal('useRouter', () => mockRouter);
// useLocaleAlternates auto-imports useRouter/useRoute from #app/composables/router
// (not the global stub) and registers an afterEach hook; override the module mock
// so that router carries afterEach and the canonical rewrite block is reached. The
// route object is shared/mutable so setRoutePath() below can drive the component's
// current path per test.
const { plpRoute } = vi.hoisted(() => ({
  plpRoute: {
    path: '/foder',
    params: { slug: ['foder'] },
    query: {},
    hash: '',
    fullPath: '/foder',
    name: 'slug',
  },
}));
vi.mock('#app/composables/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    afterEach: vi.fn(),
  }),
  useRoute: () => plpRoute,
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
}));
vi.stubGlobal('useRoute', () => ({
  path: '/foder',
  params: { slug: ['foder'] },
  query: {},
  hash: '',
  fullPath: '/foder',
  name: 'slug',
}));

// Stub useDebounceFn from VueUse
vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: unknown[]) => void) => fn,
}));

// Module-level refs so existing tests keep true defaults and the visibility
// describe block can flip them without affecting other describes.
// Mirrors the pattern in VatDisplaySwitcher.test.ts: declare refs at module
// scope, reference them inside vi.mock factory closures (factories run at
// runtime, not at hoist time, so ref() is available).
const mockShowPrice = ref(true);
const mockShowStock = ref(true);

vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

vi.mock('../../../app/composables/useStockVisibility', () => ({
  useStockVisibility: () => ({ showStock: mockShowStock }),
}));

const stubs = {
  ProductListHeader: {
    template: '<div data-testid="plp-header" />',
    props: ['pageInfo', 'breadcrumbs'],
  },
  ProductActiveFilters: {
    template: '<div data-testid="plp-active-filters" />',
    props: ['filters', 'facets'],
  },
  ProductListToolbar: {
    template: '<div data-testid="plp-toolbar"><slot name="filters" /></div>',
    props: [
      'resultCount',
      'sortValue',
      'sortOptions',
      'viewMode',
      'filterText',
      'hasActiveFilters',
    ],
  },
  ProductFilters: {
    template: '<div data-testid="plp-filters" />',
    props: ['facets', 'modelValue'],
  },
  ProductListSkeleton: {
    template: '<div data-testid="plp-loading" />',
    props: ['viewMode'],
  },
  PagesProductListSkeleton: {
    template: '<div data-testid="plp-loading" />',
    props: ['viewMode'],
  },
  ProductCard: {
    template: '<div data-testid="product-card" />',
    props: ['product', 'variant'],
  },
  SharedProductCard: {
    template: '<div data-testid="product-card" />',
    props: ['product', 'variant'],
  },
  EmptyState: {
    template: "<div :data-testid=\"$attrs['data-testid'] || 'empty-state'\" />",
    props: ['icon', 'title', 'description'],
  },
  SharedEmptyState: {
    template: "<div :data-testid=\"$attrs['data-testid'] || 'empty-state'\" />",
    props: ['icon', 'title', 'description'],
  },
  NumberedPagination: {
    template: '<div data-testid="pagination" />',
    props: ['currentPage', 'totalPages'],
  },
  SharedNumberedPagination: {
    template: '<div data-testid="pagination" />',
    props: ['currentPage', 'totalPages'],
  },
};

const categoryProps = {
  type: 'category' as const,
  alias: 'foder',
};

// Default pageInfo — a valid resolved category/brand. Tests that want to
// assert 404 behavior override this with null/invalid shapes.
const VALID_PAGE_INFO = {
  id: 1,
  name: 'Test Category',
  alias: 'foder',
  canonicalUrl: '/se/sv/foder',
};

describe('ProductList.vue', () => {
  beforeEach(() => {
    mockProductsData.value = null;
    mockFiltersData.value = null;
    mockPageInfo.value = { ...VALID_PAGE_INFO };
    mockProductsStatus.value = 'idle';
    mockUseFetch.mockClear();
    navigateToMock.mockClear();
    recoverEntityUrlMock.mockClear();
  });

  describe('content-miss recovery (Problem B)', () => {
    async function setRoutePath(path: string): Promise<{
      restore: () => void;
    }> {
      const router = (
        (await import('#app/composables/router')) as unknown as {
          useRoute: () => { path: string };
        }
      ).useRoute() as { path: string };
      const originalPath = router.path;
      router.path = path;
      return { restore: () => (router.path = originalPath) };
    }

    it('calls recoverEntityUrl with the route path when the listing is missing', async () => {
      // A renamed/old category/brand slug must 301 to canonical via
      // recoverEntityUrl instead of throwing a bare 404. recoverEntityUrl is
      // mocked to resolve, so the setup continues; we only assert it was
      // consulted with the path.
      const { restore } = await setRoutePath('/se/sv/c/old-category');
      mockPageInfo.value = null;

      try {
        await mountProductList(categoryProps, { global: { stubs } });
        expect(recoverEntityUrlMock).toHaveBeenCalledTimes(1);
        expect(recoverEntityUrlMock).toHaveBeenCalledWith(
          '/se/sv/c/old-category',
        );
      } finally {
        restore();
      }
    });

    it('does not call recoverEntityUrl when the listing loads', async () => {
      // Route path must equal the normalized canonical so the canonical-correction
      // block is a genuine no-op (routable === path). Without this, samePrefix
      // returns true (bSeg.length < 2 for '/foder') and the correction fires
      // navigateTo as a side effect, meaning the test does not verify "normal
      // load = zero navigation".
      //
      // localePath(categoryPath('/se/sv/foder'))
      //   -> localePath('/c/foder')  -> '/se/sv/c/foder'
      const router = (
        (await import('#app/composables/router')) as unknown as {
          useRoute: () => { path: string };
        }
      ).useRoute() as { path: string };
      const originalPath = router.path;
      router.path = '/se/sv/c/foder';

      mockPageInfo.value = { ...VALID_PAGE_INFO };

      try {
        await mountProductList(categoryProps, { global: { stubs } });

        expect(recoverEntityUrlMock).not.toHaveBeenCalled();
        expect(navigateToMock).not.toHaveBeenCalled();
      } finally {
        router.path = originalPath;
      }
    });
  });

  // The canonical 301 is SERVER-SIDE ONLY. A client-side
  // navigateTo({ replace: true }) re-ran the non-awaited product/filter fetches
  // mid-navigation; under that burst the Geins-backed list endpoints
  // intermittently 503'd and the errored response blanked the grid until a
  // manual reload. In the unit env import.meta.server is false (client), so the
  // redirect must NOT fire and the products must still render. The
  // redirect-TARGET logic (prefix-less -> /c/|/b/, loop guard, cross-locale
  // guard) is unit tested against canonicalListRedirectTarget in
  // tests/unit/route-helpers.test.ts.
  describe('canonical URL self-correction (server-side only)', () => {
    async function setRoutePath(path: string): Promise<{
      restore: () => void;
    }> {
      const router = (
        (await import('#app/composables/router')) as unknown as {
          useRoute: () => { path: string };
        }
      ).useRoute() as { path: string };
      const originalPath = router.path;
      router.path = path;
      return { restore: () => (router.path = originalPath) };
    }

    it('does not issue a client-side redirect when the canonical differs, and still renders products', async () => {
      const { restore } = await setRoutePath('/se/sv/c/grenror');
      mockPageInfo.value = {
        ...VALID_PAGE_INFO,
        canonicalUrl: '/se/sv/material/grenror',
      };
      mockProductsData.value = {
        products: [{ productId: '1', name: 'Product 1', alias: 'product-1' }],
        count: 1,
      };

      try {
        const wrapper = await mountProductList(categoryProps, {
          global: { stubs },
        });
        expect(navigateToMock).not.toHaveBeenCalled();
        expect(wrapper.findAll('[data-testid="product-card"]').length).toBe(1);
      } finally {
        restore();
      }
    });

    it('does not issue a client-side redirect for a differing brand canonical', async () => {
      const { restore } = await setRoutePath('/se/sv/b/acme');
      mockPageInfo.value = {
        ...VALID_PAGE_INFO,
        canonicalUrl: '/se/sv/varumarke/acme',
      };

      try {
        await mountProductList(
          { type: 'brand' as const, alias: 'acme' },
          { global: { stubs } },
        );
        expect(navigateToMock).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });
  });

  describe('JSON-LD ItemList url migration', () => {
    it('builds the ItemList product url via productPath (prefix-correct)', async () => {
      mockProductsData.value = {
        products: [{ productId: '1', name: 'Product 1', alias: 'product-1' }],
        count: 1,
      };
      mockProductsStatus.value = 'success';

      defineItemListMock.mockClear();

      await mountProductList(categoryProps, { global: { stubs } });

      const arg = defineItemListMock.mock.calls[0]?.[0] as {
        itemListElement: () => Array<{ url?: string }>;
      };
      const elements = arg.itemListElement();
      // productPath('/product-1') -> '/p/product-1', localePath -> '/se/sv/p/product-1'
      expect(elements[0]?.url).toBe('/se/sv/p/product-1');
    });
  });

  describe('rendering states', () => {
    it('renders loading skeleton while products are pending', async () => {
      mockProductsData.value = null;
      mockFiltersData.value = null;
      mockProductsStatus.value = 'pending';

      const wrapper = await mountProductList(categoryProps, {
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('[data-testid="plp-loading"]').exists()).toBe(true);
    });

    it('renders empty state when fetch completes with empty products', async () => {
      mockProductsData.value = { products: [], count: 0 };
      mockFiltersData.value = { filters: { facets: [] } };
      mockProductsStatus.value = 'success';

      const wrapper = await mountProductList(categoryProps, {
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('[data-testid="plp-empty"]').exists()).toBe(true);
    });

    it('renders product cards when fetch returns products', async () => {
      mockProductsData.value = {
        products: [
          { productId: '1', name: 'Product 1' },
          { productId: '2', name: 'Product 2' },
        ],
        count: 2,
      };
      mockFiltersData.value = { filters: { facets: [] } };
      mockProductsStatus.value = 'success';

      const wrapper = await mountProductList(categoryProps, {
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="product-card"]').length).toBe(2);
    });

    it('handles brand resolution type correctly', async () => {
      mockProductsData.value = { products: [], count: 0 };
      mockProductsStatus.value = 'success';

      const brandProps = {
        type: 'brand' as const,
        alias: 'atlas-copco',
      };

      const wrapper = await mountProductList(brandProps, {
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe('pagination', () => {
    it('shows pagination when totalCount > 0', async () => {
      mockProductsData.value = {
        products: [{ productId: '1', name: 'Product 1' }],
        count: 25,
      };
      mockProductsStatus.value = 'success';

      const wrapper = await mountProductList(categoryProps, {
        global: { stubs },
      });

      expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(true);
    });

    it('hides pagination when totalCount is 0', async () => {
      mockProductsData.value = { products: [], count: 0 };
      mockProductsStatus.value = 'success';

      const wrapper = await mountProductList(categoryProps, {
        global: { stubs },
      });

      expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(false);
    });
  });

  describe('filter visibility: price and stock facet exclusion', () => {
    // Three-facet fixture: Price, StockStatus, and a plain Brand facet.
    const facetsWithPriceAndStock = {
      filters: {
        facets: [
          {
            filterId: 'Price',
            type: 'Price',
            label: 'Price',
            group: 'Price',
            values: [
              {
                _id: 'price_100',
                count: 10,
                facetId: 'Price',
                parentId: null,
                label: 'Under 100',
                order: 0,
                hidden: false,
              },
            ],
          },
          {
            filterId: 'StockStatus',
            type: 'StockStatus',
            label: 'Stock status',
            group: 'StockStatus',
            values: [
              {
                _id: 'in_stock',
                count: 5,
                facetId: 'StockStatus',
                parentId: null,
                label: 'In stock',
                order: 0,
                hidden: false,
              },
            ],
          },
          {
            filterId: 'Brand',
            type: 'Brand',
            label: 'Brand',
            group: 'Brand',
            values: [
              {
                _id: 'brand_acme',
                count: 3,
                facetId: 'Brand',
                parentId: null,
                label: 'Acme',
                order: 0,
                hidden: false,
              },
            ],
          },
        ],
      },
    };

    beforeEach(() => {
      mockShowPrice.value = false;
      mockShowStock.value = false;
      mockFiltersData.value = facetsWithPriceAndStock;
      mockProductsData.value = { products: [], count: 0 };
      mockProductsStatus.value = 'success';
    });

    afterEach(() => {
      mockShowPrice.value = true;
      mockShowStock.value = true;
    });

    it('(a) excludes Price and StockStatus facets from ProductFilters when both are hidden', async () => {
      const capturedProps: Array<Record<string, unknown>> = [];
      const capturingStubs = {
        ...stubs,
        ProductFilters: {
          template: '<div data-testid="plp-filters" />',
          props: ['facets', 'modelValue'],
          setup(props: { facets: Array<{ filterId: string }> }) {
            capturedProps.push({ facets: props.facets });
            return {};
          },
        },
      };

      await mountProductList(categoryProps, {
        global: { stubs: capturingStubs },
      });

      // At least one render captured facets
      expect(capturedProps.length).toBeGreaterThan(0);
      const lastCapture = capturedProps[capturedProps.length - 1]!;
      const facetIds = (lastCapture.facets as Array<{ filterId: string }>).map(
        (f) => f.filterId,
      );

      expect(facetIds).not.toContain('Price');
      expect(facetIds).not.toContain('StockStatus');
      expect(facetIds).toContain('Brand');
    });

    it('(b) strips Price and StockStatus keys from filterState when URL query contains them', async () => {
      // plpRoute is the shared mutable object returned by the module-mocked
      // useRoute(). Mutating its query here seeds the URL state that
      // restoreFiltersFromQuery() reads at component setup time.
      const savedQuery = plpRoute.query;
      plpRoute.query = {
        Price: 'price_100',
        StockStatus: 'in_stock',
        Brand: 'brand_acme',
      } as Record<string, string>;

      try {
        const capturedFilters: Array<Record<string, unknown>> = [];
        const capturingStubs = {
          ...stubs,
          ProductActiveFilters: {
            template: '<div data-testid="plp-active-filters" />',
            props: ['filters', 'facets'],
            setup(props: { filters: Record<string, string[]> }) {
              capturedFilters.push({ filters: props.filters });
              return {};
            },
          },
        };

        await mountProductList(categoryProps, {
          global: { stubs: capturingStubs },
        });

        // stripHiddenFacetKeys runs at setup; Price and StockStatus must be gone
        if (capturedFilters.length > 0) {
          const lastFilters = capturedFilters[capturedFilters.length - 1]!
            .filters as Record<string, string[]>;
          expect(Object.keys(lastFilters)).not.toContain('Price');
          expect(Object.keys(lastFilters)).not.toContain('StockStatus');
        }
      } finally {
        plpRoute.query = savedQuery;
      }
    });

    it('positive control: all three facets present when showPrice and showStock are true', async () => {
      mockShowPrice.value = true;
      mockShowStock.value = true;

      const capturedProps: Array<Record<string, unknown>> = [];
      const capturingStubs = {
        ...stubs,
        ProductFilters: {
          template: '<div data-testid="plp-filters" />',
          props: ['facets', 'modelValue'],
          setup(props: { facets: Array<{ filterId: string }> }) {
            capturedProps.push({ facets: props.facets });
            return {};
          },
        },
      };

      await mountProductList(categoryProps, {
        global: { stubs: capturingStubs },
      });

      expect(capturedProps.length).toBeGreaterThan(0);
      const lastCapture = capturedProps[capturedProps.length - 1]!;
      const facetIds = (lastCapture.facets as Array<{ filterId: string }>).map(
        (f) => f.filterId,
      );

      expect(facetIds).toContain('Price');
      expect(facetIds).toContain('StockStatus');
      expect(facetIds).toContain('Brand');
    });
  });
});
