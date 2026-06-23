import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';

// --- Shared mocks ---
// The search results page (/s/{query}) must keep `relevance` as its default
// sort (the API ranks by match quality), unlike the product lists which default
// to `newest`. The URL omits `?sort=` while at the relevance default.
const { replaceMock, pageRoute } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pageRoute: {
    path: '/se/sv/s/com',
    params: { query: 'com' } as Record<string, string>,
    query: {} as Record<string, string>,
    hash: '',
    fullPath: '/se/sv/s/com',
    name: 's-query',
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

const mockUseFetch = vi.fn((...args: unknown[]) => {
  const url =
    typeof args[0] === 'function' ? (args[0] as () => string)() : args[0];
  if (typeof url === 'string' && url.includes('/filters')) {
    return { data: mockFiltersData, status: ref('success'), error: ref(null) };
  }
  return {
    data: mockProductsData,
    status: mockProductsStatus,
    error: ref(null),
  };
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

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

const { default: SearchResultsPage } = await import(
  '../../../app/pages/s/[query].vue'
);

function lastReplacedQuery(): Record<string, string> | undefined {
  const calls = replaceMock.mock.calls;
  const arg = calls[calls.length - 1]?.[0] as
    | { query?: Record<string, string> }
    | undefined;
  return arg?.query;
}

function mountPage() {
  return shallowMount(SearchResultsPage, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe('Search results page (/s/[query]) sort', () => {
  beforeEach(() => {
    pageRoute.query = {};
    replaceMock.mockClear();
    mockProductsData.value = { products: [], count: 0 };
    mockProductsStatus.value = 'success';
  });

  it('initialises sortBy to the relevance default', () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });
    expect(toolbar.exists()).toBe(true);
    expect(toolbar.props('sortValue')).toBe('relevance');
  });

  it('omits ?sort= from the URL while sortBy is the relevance default', async () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });

    toolbar.vm.$emit('update:sortValue', 'newest');
    await flushPromises();
    toolbar.vm.$emit('update:sortValue', 'relevance');
    await flushPromises();

    const query = lastReplacedQuery();
    expect(query).toBeDefined();
    expect(query).not.toHaveProperty('sort');
  });

  it('writes ?sort= to the URL for a non-default sort', async () => {
    const wrapper = mountPage();
    const toolbar = wrapper.findComponent({ name: 'ProductListToolbar' });

    toolbar.vm.$emit('update:sortValue', 'newest');
    await flushPromises();

    expect(lastReplacedQuery()?.sort).toBe('newest');
  });
});
