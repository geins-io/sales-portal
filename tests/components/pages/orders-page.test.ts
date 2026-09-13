import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// The waiting poll calls `$fetch` directly rather than `refresh()`, so it is
// mocked separately from useFetch. `mockQuery` drives `?awaiting=`.
const mockQuery = ref<Record<string, string>>({});
const mockPollFetch = vi.fn();
const mockReplace = vi.fn(() => Promise.resolve());

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof useFetchMock>) => useFetchMock(...args),
  $fetch: (...args: unknown[]) => mockPollFetch(...args),
}));

// `useRoute` resolves through this module (tests/setup-components.ts), so the
// `?awaiting=` parameter has to be driven here rather than through a global.
vi.mock('#app/composables/router', () => ({
  useRoute: () => ({ query: mockQuery.value }),
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  navigateTo: vi.fn(),
}));

vi.stubGlobal('useFetch', useFetchMock);
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('$fetch', (...args: unknown[]) => mockPollFetch(...args));

// Import AFTER mocks are set up
const { default: OrdersPage } =
  await import('../../../app/pages/portal/orders/index.vue');

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
    mockQuery.value = {};
    mockPollFetch.mockReset();
    mockReplace.mockClear();
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

/**
 * Waiting for a just-placed order.
 *
 * A freshly placed order is not readable for several seconds, so the
 * confirmation link carries `?awaiting=<publicId>` and this page refetches in
 * the background until it appears. The wait is silent — nothing is rendered for
 * it — so these cases assert the mechanism: how many background calls happen,
 * whether they carry the cache bypass, and when they stop.
 *
 * The four cases are the whole contract: no id means no polling at all, an
 * order already present means no polling either, an order that arrives stops
 * the polling and clears the parameter, and the bound stops it as well.
 */
describe('Orders page — awaiting a just-placed order', () => {
  const AWAITED = 'new-order-public-id';

  function listWith(...orders: ReturnType<typeof makeOrder>[]) {
    return { orders, total: orders.length };
  }

  function mount() {
    return mountComponent(OrdersPage, { global: { stubs: defaultStubs } });
  }

  beforeEach(() => {
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockQuery.value = {};
    mockPollFetch.mockReset();
    mockReplace.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll when the link carries no order id', async () => {
    mockData.value = listWith(makeOrder());
    mount();

    await vi.advanceTimersByTimeAsync(10000);

    expect(mockPollFetch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not poll when the order is already in the first response', async () => {
    mockQuery.value = { awaiting: AWAITED };
    mockData.value = listWith(makeOrder({ publicId: AWAITED }));
    mount();

    await vi.advanceTimersByTimeAsync(10000);

    // Not one background call, and the parameter is left alone: an order that
    // was already there was never waited for.
    expect(mockPollFetch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('polls until the order arrives, then stops and clears the parameter', async () => {
    mockQuery.value = { awaiting: AWAITED };
    mockData.value = listWith(makeOrder({ publicId: 'some-older-order' }));
    const wrapper = mount();
    await wrapper.vm.$nextTick();

    // Two ticks that do not find it, so "it stopped" below means the order
    // stopped it rather than it never having started.
    mockPollFetch.mockResolvedValue(
      listWith(makeOrder({ publicId: 'some-older-order' })),
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockPollFetch.mock.calls.length).toBe(2);

    // The cache is the reason this poll exists at all, so every call must carry
    // the bypass: without it the browser would serve the same order-less list
    // from its own cache for up to thirty seconds.
    for (const call of mockPollFetch.mock.calls) {
      expect(call).toEqual(['/api/orders', { cache: 'no-store' }]);
    }

    mockPollFetch.mockResolvedValue(
      listWith(
        makeOrder({ publicId: 'some-older-order' }),
        makeOrder({ publicId: AWAITED }),
      ),
    );
    await vi.advanceTimersByTimeAsync(2500);
    await wrapper.vm.$nextTick();

    expect(mockData.value?.orders).toHaveLength(2);
    expect(mockReplace).toHaveBeenCalledWith({ query: {} });

    const callsWhenFound = mockPollFetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20000);
    expect(mockPollFetch.mock.calls.length).toBe(callsWhenFound);
  });

  it('stops at the bound and clears the parameter so a reload starts no new wait', async () => {
    mockQuery.value = { awaiting: AWAITED };
    const withoutIt = listWith(makeOrder({ publicId: 'some-older-order' }));
    mockData.value = withoutIt;
    mockPollFetch.mockResolvedValue(withoutIt);
    const wrapper = mount();
    await wrapper.vm.$nextTick();

    // Just short of the 120s bound it is still going.
    await vi.advanceTimersByTimeAsync(110000);
    expect(mockPollFetch.mock.calls.length).toBeGreaterThan(0);
    expect(mockReplace).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20000);
    await wrapper.vm.$nextTick();

    expect(mockReplace).toHaveBeenCalledWith({ query: {} });

    const callsAtBound = mockPollFetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockPollFetch.mock.calls.length).toBe(callsAtBound);
  });
});
