// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { mockShowIncVat } from '../../setup-components';

// ---------------------------------------------------------------------------
// Favorites store mock. getListById returns a fixed list regardless of the
// route id, so the test does not depend on route-param plumbing.
// ---------------------------------------------------------------------------
const mockList = {
  id: 'list-1',
  name: 'Test list',
  items: ['alpha', 'beta'],
};

const mockFavoritesStore = {
  getListById: vi.fn(() => mockList),
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
  QuantityStepper: { template: '<div></div>', props: ['modelValue', 'min'] },
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
