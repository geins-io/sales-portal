// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { mockShowIncVat, mockIsCatalogMode } from '../../setup-components';

// The page's own access gate. The shared mock is permissive, so the denied
// branch needs a mock this file controls.
const mockCanAccess = vi.fn<(featureName: string) => boolean>(() => true);
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

// ---------------------------------------------------------------------------
// Favorites store mock. getListById returns a fixed list regardless of the
// route id, so the test does not depend on route-param plumbing.
// ---------------------------------------------------------------------------
const mockList = {
  id: 'list-1',
  name: 'Test list',
  items: ['alpha', 'beta'],
};

// Stands in for the store's stored quantities: reactive, so the page's total
// recomputes the way it does against the real useStorage ref.
const mockQuantities = ref<Record<string, number>>({});

const mockFavoritesStore = {
  getListById: vi.fn(() => mockList),
  getQuantity: vi.fn(
    (_listId: string, alias: string) => mockQuantities.value[alias] ?? 1,
  ),
  setQuantity: vi.fn((_listId: string, alias: string, qty: number) => {
    mockQuantities.value = { ...mockQuantities.value, [alias]: qty };
  }),
  removeItemFromList: vi.fn(),
  renameList: vi.fn(),
  deleteList: vi.fn(),
};

vi.mock('../../../app/stores/favorites', () => ({
  useFavoritesStore: () => mockFavoritesStore,
}));

// ---------------------------------------------------------------------------
// Cart store mock
// ---------------------------------------------------------------------------
const mockCartStore = { addItem: vi.fn(), error: null };

vi.mock('../../../app/stores/cart', () => ({
  useCartStore: () => mockCartStore,
}));

// ---------------------------------------------------------------------------
// useFetch mock. Controls products returned by /api/products/by-aliases.
// Each product carries both inc- and ex-VAT prices so the toggle has data
// to switch between.
// ---------------------------------------------------------------------------
const mockFetchProducts = [
  {
    alias: 'alpha',
    name: 'Product Alpha',
    articleNumber: 'A-1',
    skus: [{ skuId: 11 }],
    unitPrice: {
      sellingPriceIncVat: 1500,
      sellingPriceIncVatFormatted: '1 500 kr',
      sellingPriceExVat: 1200,
      sellingPriceExVatFormatted: '1 200 kr',
    },
  },
  {
    alias: 'beta',
    name: 'Product Beta',
    articleNumber: 'B-2',
    skus: [{ skuId: 22 }],
    unitPrice: {
      sellingPriceIncVat: 730,
      sellingPriceIncVatFormatted: '730 kr',
      sellingPriceExVat: 584,
      sellingPriceExVatFormatted: '584 kr',
    },
  },
];

const useFetchMock = () => ({
  data: ref({ products: mockFetchProducts }),
  pending: ref(false),
  refresh: vi.fn(),
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: useFetchMock,
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', useFetchMock);
vi.stubGlobal('definePageMeta', vi.fn());

// Format a number the same way the page does, so the expected total string
// matches regardless of the test runner's default locale.
function asTotal(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const INC_TOTAL = asTotal(1500 + 730);
const EX_TOTAL = asTotal(1200 + 584);

const stubs = {
  PortalShell: { template: '<div data-testid="portal-shell"><slot /></div>' },
  ClientOnly: { template: '<div><slot /></div>' },
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  Button: { template: '<button><slot /></button>' },
  Input: { template: '<input />' },
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  DialogDescription: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  QuantityStepper: {
    name: 'QuantityStepper',
    template: '<div data-testid="qty-stepper"></div>',
    props: ['modelValue', 'min'],
  },
  ProductThumbnail: {
    template: '<div></div>',
    props: ['fileName', 'alt', 'size', 'radius'],
  },
  StockBadge: { template: '<div></div>', props: ['stock', 'size'] },
  AddToListDialog: { template: '<div></div>', props: ['open', 'productAlias'] },
};

const ListDetailPage =
  await import('../../../app/pages/portal/saved-lists/[id].vue');

function mountPage() {
  return mount(ListDetailPage.default, { global: { stubs } });
}

describe('Saved list detail purchase actions per mode and access', () => {
  // canPurchase is `canAccess('orderPlacement') && !isCatalogMode`, and it
  // gates two separate controls: the bulk add-all button in the toolbar and
  // the per-row add-to-cart. Both are asserted for each half.
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCanAccess.mockReset();
    mockCanAccess.mockReturnValue(true);
  });

  afterEach(() => {
    mockIsCatalogMode.value = false;
  });

  it('renders the add-to-cart controls in commerce mode with orderPlacement access', () => {
    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="add-all-to-cart-btn"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.findAll('[data-testid="list-item-add-to-cart"]'),
    ).toHaveLength(2);
  });

  it('hides the add-to-cart controls when mode is catalog', () => {
    mockIsCatalogMode.value = true;

    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="add-all-to-cart-btn"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.findAll('[data-testid="list-item-add-to-cart"]'),
    ).toHaveLength(0);
  });

  it('hides the add-to-cart controls when orderPlacement access is denied', () => {
    mockCanAccess.mockImplementation(
      (name: string) => name !== 'orderPlacement',
    );

    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="add-all-to-cart-btn"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.findAll('[data-testid="list-item-add-to-cart"]'),
    ).toHaveLength(0);
  });
});

