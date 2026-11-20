import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';

// --- Shared mocks ---
// The full-catalogue list (/products) must default sort to `name-asc`, matching
// the category/brand PLP, and must omit `?sort=` from the URL while at that
// default. router.replace is a shared spy so the URL-sync write is observable.
const { replaceMock, pageRoute } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pageRoute: {
    path: '/se/sv/products',
    params: {},
    query: {} as Record<string, string | string[]>,
    hash: '',
    fullPath: '/se/sv/products',
    name: 'products',
  },
}));

const mockProductsData = ref<Record<string, unknown> | null>({
  products: [],
  count: 0,
});
const mockProductsStatus = ref('success');
const mockFiltersData = ref<Record<string, unknown> | null>({
  filters: { facets: [] },
});

const mockUseFetch = vi.fn(
  (urlOrFn: unknown, _options?: Record<string, unknown>) => {
    const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
    if (typeof url === 'string' && url.includes('/filters')) {
      return {
        data: mockFiltersData,
        status: ref('success'),
        error: ref(null),
      };
    }
    return {
      data: mockProductsData,
      status: mockProductsStatus,
      error: ref(null),
    };
  },
);

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);

const router = {
  push: vi.fn(),
  replace: replaceMock,
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  afterEach: vi.fn(),
};
vi.mock('#app/composables/router', () => ({
  useRouter: () => router,
  useRoute: () => pageRoute,
}));
vi.stubGlobal('useRouter', () => router);
vi.stubGlobal('useRoute', () => pageRoute);

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useSeoMeta: vi.fn(),
}));
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('useSeoMeta', vi.fn());
vi.mock('#site-config/app', () => ({
  useSiteConfig: () => ({ url: 'https://shop.example' }),
}));
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal(
  'useCookie',
  vi.fn(() => ref('grid')),
);
vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'sv' },
    localeQuery: { value: {} },
  }),
}));

const mockShowPrice = ref(true);
vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));
const mockTenant = ref<{ productList?: { defaultSort: string } } | null>({});
vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

const { default: AllProductsPage } =
  await import('../../../app/pages/products/index.vue');

function lastReplacedQuery(): Record<string, string> | undefined {
  const calls = replaceMock.mock.calls;
  const arg = calls[calls.length - 1]?.[0] as
    { query?: Record<string, string> } | undefined;
  return arg?.query;
}

function mountPage() {
  return shallowMount(AllProductsPage, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe('All products page (/products) sort', () => {
  beforeEach(() => {
    pageRoute.query = {};
    replaceMock.mockClear();
    mockProductsData.value = { products: [], count: 0 };
    mockProductsStatus.value = 'success';
    mockShowPrice.value = true;
    mockTenant.value = {};
  });

  it('initialises sortBy to the A-Ö default when no ?sort param', () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });
    expect(toolbar.exists()).toBe(true);
    expect(toolbar.props('sortValue')).toBe('name-asc');
  });

  it('honours an explicit ?sort param over the default', () => {
    pageRoute.query = { sort: 'newest' };
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });
    expect(toolbar.props('sortValue')).toBe('newest');
  });

  it('omits ?sort= from the URL while sortBy is the A-Ö default', async () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });

    toolbar.vm.$emit('update:sortValue', 'price-asc');
    await flushPromises();
    toolbar.vm.$emit('update:sortValue', 'name-asc');
    await flushPromises();

    const query = lastReplacedQuery();
    expect(query).toBeDefined();
    expect(query).not.toHaveProperty('sort');
  });

  it('writes ?sort= to the URL for a non-default sort', async () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });

    toolbar.vm.$emit('update:sortValue', 'price-asc');
    await flushPromises();

    expect(lastReplacedQuery()?.sort).toBe('price-asc');
  });

  it('writes ?sort=newest to the URL when newest is picked', async () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });

    toolbar.vm.$emit('update:sortValue', 'newest');
    await flushPromises();

    expect(lastReplacedQuery()?.sort).toBe('newest');
  });

  function sortValues(wrapper: ReturnType<typeof mountPage>) {
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });
    return (toolbar.props('sortOptions') as { value: string }[]).map(
      (o) => o.value,
    );
  }

  it('offers A-Ö, Ö-A, newest and both prices, without relevance', () => {
    expect(sortValues(mountPage())).toEqual([
      'name-asc',
      'name-desc',
      'newest',
      'price-asc',
      'price-desc',
    ]);
  });

  it('ignores a repeated ?sort= param and opens on the default', () => {
    pageRoute.query = { sort: ['newest', 'price-asc'] };
    const toolbar = mountPage().findComponent({ name: 'ProductListToolbar' });
    expect(toolbar.props('sortValue')).toBe('name-asc');
  });

  it('hides the price sorts when prices are hidden', () => {
    mockShowPrice.value = false;
    expect(sortValues(mountPage())).toEqual([
      'name-asc',
      'name-desc',
      'newest',
    ]);
  });

  describe('with a default sort set in the store settings', () => {
    it('opens on the configured sort and leaves it out of the URL', async () => {
      mockTenant.value = { productList: { defaultSort: 'newest' } };
      const wrapper = mountPage();
      const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });
      expect(toolbar.props('sortValue')).toBe('newest');

      toolbar.vm.$emit('update:sortValue', 'name-asc');
      await flushPromises();
      expect(lastReplacedQuery()?.sort).toBe('name-asc');

      toolbar.vm.$emit('update:sortValue', 'newest');
      await flushPromises();
      expect(lastReplacedQuery()).not.toHaveProperty('sort');
    });

    it('opens on A-Ö for a price default while prices are hidden', () => {
      mockTenant.value = { productList: { defaultSort: 'price-desc' } };
      mockShowPrice.value = false;
      const toolbar = mountPage().findComponent({ name: 'ProductListToolbar' });
      expect(toolbar.props('sortValue')).toBe('name-asc');
    });
  });
});

describe('All products page (/products) og:url', () => {
  it('is absolute on the tenant site URL', async () => {
    // useSeoMeta is compiled into useHead({ meta }) (seo-utils tree-shaking),
    // so the og:url tag is read from the mocked useHead the page calls.
    const { useHead } = await import('#app/composables/head');
    vi.mocked(useHead).mockClear();
    mountPage();
    await flushPromises();
    const ogUrl = vi
      .mocked(useHead)
      .mock.calls.flatMap(
        ([input]) => (input as { meta?: unknown[] }).meta ?? [],
      )
      .map((tag) => tag as { property?: string; content?: unknown })
      .find((tag) => tag.property === 'og:url')?.content;
    expect(typeof ogUrl === 'function' ? ogUrl() : ogUrl).toBe(
      'https://shop.example/se/sv/products',
    );
  });
});
