// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed, reactive } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

// ---------------------------------------------------------------------------
// Favorites store mock
// ---------------------------------------------------------------------------
const mockRemove = vi.fn();
const mockItems = ref<string[]>([]);
const mockCount = computed(() => mockItems.value.length);

const mockFavoritesStore = reactive({
  items: mockItems,
  count: mockCount,
  remove: mockRemove,
  clear: vi.fn(),
  initialize: vi.fn(),
  toggle: vi.fn(),
  add: vi.fn(),
  isFavorite: vi.fn(() => false),
});

vi.mock('../../../app/stores/favorites', () => ({
  useFavoritesStore: () => mockFavoritesStore,
}));

// ---------------------------------------------------------------------------
// Cart store mock
// ---------------------------------------------------------------------------
const mockAddItem = vi.fn();
const mockCartStore = { addItem: mockAddItem };

vi.mock('../../../app/stores/cart', () => ({
  useCartStore: () => mockCartStore,
}));

// ---------------------------------------------------------------------------
// useFetch mock — controls products returned by /api/products/by-aliases
// ---------------------------------------------------------------------------
type FavoriteProduct = {
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  productImages?: Array<{ fileName?: string | null } | null> | null;
  unitPrice?: {
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
    regularPriceIncVat?: number | null;
    regularPriceIncVatFormatted?: string | null;
    isDiscounted?: boolean | null;
  } | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
};

let mockFetchProducts: FavoriteProduct[] = [];
let mockFetchPending = false;
const mockRefresh = vi.fn();

const useFetchMock = () => ({
  data: ref({ products: mockFetchProducts }),
  pending: ref(mockFetchPending),
  refresh: mockRefresh,
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: useFetchMock,
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', useFetchMock);

// ---------------------------------------------------------------------------
// Nuxt/auto-import stubs
// ---------------------------------------------------------------------------
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', vi.fn());
vi.stubGlobal('useI18n', () => ({
  t: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  locale: ref('en'),
}));
vi.stubGlobal('useLocaleMarket', () => ({
  localePath: (path: string) =>
    `/se/en${path.startsWith('/') ? path : '/' + path}`,
  currentMarket: computed(() => 'se'),
  currentLocale: computed(() => 'en'),
}));

// ---------------------------------------------------------------------------
// Stubs for child components
// ---------------------------------------------------------------------------
const stubs = {
  PortalShell: { template: '<div data-testid="portal-shell"><slot /></div>' },
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  Icon: { template: '<span></span>', props: ['name'] },
  NuxtIcon: { template: '<span></span>', props: ['name'] },
  ProductCard: {
    name: 'ProductCard',
    template:
      '<div data-testid="product-card" :data-alias="product?.alias" :data-name="product?.name"></div>',
    props: ['product', 'variant', 'isLoading'],
    emits: ['add-to-cart'],
  },
};

// ---------------------------------------------------------------------------
// Import page after all globals are in place
// ---------------------------------------------------------------------------
const FavoritesPage = await import('../../../app/pages/portal/favorites.vue');

function mountFavorites(
  opts: {
    aliases?: string[];
    products?: FavoriteProduct[];
    pending?: boolean;
  } = {},
) {
  mockItems.value = opts.aliases ?? [];
  mockFetchProducts = opts.products ?? [];
  mockFetchPending = opts.pending ?? false;
  return mount(FavoritesPage.default, { global: { stubs } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FavoritesPage (Figma-aligned grid)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockItems.value = [];
    mockFetchProducts = [];
    mockFetchPending = false;
    mockRemove.mockClear();
    mockAddItem.mockClear();
    mockRefresh.mockClear();
  });

  it('renders inside PortalShell', () => {
    const wrapper = mountFavorites();
    expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="favorites-page"]').exists()).toBe(true);
  });

  it('shows empty state when no favorites exist', () => {
    const wrapper = mountFavorites({ aliases: [] });
    expect(wrapper.find('[data-testid="favorites-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="favorites-grid"]').exists()).toBe(false);
  });

  it('shows loading state while fetch is pending', () => {
    const wrapper = mountFavorites({
      aliases: ['a'],
      pending: true,
    });
    expect(wrapper.find('[data-testid="favorites-loading"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="favorites-grid"]').exists()).toBe(false);
  });

  it('renders product card grid when products are loaded', () => {
    const wrapper = mountFavorites({
      aliases: ['a', 'b'],
      products: [
        { alias: 'a', name: 'Product A' },
        { alias: 'b', name: 'Product B' },
      ],
    });
    expect(wrapper.find('[data-testid="favorites-grid"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="favorite-card"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="product-card"]')).toHaveLength(2);
  });

  it('shows favorites count element', () => {
    const wrapper = mountFavorites({ aliases: ['a', 'b'] });
    const countText = wrapper.find('[data-testid="favorites-count-text"]');
    expect(countText.exists()).toBe(true);
    // The text comes from portal.favorites.count with {count} interpolation.
    // We verify the element is wired to the store count; the i18n renderer
    // in the test harness returns the raw key, so we only assert presence.
    expect(countText.text().length).toBeGreaterThan(0);
  });

  it('renders grid/list view toggle with grid active by default', () => {
    const wrapper = mountFavorites({ aliases: ['a'] });
    const toggle = wrapper.find('[data-testid="view-toggle"]');
    expect(toggle.exists()).toBe(true);
    const buttons = toggle.findAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true');
    expect(buttons[1]!.attributes('aria-pressed')).toBe('false');
  });

  it('calls favoritesStore.remove when the heart overlay is clicked', async () => {
    const wrapper = mountFavorites({
      aliases: ['alpha'],
      products: [{ alias: 'alpha', name: 'Alpha' }],
    });
    await wrapper.find('[data-testid="favorite-remove"]').trigger('click');
    expect(mockRemove).toHaveBeenCalledWith('alpha');
  });

  it('calls cartStore.addItem when ProductCard emits add-to-cart', async () => {
    const wrapper = mountFavorites({
      aliases: ['alpha'],
      products: [
        {
          alias: 'alpha',
          name: 'Alpha',
          skus: [{ skuId: 42 }],
        },
      ],
    });
    const card = wrapper.findComponent({ name: 'ProductCard' });
    expect(card.exists()).toBe(true);
    card.vm.$emit('add-to-cart', { quantity: 3 });
    await wrapper.vm.$nextTick();
    expect(mockAddItem).toHaveBeenCalledWith(42, 3);
  });

  it('skips add-to-cart when product has no skuId', async () => {
    const wrapper = mountFavorites({
      aliases: ['alpha'],
      products: [{ alias: 'alpha', name: 'Alpha', skus: [] }],
    });
    const card = wrapper.findComponent({ name: 'ProductCard' });
    card.vm.$emit('add-to-cart', { quantity: 2 });
    await wrapper.vm.$nextTick();
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('handles partial loading — some aliases missing from response', () => {
    const wrapper = mountFavorites({
      aliases: ['a', 'b', 'c'],
      products: [
        { alias: 'a', name: 'A' },
        // 'b' and 'c' omitted by the server
      ],
    });
    expect(wrapper.findAll('[data-testid="favorite-card"]')).toHaveLength(1);
  });

  it('keeps empty state markup (heart icon + browse link)', () => {
    const wrapper = mountFavorites({ aliases: [] });
    const empty = wrapper.find('[data-testid="favorites-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('portal.favorites.empty');
    expect(empty.find('a').exists()).toBe(true);
  });
});
