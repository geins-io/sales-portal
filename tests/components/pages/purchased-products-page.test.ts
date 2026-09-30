import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mountComponent } from '../../utils/component';

// Mock useFetch — returns reactive refs
const mockData = ref<{
  products: Array<Record<string, unknown>>;
  total: number;
} | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);
const mockRefresh = vi.fn();

const useFetchMock = vi.fn(() => ({
  data: mockData,
  pending: mockPending,
  error: mockError,
  refresh: mockRefresh,
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof useFetchMock>) => useFetchMock(...args),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', useFetchMock);
vi.stubGlobal('definePageMeta', vi.fn());

// Import AFTER mocks are set up
const { default: ProductsPage } =
  await import('../../../app/pages/portal/products.vue');

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  PortalProductsTable: {
    template: '<div data-testid="portal-products-table"><slot /></div>',
    props: ['products', 'sortColumn', 'sortDirection'],
    emits: ['sort'],
  },
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  Icon: {
    template: '<span class="icon" :data-name="name" />',
    props: ['name'],
  },
  NuxtIcon: {
    template: '<span class="icon" :data-name="name" />',
    props: ['name'],
  },
};

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Widget Pro',
    articleNumber: 'ART-001',
    priceExVat: 150,
    priceExVatFormatted: '150,00 SEK',
    totalQuantity: 42,
    latestOrderDate: '2025-12-22T17:22:00Z',
    latestOrderId: '1421',
    latestOrderPublicId: 'order-abc-123',
    latestBuyerName: 'Adam Johnsson',
    ...overrides,
  };
}

