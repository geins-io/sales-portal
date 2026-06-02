import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.stubGlobal(
  'defineBreadcrumb',
  vi.fn(() => ({})),
);
vi.stubGlobal(
  'defineItemList',
  vi.fn(() => ({})),
);

// Mock @unhead/schema-org/vue helpers (auto-imported by Nuxt)
vi.mock('@unhead/schema-org/vue', () => ({
  defineBreadcrumb: vi.fn(() => ({})),
  defineItemList: vi.fn(() => ({})),
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
  });

  describe('canonical URL self-correction', () => {
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

    it('normalizes a prefix-less category canonical to the routable /c/ path', async () => {
      const { restore } = await setRoutePath('/se/sv/c/grenror');
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockPageInfo.value = {
        ...VALID_PAGE_INFO,
        canonicalUrl: '/se/sv/material/grenror',
      };

      try {
        await mountProductList(categoryProps, { global: { stubs } });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[2]).toBe('/se/sv/c/material/grenror');
      } finally {
        spy.mockRestore();
        restore();
      }
    });

    it('normalizes a brand canonical to the routable /b/ path', async () => {
      const { restore } = await setRoutePath('/se/sv/b/acme');
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockPageInfo.value = {
        ...VALID_PAGE_INFO,
        canonicalUrl: '/se/sv/varumarke/acme',
      };

      try {
        await mountProductList(
          { type: 'brand' as const, alias: 'acme' },
          { global: { stubs } },
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[2]).toBe('/se/sv/b/varumarke/acme');
      } finally {
        spy.mockRestore();
        restore();
      }
    });

    it('does not rewrite when the routable target equals the current path', async () => {
      const { restore } = await setRoutePath('/se/sv/c/foder');
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockPageInfo.value = {
        ...VALID_PAGE_INFO,
        canonicalUrl: '/se/sv/foder',
      };

      try {
        await mountProductList(categoryProps, { global: { stubs } });
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        restore();
      }
    });

    it('does not rewrite when the canonical URL is in a different locale (fallback case)', async () => {
      const { restore } = await setRoutePath('/se/en/c/kategori-1');
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockPageInfo.value = {
        ...VALID_PAGE_INFO,
        canonicalUrl: '/se/sv/kategori-1',
      };

      try {
        await mountProductList(categoryProps, { global: { stubs } });
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        restore();
      }
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
});