describe('Saved list detail VAT toggle reactivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockShowIncVat.value = true;
  });

  it('renders inc-VAT row prices and list total by default', () => {
    const wrapper = mountPage();
    const rows = wrapper.findAll('[data-testid="list-item-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain('1 500 kr');
    expect(rows[1]!.text()).toContain('730 kr');

    const totalCard = wrapper.find('[data-testid="list-total-card"]');
    expect(totalCard.exists()).toBe(true);
    expect(totalCard.text()).toContain(INC_TOTAL);
  });

  it('switches row prices and list total to ex-VAT when the toggle flips', async () => {
    const wrapper = mountPage();
    expect(wrapper.find('[data-testid="list-total-card"]').text()).toContain(
      INC_TOTAL,
    );

    mockShowIncVat.value = false;
    await nextTick();

    const rows = wrapper.findAll('[data-testid="list-item-row"]');
    expect(rows[0]!.text()).toContain('1 200 kr');
    expect(rows[0]!.text()).not.toContain('1 500 kr');
    expect(rows[1]!.text()).toContain('584 kr');

    const totalCard = wrapper.find('[data-testid="list-total-card"]');
    expect(totalCard.text()).toContain(EX_TOTAL);
    expect(totalCard.text()).not.toContain(INC_TOTAL);
  });
});

describe('Saved list detail quantities', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockShowIncVat.value = true;
    mockCanAccess.mockReturnValue(true);
    mockQuantities.value = {};
    mockCartStore.addItem.mockClear();
  });

  function stepper(wrapper: ReturnType<typeof mountPage>, index: number) {
    return wrapper.findAllComponents({ name: 'QuantityStepper' })[index]!;
  }

  function totalText(wrapper: ReturnType<typeof mountPage>) {
    return wrapper.find('[data-testid="list-total-amount"]').text();
  }

  it('multiplies each row by its stored quantity in the total', () => {
    mockQuantities.value = { alpha: 3 };

    const wrapper = mountPage();

    expect(stepper(wrapper, 0).props('modelValue')).toBe(3);
    expect(totalText(wrapper)).toBe(asTotal(1500 * 3 + 730));
  });

  it('updates the total as the stepper goes up and back down', async () => {
    const wrapper = mountPage();
    expect(totalText(wrapper)).toBe(INC_TOTAL);

    stepper(wrapper, 1).vm.$emit('update:modelValue', 4);
    await nextTick();
    // The route mock carries no params, so only alias and quantity are checked.
    expect(mockFavoritesStore.setQuantity.mock.calls.at(-1)?.slice(1)).toEqual([
      'beta',
      4,
    ]);
    expect(totalText(wrapper)).toBe(asTotal(1500 + 730 * 4));

    stepper(wrapper, 1).vm.$emit('update:modelValue', 2);
    await nextTick();
    expect(totalText(wrapper)).toBe(asTotal(1500 + 730 * 2));
  });

  it('adds every row to the cart with its stored quantity', async () => {
    mockQuantities.value = { alpha: 3 };
    const wrapper = mountPage();

    await wrapper.find('[data-testid="add-all-to-cart-btn"]').trigger('click');
    await nextTick();

    expect(mockCartStore.addItem.mock.calls).toEqual([
      [11, 3],
      [22, 1],
    ]);
  });

  it('adds a single row to the cart with its stored quantity', async () => {
    mockQuantities.value = { beta: 5 };
    const wrapper = mountPage();

    await wrapper
      .findAll('[data-testid="list-item-add-to-cart"]')[1]!
      .trigger('click');

    expect(mockCartStore.addItem).toHaveBeenCalledWith(22, 5);
  });
});
