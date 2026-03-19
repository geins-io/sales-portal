import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed, reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { shallowMountComponent } from '../../utils/component';
import FavoritesPage from '../../../app/pages/portal/favorites.vue';

const mockRemove = vi.fn();
const mockClear = vi.fn();
const mockItems = ref<string[]>([]);
const mockCount = computed(() => mockItems.value.length);

// Wrap in reactive() so refs are auto-unwrapped, matching Pinia store behavior
const mockStore = reactive({
  items: mockItems,
  count: mockCount,
  remove: mockRemove,
  clear: mockClear,
  initialize: vi.fn(),
  toggle: vi.fn(),
  add: vi.fn(),
  isFavorite: vi.fn(() => false),
});

vi.mock('../../../app/stores/favorites', () => ({
  useFavoritesStore: () => mockStore,
}));

// Stub definePageMeta — Nuxt macro not available in component tier
vi.stubGlobal('definePageMeta', vi.fn());

// Stub navigateTo
vi.stubGlobal('navigateTo', vi.fn());

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
  },
  UiButton: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
  },
};

function mountFavorites(items: string[] = []) {
  mockItems.value = items;
  return shallowMountComponent(FavoritesPage, {
    global: {
      stubs: defaultStubs,
    },
  });
}

describe('FavoritesPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockItems.value = [];
    mockRemove.mockClear();
    mockClear.mockClear();
  });

  it('renders the favorites page container', () => {
    const wrapper = mountFavorites();
    expect(wrapper.find('[data-testid="favorites-page"]').exists()).toBe(true);
  });

  it('renders empty state when no favorites exist', () => {
    const wrapper = mountFavorites([]);
    expect(wrapper.find('[data-testid="favorites-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="favorites-list"]').exists()).toBe(false);
  });

  it('renders favorites list when items exist', () => {
    const wrapper = mountFavorites(['product-a', 'product-b']);
    expect(wrapper.find('[data-testid="favorites-list"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="favorites-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.findAll('[data-testid="favorite-item"]')).toHaveLength(2);
  });

  it('shows clear all button only when items exist', () => {
    const emptyWrapper = mountFavorites([]);
    expect(
      emptyWrapper.find('[data-testid="favorites-clear-all"]').exists(),
    ).toBe(false);

    const fullWrapper = mountFavorites(['product-a']);
    expect(
      fullWrapper.find('[data-testid="favorites-clear-all"]').exists(),
    ).toBe(true);
  });

  it('calls store.remove with alias when remove button is clicked', async () => {
    const wrapper = mountFavorites(['product-a', 'product-b']);
    const removeButtons = wrapper.findAll('[data-testid="favorite-remove"]');
    await removeButtons[0].trigger('click');
    expect(mockRemove).toHaveBeenCalledWith('product-a');
  });

  it('calls store.clear when clear all button is clicked', async () => {
    const wrapper = mountFavorites(['product-a', 'product-b']);
    await wrapper.find('[data-testid="favorites-clear-all"]').trigger('click');
    expect(mockClear).toHaveBeenCalled();
  });

  it('renders alias as link to /{alias}', () => {
    const wrapper = mountFavorites(['my-product']);
    const link = wrapper.find('[data-testid="favorite-item"] a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/my-product');
  });
});
