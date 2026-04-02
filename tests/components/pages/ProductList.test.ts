import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import ProductList from '../../../app/components/pages/ProductList.vue';

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
};
vi.stubGlobal('useRouter', () => mockRouter);
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

describe('ProductList.vue', () => {
  beforeEach(() => {
    mockProductsData.value = null;
    mockFiltersData.value = null;
    mockPageInfo.value = null;
    mockProductsStatus.value = 'idle';
    mockUseFetch.mockClear();
  });

  describe('SSR safety — renders without crash when async data is null', () => {
    it('renders without error when all fetch data is null (SSR initial state)', () => {
      // Simulates SSR first render: useFetch returns null data
      mockProductsData.value = null;
      mockFiltersData.value = null;
      mockPageInfo.value = null;
      mockProductsStatus.value = 'pending';

      const wrapper = shallowMountComponent(ProductList, {
        props: categoryProps,
        global: { stubs },
      });

      // Should render without throwing "Cannot convert undefined or null to object"
      expect(wrapper.exists()).toBe(true);
      // Should show loading skeleton when pending with no data
      expect(wrapper.find('[data-testid="plp-loading"]').exists()).toBe(true);
    });

    it('renders empty state when fetch completes with empty products', () => {
      mockProductsData.value = { products: [], count: 0 };
      mockFiltersData.value = { filters: { facets: [] } };
      mockProductsStatus.value = 'success';

      const wrapper = shallowMountComponent(ProductList, {
        props: categoryProps,
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('[data-testid="plp-empty"]').exists()).toBe(true);
    });

    it('renders product cards when fetch returns products', () => {
      mockProductsData.value = {
        products: [
          { productId: '1', name: 'Product 1' },
          { productId: '2', name: 'Product 2' },
        ],
        count: 2,
      };
      mockFiltersData.value = { filters: { facets: [] } };
      mockProductsStatus.value = 'success';

      const wrapper = shallowMountComponent(ProductList, {
        props: categoryProps,
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="product-card"]').length).toBe(2);
    });

    it('handles brand resolution type correctly', () => {
      mockProductsData.value = { products: [], count: 0 };
      mockProductsStatus.value = 'success';

      const brandProps = {
        type: 'brand' as const,
        alias: 'atlas-copco',
      };

      const wrapper = shallowMountComponent(ProductList, {
        props: brandProps,
        global: { stubs },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe('pagination', () => {
    it('shows pagination when totalCount > 0', () => {
      mockProductsData.value = {
        products: [{ productId: '1', name: 'Product 1' }],
        count: 25,
      };
      mockProductsStatus.value = 'success';

      const wrapper = shallowMountComponent(ProductList, {
        props: categoryProps,
        global: { stubs },
      });

      expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(true);
    });

    it('hides pagination when totalCount is 0', () => {
      mockProductsData.value = { products: [], count: 0 };
      mockProductsStatus.value = 'success';

      const wrapper = shallowMountComponent(ProductList, {
        props: categoryProps,
        global: { stubs },
      });

      expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(false);
    });
  });
});
