import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';

// Mock useFetch — returns reactive refs
const mockData = ref<{
  orders: Array<Record<string, unknown>>;
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
  useFetch: (...args: unknown[]) => useFetchMock(...args),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => useFetchMock(...args));
vi.stubGlobal('definePageMeta', vi.fn());

// Import AFTER mocks are set up
const { default: OrdersPage } =
  await import('../../../app/pages/portal/orders.vue');

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  PortalOrdersTable: {
    template: '<div data-testid="portal-orders-table"><slot /></div>',
    props: ['orders', 'sortDirection'],
    emits: ['sort'],
  },
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  Badge: {
    template: '<span v-bind="$attrs"><slot /></span>',
    props: ['variant'],
  },
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    publicId: 'abc-def-123',
    status: 'placed',
    createdAt: '2025-12-22T17:22:00Z',
    billingAddress: { firstName: 'Adam', lastName: 'Johnsson' },
    cart: {
      summary: {
        total: {
          sellingPriceIncVat: 17000,
          sellingPriceIncVatFormatted: '17 000 SEK',
        },
      },
    },
    ...overrides,
  };
}

describe('Orders page', () => {
  beforeEach(() => {
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
  });

  describe('page structure', () => {
    it('renders inside PortalShell', () => {
      mockData.value = { orders: [], total: 0 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });
  });

  describe('loading state', () => {
    it('shows loading state when pending is true', () => {
      mockPending.value = true;
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="orders-loading"]').exists()).toBe(
        true,
      );
    });

    it('does not show table when loading', () => {
      mockPending.value = true;
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
        false,
      );
    });
  });

  describe('error state', () => {
    it('shows error state on fetch failure', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="orders-error"]').exists()).toBe(true);
    });

    it('shows retry button on error', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="orders-retry"]').exists()).toBe(true);
    });

    it('calls refresh on retry button click', async () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="orders-retry"]').trigger('click');
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no orders returned', () => {
      mockData.value = { orders: [], total: 0 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="orders-empty"]').exists()).toBe(true);
    });
  });

  describe('table rendering', () => {
    it('renders the orders table with data', () => {
      mockData.value = { orders: [makeOrder()], total: 1 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
        true,
      );
    });
  });

  describe('search filtering', () => {
    it('has a search input', () => {
      mockData.value = {
        orders: [makeOrder()],
        total: 1,
      };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="orders-search"]');
      expect(input.exists()).toBe(true);
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when orders exceed page size', () => {
      const orders = Array.from({ length: 25 }, (_, i) =>
        makeOrder({ id: i + 1, publicId: `pub-${i}` }),
      );
      mockData.value = { orders, total: 25 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="orders-pagination"]').exists()).toBe(
        true,
      );
    });

    it('shows showing count text', () => {
      const orders = Array.from({ length: 25 }, (_, i) =>
        makeOrder({ id: i + 1, publicId: `pub-${i}` }),
      );
      mockData.value = { orders, total: 25 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="orders-showing-count"]').exists(),
      ).toBe(true);
    });

    it('next button navigates to next page', async () => {
      const orders = Array.from({ length: 25 }, (_, i) =>
        makeOrder({ id: i + 1, publicId: `pub-${i}` }),
      );
      mockData.value = { orders, total: 25 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      const nextBtn = wrapper.find('[data-testid="orders-next"]');
      expect(nextBtn.exists()).toBe(true);
      await nextBtn.trigger('click');
    });

    it('previous button is disabled on first page', () => {
      const orders = Array.from({ length: 25 }, (_, i) =>
        makeOrder({ id: i + 1, publicId: `pub-${i}` }),
      );
      mockData.value = { orders, total: 25 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      const prevBtn = wrapper.find('[data-testid="orders-previous"]');
      expect(prevBtn.exists()).toBe(true);
      expect(prevBtn.attributes('disabled')).toBeDefined();
    });

    it('does not show pagination when orders fit on one page', () => {
      mockData.value = { orders: [makeOrder()], total: 1 };
      const wrapper = mountComponent(OrdersPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="orders-pagination"]').exists()).toBe(
        false,
      );
    });
  });
});