describe('Purchased products page', () => {
  beforeEach(() => {
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
  });

  describe('loading state', () => {
    it('shows loading state when pending is true', () => {
      mockPending.value = true;
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="products-loading"]').exists()).toBe(
        true,
      );
    });

    it('does not show table when loading', () => {
      mockPending.value = true;
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="portal-products-table"]').exists(),
      ).toBe(false);
    });
  });

  describe('error state', () => {
    it('shows error state on fetch failure', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="products-error"]').exists()).toBe(
        true,
      );
    });

    it('shows retry button on error', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="products-retry"]').exists()).toBe(
        true,
      );
    });

    it('calls refresh on retry button click', async () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="products-retry"]').trigger('click');
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no products returned', () => {
      mockData.value = { products: [], total: 0 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="products-empty"]').exists()).toBe(
        true,
      );
    });
  });

  describe('table rendering', () => {
    it('renders the products table with data', () => {
      mockData.value = { products: [makeProduct()], total: 1 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="portal-products-table"]').exists(),
      ).toBe(true);
    });
  });

  describe('search filtering', () => {
    it('has a search input', () => {
      mockData.value = { products: [makeProduct()], total: 1 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="products-search"]');
      expect(input.exists()).toBe(true);
    });

    it('filters by product name (case-insensitive)', async () => {
      mockData.value = {
        products: [
          makeProduct({ name: 'Widget Pro', articleNumber: 'ART-001' }),
          makeProduct({ name: 'Gadget Mini', articleNumber: 'ART-002' }),
        ],
        total: 2,
      };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="products-search"]');
      await input.setValue('nonexistent-xyz-nothing');
      await nextTick();
      // When nothing matches, table is hidden and empty state appears
      expect(
        wrapper.find('[data-testid="portal-products-table"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="products-empty"]').exists()).toBe(
        true,
      );
      // Now search for a valid product name
      await input.setValue('widget');
      await nextTick();
      expect(
        wrapper.find('[data-testid="portal-products-table"]').exists(),
      ).toBe(true);
    });

    it('filters by article number (case-insensitive)', async () => {
      mockData.value = {
        products: [
          makeProduct({ name: 'Widget Pro', articleNumber: 'ART-001' }),
          makeProduct({ name: 'Gadget Mini', articleNumber: 'ART-002' }),
        ],
        total: 2,
      };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="products-search"]');
      // Search for article number that does not exist
      await input.setValue('ART-999');
      await nextTick();
      expect(
        wrapper.find('[data-testid="portal-products-table"]').exists(),
      ).toBe(false);
      // Now search for an existing article number
      await input.setValue('art-002');
      await nextTick();
      expect(
        wrapper.find('[data-testid="portal-products-table"]').exists(),
      ).toBe(true);
    });

    it('shows empty search state when search matches nothing', async () => {
      mockData.value = {
        products: [makeProduct()],
        total: 1,
      };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="products-search"]');
      await input.setValue('nonexistent-xyz');
      await nextTick();
      expect(wrapper.find('[data-testid="products-empty"]').exists()).toBe(
        true,
      );
    });

    it('resets to page 1 on search change', async () => {
      const products = Array.from({ length: 15 }, (_, i) =>
        makeProduct({ name: `Product ${i}`, articleNumber: `ART-${i}` }),
      );
      mockData.value = { products, total: 15 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      // Go to page 2
      const nextBtn = wrapper.find('[data-testid="products-next"]');
      if (nextBtn.exists()) {
        await nextBtn.trigger('click');
      }
      // Search should reset to page 1 — verify previous button becomes disabled again
      const input = wrapper.find('[data-testid="products-search"]');
      await input.setValue('Product');
      await nextTick();
      const prevBtn = wrapper.find('[data-testid="products-previous"]');
      if (prevBtn.exists()) {
        expect(prevBtn.attributes('disabled')).toBeDefined();
      }
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when products exceed page size', () => {
      const products = Array.from({ length: 15 }, (_, i) =>
        makeProduct({ name: `Product ${i}`, articleNumber: `ART-${i}` }),
      );
      mockData.value = { products, total: 15 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="products-pagination"]').exists()).toBe(
        true,
      );
    });

    it('does not show page navigation when products fit on one page', () => {
      mockData.value = { products: [makeProduct()], total: 1 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="products-previous"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="products-next"]').exists()).toBe(
        false,
      );
    });
  });

  describe('rows per page', () => {
    it('has a rows per page selector', () => {
      mockData.value = { products: [makeProduct()], total: 1 };
      const wrapper = mountComponent(ProductsPage, {
        global: { stubs: defaultStubs },
      });
      const select = wrapper.find('[data-testid="products-page-size"]');
      expect(select.exists()).toBe(true);
    });
  });

  describe('sort', () => {
    // Renders the order the page hands the table, plus one button per column.
    const sortStubs = {
      ...defaultStubs,
      PortalProductsTable: {
        template: `<div data-testid="portal-products-table"
            :data-sort-column="sortColumn" :data-sort-direction="sortDirection">
          <span v-for="p in products" :key="p.articleNumber" data-testid="stub-row">{{ p.articleNumber }}</span>
          <button data-testid="stub-sort-name" @click="$emit('sort', 'name')" />
          <button data-testid="stub-sort-totalQuantity" @click="$emit('sort', 'totalQuantity')" />
          <button data-testid="stub-sort-latestOrderDate" @click="$emit('sort', 'latestOrderDate')" />
        </div>`,
        props: ['products', 'sortColumn', 'sortDirection'],
        emits: ['sort'],
      },
    };

    function mountSorted(products: Array<Record<string, unknown>>) {
      mockData.value = { products, total: products.length };
      return mountComponent(ProductsPage, { global: { stubs: sortStubs } });
    }

    function rowOrder(wrapper: ReturnType<typeof mountSorted>) {
      return wrapper
        .findAll('[data-testid="stub-row"]')
        .map((row) => row.text());
    }

    function sortState(wrapper: ReturnType<typeof mountSorted>) {
      const table = wrapper.find('[data-testid="portal-products-table"]');
      return [
        table.attributes('data-sort-column'),
        table.attributes('data-sort-direction'),
      ];
    }

    async function clickSort(
      wrapper: ReturnType<typeof mountSorted>,
      column: string,
    ) {
      await wrapper
        .find(`[data-testid="stub-sort-${column}"]`)
        .trigger('click');
    }

    // Two products share one order (same timestamp) and one has no date.
    const byDate = [
      makeProduct({
        name: 'Beta',
        articleNumber: 'B',
        latestOrderDate: '2026-09-13T10:00:00Z',
      }),
      makeProduct({ name: 'Undated', articleNumber: 'U', latestOrderDate: '' }),
      makeProduct({
        name: 'Oldest',
        articleNumber: 'O',
        latestOrderDate: '2026-09-10T08:00:00Z',
      }),
      makeProduct({
        name: 'alpha',
        articleNumber: 'A',
        latestOrderDate: '2026-09-13T10:00:00Z',
      }),
      makeProduct({
        name: 'Newest',
        articleNumber: 'N',
        latestOrderDate: '2026-09-28T12:00:00Z',
      }),
    ];

    it('defaults to latest order, newest first, undated last', () => {
      const wrapper = mountSorted(byDate);
      expect(sortState(wrapper)).toEqual(['latestOrderDate', 'desc']);
      expect(rowOrder(wrapper)).toEqual(['N', 'A', 'B', 'O', 'U']);
    });

    it('flips latest order to oldest first, undated still last', async () => {
      const wrapper = mountSorted(byDate);
      await clickSort(wrapper, 'latestOrderDate');
      expect(sortState(wrapper)).toEqual(['latestOrderDate', 'asc']);
      expect(rowOrder(wrapper)).toEqual(['O', 'A', 'B', 'N', 'U']);
    });

    it('treats an unparseable date as no date, undated rows by name', () => {
      const wrapper = mountSorted([
        makeProduct({
          name: 'Zulu',
          articleNumber: 'X',
          latestOrderDate: 'not a date',
        }),
        makeProduct({ name: 'Echo', articleNumber: 'E', latestOrderDate: '' }),
        makeProduct({
          articleNumber: 'D',
          latestOrderDate: '2026-09-10T08:00:00Z',
        }),
      ]);
      expect(rowOrder(wrapper)).toEqual(['D', 'E', 'X']);
    });

    const byQuantity = [
      makeProduct({ name: 'Mid', articleNumber: 'M', totalQuantity: 6 }),
      makeProduct({ name: 'beta', articleNumber: 'B', totalQuantity: 12 }),
      makeProduct({ name: 'Low', articleNumber: 'L', totalQuantity: 1 }),
      makeProduct({ name: 'Alpha', articleNumber: 'A', totalQuantity: 12 }),
    ];

    it('sorts total ordered highest first on the first click', async () => {
      const wrapper = mountSorted(byQuantity);
      await clickSort(wrapper, 'totalQuantity');
      expect(sortState(wrapper)).toEqual(['totalQuantity', 'desc']);
      expect(rowOrder(wrapper)).toEqual(['A', 'B', 'M', 'L']);
    });

    it('sorts total ordered lowest first on the second click, names still ascending', async () => {
      const wrapper = mountSorted(byQuantity);
      await clickSort(wrapper, 'totalQuantity');
      await clickSort(wrapper, 'totalQuantity');
      expect(sortState(wrapper)).toEqual(['totalQuantity', 'asc']);
      expect(rowOrder(wrapper)).toEqual(['L', 'M', 'A', 'B']);
    });

    it('sorts product A to Z on the first click and Z to A on the second', async () => {
      const wrapper = mountSorted(byQuantity);
      await clickSort(wrapper, 'name');
      expect(sortState(wrapper)).toEqual(['name', 'asc']);
      expect(rowOrder(wrapper)).toEqual(['A', 'B', 'L', 'M']);
      await clickSort(wrapper, 'name');
      expect(sortState(wrapper)).toEqual(['name', 'desc']);
      expect(rowOrder(wrapper)).toEqual(['M', 'L', 'B', 'A']);
    });

    it('starts a newly clicked column in its own first direction', async () => {
      const wrapper = mountSorted(byQuantity);
      await clickSort(wrapper, 'name');
      await clickSort(wrapper, 'name');
      await clickSort(wrapper, 'latestOrderDate');
      expect(sortState(wrapper)).toEqual(['latestOrderDate', 'desc']);
    });

    it('returns to page 1 when the active column flips direction', async () => {
      const products = Array.from({ length: 15 }, (_, i) =>
        makeProduct({
          name: `Product ${i}`,
          articleNumber: `ART-${i}`,
          totalQuantity: i,
        }),
      );
      const wrapper = mountSorted(products);
      await clickSort(wrapper, 'totalQuantity');
      await wrapper.find('[data-testid="products-next"]').trigger('click');
      expect(
        wrapper
          .find('[data-testid="products-previous"]')
          .attributes('disabled'),
      ).toBeUndefined();
      await clickSort(wrapper, 'totalQuantity');
      expect(sortState(wrapper)).toEqual(['totalQuantity', 'asc']);
      expect(
        wrapper
          .find('[data-testid="products-previous"]')
          .attributes('disabled'),
      ).toBeDefined();
      expect(rowOrder(wrapper)[0]).toBe('ART-0');
    });

    it('returns to page 1 when the sort changes', async () => {
      const products = Array.from({ length: 15 }, (_, i) =>
        makeProduct({
          name: `Product ${i}`,
          articleNumber: `ART-${i}`,
          totalQuantity: i,
        }),
      );
      const wrapper = mountSorted(products);
      await wrapper.find('[data-testid="products-next"]').trigger('click');
      expect(
        wrapper
          .find('[data-testid="products-previous"]')
          .attributes('disabled'),
      ).toBeUndefined();
      await clickSort(wrapper, 'totalQuantity');
      expect(
        wrapper
          .find('[data-testid="products-previous"]')
          .attributes('disabled'),
      ).toBeDefined();
      expect(rowOrder(wrapper)[0]).toBe('ART-14');
    });
  });
});
