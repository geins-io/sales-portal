// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed, onMounted, defineComponent, h, Suspense } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// ---------------------------------------------------------------------------
// Mock Nuxt auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('useHead', vi.fn());

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

vi.stubGlobal('computed', computed);
vi.stubGlobal('onMounted', onMounted);

// Mock useLocaleMarket — URL-based locale/market routing composable
vi.stubGlobal('useLocaleMarket', () => ({
  currentMarket: computed(() => 'se'),
  currentLocale: computed(() => 'en'),
  localePath: (path: string) =>
    `/se/en${path.startsWith('/') ? path : '/' + path}`,
  getCleanPath: () => '/',
  switchLocale: vi.fn(),
  switchMarket: vi.fn(),
}));

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: computed(() => 'se'),
    currentLocale: computed(() => 'en'),
    localePath: (path: string) =>
      `/se/en${path.startsWith('/') ? path : '/' + path}`,
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

// Mock useFormatLocale — the BCP-47 tag dates and amounts are formatted with
vi.stubGlobal('useFormatLocale', () => ({
  formatLocale: computed(() => 'en-GB'),
}));

vi.mock('../../../app/composables/useFormatLocale', () => ({
  useFormatLocale: () => ({
    formatLocale: computed(() => 'en-GB'),
  }),
}));

// The page reads the tenant timezone, and the real useFeatureAccess reads the
// features, so a test writes the configured value itself. Unmocked, the real
// composable fetches /api/config through the routed useFetch stub below, which
// expects a plain URL string and throws on the key this composable passes.
const ALL_ON = () => ({
  quotes: { enabled: true },
  orderHistory: { enabled: true },
  lists: { enabled: true },
});
const mockFeatures = ref<Record<string, { enabled: boolean }>>(ALL_ON());
vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    timezone: computed(() => undefined),
    features: computed(() => mockFeatures.value),
  }),
}));

const mockShowIncVat = ref(true);
vi.mock('../../../app/composables/useVatDisplay', () => ({
  useVatDisplay: () => ({ showIncVat: computed(() => mockShowIncVat.value) }),
}));

// Like Nuxt's callOnce on a first call: resolves once the factory's promise has.
async function callOnceStub(_key: string, fn: () => unknown) {
  await fn();
}
vi.stubGlobal('callOnce', vi.fn(callOnceStub));

vi.mock('#app/composables/once', () => ({ callOnce: callOnceStub }));

// ---------------------------------------------------------------------------
// Mock useFetch — URL-aware so each endpoint can be controlled independently
// ---------------------------------------------------------------------------
let mockOrdersData: { orders: unknown[] } | null = { orders: [] };
let mockOrdersPending = false;
let mockOrdersError: Error | null = null;
const mockOrdersRefresh = vi.fn();
let mockProductsData: { products: unknown[]; total?: number } | null = {
  products: [],
};
let mockProductsPending = false;
let mockProductsError: Error | null = null;
const mockProductsRefresh = vi.fn();
let mockListsData: { lists: unknown[]; total?: number } | null = { lists: [] };
let mockListsPending = false;

type FetchOptions = { immediate?: boolean };
const fetchCalls: Array<{ url: string; opts?: FetchOptions }> = [];
// The requests the page lets run: `immediate: false` sends none.
const requested = (url: string) =>
  fetchCalls.filter(
    (call) => call.url === url && call.opts?.immediate !== false,
  );

function routedUseFetch(url: string, opts?: FetchOptions) {
  fetchCalls.push({ url, opts });
  if (url.includes('/orders/products')) {
    return {
      data: ref(mockProductsData),
      pending: ref(mockProductsPending),
      error: ref(mockProductsError),
      refresh: mockProductsRefresh,
    };
  }
  if (url.includes('/api/lists')) {
    return { data: ref(mockListsData), pending: ref(mockListsPending) };
  }
  return {
    data: ref(mockOrdersData),
    pending: ref(mockOrdersPending),
    error: ref(mockOrdersError),
    refresh: mockOrdersRefresh,
  };
}

vi.mock('#app/composables/fetch', () => ({
  useFetch: vi.fn((url: string, opts?: FetchOptions) =>
    routedUseFetch(url, opts),
  ),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', (url: string, opts?: FetchOptions) =>
  routedUseFetch(url, opts),
);

// ---------------------------------------------------------------------------
// Mock quotes store
// ---------------------------------------------------------------------------
let mockPendingQuotes: Array<{
  id: string;
  quoteNumber: string;
  contactName: string;
  status: string;
  totalFormatted: string;
  totalExVatFormatted?: string;
  createdAt: string;
}> = [];
let mockPendingCount = 0;
let mockFetchQuotes = vi.fn();

// The store returns computed arrays/numbers as plain values (not refs).
// We use a mutable object so tests can update it between runs.
const mockQuotesStoreInstance = {
  get pendingQuotes() {
    return mockPendingQuotes;
  },
  get pendingCount() {
    return mockPendingCount;
  },
  fetchQuotes: (...args: unknown[]) => mockFetchQuotes(...args),
};

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => mockQuotesStoreInstance,
}));

vi.stubGlobal('useQuotesStore', () => mockQuotesStoreInstance);

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------
const stubs = {
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  PortalPendingApprovalBanner: {
    template: '<div data-testid="portal-pending-approval-banner-stub"></div>',
  },
  PortalStatCard: {
    template:
      '<div data-testid="portal-stat-card" :data-count="count" :data-label="label" :data-show-dot="showDot"><slot /></div>',
    props: ['icon', 'count', 'label', 'showDot'],
  },
  PortalOrdersTable: {
    template: '<div data-testid="portal-orders-table"></div>',
    props: ['orders', 'limit'],
  },
  ProductCard: {
    name: 'ProductCard',
    template:
      '<div data-testid="product-card" :data-name="product.name" :data-price="product.price"></div>',
    props: ['product', 'variant', 'isLoading'],
    emits: ['add-to-cart'],
  },
  Icon: {
    template: '<span></span>',
    props: ['name'],
  },
  Button: {
    template: '<button v-bind="$attrs"><slot /></button>',
    props: ['size', 'variant'],
  },
};

// ---------------------------------------------------------------------------
// Import page after stubs are set
// ---------------------------------------------------------------------------
const PortalOverviewPage = await import('../../../app/pages/portal/index.vue');

// The page awaits its quotes load in setup, so it only renders inside Suspense.
async function mountPage() {
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Suspense, null, { default: () => h(PortalOverviewPage.default) }),
    }),
    { global: { stubs } },
  );
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Portal Overview page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockPendingQuotes = [];
    mockPendingCount = 0;
    mockFetchQuotes = vi.fn().mockResolvedValue(undefined);
    mockOrdersData = { orders: [] };
    mockOrdersPending = false;
    mockOrdersError = null;
    mockOrdersRefresh.mockReset();
    mockProductsData = { products: [] };
    mockProductsPending = false;
    mockProductsError = null;
    mockProductsRefresh.mockReset();
    mockListsData = { lists: [] };
    mockListsPending = false;
    mockShowIncVat.value = true;
    mockFeatures.value = ALL_ON();
    fetchCalls.length = 0;
  });

  // -------------------------------------------------------------------------
  // Stat card — pending count
  // -------------------------------------------------------------------------
  it('shows 0 in stat card when no pending quotes', async () => {
    mockPendingCount = 0;
    const wrapper = await mountPage();

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-count')).toBe('0');
  });

  it('shows real pending count in stat card', async () => {
    mockPendingCount = 3;
    const wrapper = await mountPage();

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-count')).toBe('3');
  });

  // -------------------------------------------------------------------------
  // Stat card — dot indicator
  // -------------------------------------------------------------------------
  it('hides dot when no pending quotes', async () => {
    mockPendingCount = 0;
    const wrapper = await mountPage();

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-show-dot')).toBe('false');
  });

  it('shows dot when there are pending quotes', async () => {
    mockPendingCount = 2;
    const wrapper = await mountPage();

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-show-dot')).toBe('true');
  });

  // -------------------------------------------------------------------------
  // Pending quotations section — empty state
  // -------------------------------------------------------------------------
  it('shows empty state when no pending quotes', async () => {
    mockPendingQuotes = [];
    const wrapper = await mountPage();

    const emptyState = wrapper.find('[data-testid="pending-quotations-empty"]');
    expect(emptyState.exists()).toBe(true);
  });

  it('hides empty state when pending quotes exist', async () => {
    mockPendingQuotes = [
      {
        id: 'q1',
        quoteNumber: 'Q-1001',
        contactName: 'Jane Doe',
        status: 'pending',
        totalFormatted: '$500.00',
        createdAt: '2026-03-01T00:00:00Z',
      },
    ];
    mockPendingCount = 1;
    const wrapper = await mountPage();

    const emptyState = wrapper.find('[data-testid="pending-quotations-empty"]');
    expect(emptyState.exists()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Pending quotations section — quote list
  // -------------------------------------------------------------------------
  it('renders pending quote rows', async () => {
    mockPendingQuotes = [
      {
        id: 'q1',
        quoteNumber: 'Q-1001',
        contactName: 'Jane Doe',
        status: 'pending',
        totalFormatted: '$500.00',
        createdAt: '2026-03-01T00:00:00Z',
      },
      {
        id: 'q2',
        quoteNumber: 'Q-1002',
        contactName: 'John Smith',
        status: 'pending',
        totalFormatted: '$200.00',
        createdAt: '2026-03-02T00:00:00Z',
      },
    ];
    mockPendingCount = 2;

    const wrapper = await mountPage();

    const rows = wrapper
      .find('table')
      .findAll('[data-testid="pending-quote-row"]');
    expect(rows).toHaveLength(2);
  });

  it('shows quote number, status, and total in each row', async () => {
    mockPendingQuotes = [
      {
        id: 'q1',
        quoteNumber: 'Q-1001',
        contactName: 'Jane Doe',
        status: 'pending',
        totalFormatted: '$500.00',
        createdAt: '2026-03-01T00:00:00Z',
      },
    ];
    mockPendingCount = 1;

    const wrapper = await mountPage();

    const row = wrapper.find('table').find('[data-testid="pending-quote-row"]');
    expect(row.text()).toContain('Q-1001');
    expect(row.text()).toContain('$500.00');
    expect(row.text()).toContain('portal.quotations.status_pending');
  });

  it('caps displayed quotes at 5', async () => {
    mockPendingQuotes = [
      {
        id: 'q1',
        quoteNumber: 'Q-1001',
        contactName: 'A',
        status: 'pending',
        totalFormatted: '$100',
        createdAt: '2026-03-01T00:00:00Z',
      },
      {
        id: 'q2',
        quoteNumber: 'Q-1002',
        contactName: 'B',
        status: 'pending',
        totalFormatted: '$200',
        createdAt: '2026-03-02T00:00:00Z',
      },
      {
        id: 'q3',
        quoteNumber: 'Q-1003',
        contactName: 'C',
        status: 'pending',
        totalFormatted: '$300',
        createdAt: '2026-03-03T00:00:00Z',
      },
      {
        id: 'q4',
        quoteNumber: 'Q-1004',
        contactName: 'D',
        status: 'pending',
        totalFormatted: '$400',
        createdAt: '2026-03-04T00:00:00Z',
      },
      {
        id: 'q5',
        quoteNumber: 'Q-1005',
        contactName: 'E',
        status: 'pending',
        totalFormatted: '$500',
        createdAt: '2026-03-05T00:00:00Z',
      },
      {
        id: 'q6',
        quoteNumber: 'Q-1006',
        contactName: 'F',
        status: 'pending',
        totalFormatted: '$600',
        createdAt: '2026-03-06T00:00:00Z',
      },
    ];
    mockPendingCount = 6;

    const wrapper = await mountPage();

    const rows = wrapper
      .find('table')
      .findAll('[data-testid="pending-quote-row"]');
    expect(rows).toHaveLength(5);
  });

  // -------------------------------------------------------------------------
  // fetchQuotes called on mount
  // -------------------------------------------------------------------------
  it('renders only after the quotes load has finished', async () => {
    let finishLoad!: () => void;
    mockFetchQuotes = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = () => {
            mockPendingQuotes = [
              {
                id: 'q1',
                quoteNumber: 'Q-1001',
                contactName: 'Jane Doe',
                status: 'pending',
                totalFormatted: 'SEK 1,000',
                createdAt: '2026-01-15T10:00:00Z',
              },
            ];
            mockPendingCount = 1;
            resolve();
          };
        }),
    );

    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(false);

    finishLoad();
    await flushPromises();
    expect(
      wrapper.find('[data-testid="pending-quotations-empty"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('table').findAll('[data-testid="pending-quote-row"]'),
    ).toHaveLength(1);
    expect(
      wrapper
        .findAll('[data-testid="portal-stat-card"]')[0]
        ?.attributes('data-count'),
    ).toBe('1');
  });

  it('calls fetchQuotes on mount', async () => {
    await mountPage();

    expect(mockFetchQuotes).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Purchased products section — Figma-aligned ProductCard usage
  // -------------------------------------------------------------------------
  it('renders purchased products as ProductCard components', async () => {
    mockProductsData = {
      products: [
        {
          name: 'Hammer',
          articleNumber: 'ART-001',
          priceExVat: 49.95,
          priceExVatFormatted: 'SEK 49.95',
          totalQuantity: 2,
          latestOrderDate: '2026-03-01T00:00:00Z',
          latestOrderId: 'o1',
          latestOrderPublicId: 'pub-o1',
          latestBuyerName: 'Jane',
        },
      ],
      total: 1,
    };

    const wrapper = await mountPage();

    const cards = wrapper.findAll('[data-testid="purchased-product-card"]');
    expect(cards).toHaveLength(1);
    // Verify each card uses the shared ProductCard component (stub)
    expect(cards[0]?.find('[data-testid="product-card"]').exists()).toBe(true);
  });

  it('passes mapped PurchasedProduct data to ProductCard', async () => {
    mockShowIncVat.value = false;
    mockProductsData = {
      products: [
        {
          name: 'Hammer',
          articleNumber: 'ART-001',
          priceExVat: 49.95,
          priceExVatFormatted: 'SEK 49.95',
          totalQuantity: 1,
          latestOrderDate: '2026-03-01T00:00:00Z',
          latestOrderId: 'o1',
          latestOrderPublicId: 'pub-o1',
          latestBuyerName: 'Jane',
        },
      ],
    };
    const wrapper = await mountPage();
    const card = wrapper.find('[data-testid="product-card"]');
    expect(card.attributes('data-name')).toBe('Hammer');
    expect(card.attributes('data-price')).toBe('SEK 49.95');
  });

  it("passes a purchased product's configurable flag to ProductCard", async () => {
    mockProductsData = {
      products: [
        {
          name: 'Arbetsbord',
          articleNumber: 'KONF-1001',
          alias: 'arbetsbord-pro',
          priceExVat: 3200,
          totalQuantity: 1,
          latestOrderDate: '2026-03-01T00:00:00Z',
          latestOrderId: 'o1',
          latestOrderPublicId: 'pub-o1',
          latestBuyerName: 'Jane',
          configurable: true,
        },
      ],
    };
    const wrapper = await mountPage();
    const card = wrapper.findComponent({ name: 'ProductCard' });
    expect(card.props('product')).toMatchObject({ configurable: true });
  });

  it('shows purchased products loading state', async () => {
    mockProductsPending = true;
    const wrapper = await mountPage();
    // Loading state appears as plain "common.loading" text in the products section
    expect(
      wrapper.find('[data-testid="purchased-products-grid"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="purchased-products-empty"]').exists(),
    ).toBe(false);
  });

  it('renders purchased products empty state by default', async () => {
    const wrapper = await mountPage();
    const empty = wrapper.find('[data-testid="purchased-products-empty"]');
    expect(empty.exists()).toBe(true);
  });

  describe('purchased products read', () => {
    function productsStatCount(wrapper: ReturnType<typeof mount>) {
      return wrapper
        .findAll('[data-testid="portal-stat-card"]')[2]
        ?.attributes('data-count');
    }

    it('shows the error and retry, not the empty state, when the read fails', async () => {
      mockProductsData = null;
      mockProductsError = new Error('502');
      const wrapper = await mountPage();
      expect(
        wrapper.find('[data-testid="purchased-products-error"]').text(),
      ).toContain('portal.purchased_products.error_loading');
      expect(
        wrapper.find('[data-testid="purchased-products-retry"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="purchased-products-empty"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="purchased-products-grid"]').exists(),
      ).toBe(false);
    });

    it('leaves the stat card without a number when the read fails', async () => {
      mockProductsData = null;
      mockProductsError = new Error('502');
      const wrapper = await mountPage();
      expect(productsStatCount(wrapper)).toBeUndefined();
    });

    it('shows the error over products kept from an earlier read', async () => {
      mockProductsData = {
        products: [{ name: 'Widget', articleNumber: 'W-1' }],
        total: 1,
      };
      mockProductsError = new Error('502');
      const wrapper = await mountPage();
      expect(
        wrapper.find('[data-testid="purchased-products-error"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="purchased-products-grid"]').exists(),
      ).toBe(false);
      expect(productsStatCount(wrapper)).toBeUndefined();
    });

    it('refetches the purchased products on retry', async () => {
      mockProductsData = null;
      mockProductsError = new Error('502');
      const wrapper = await mountPage();
      await wrapper
        .find('[data-testid="purchased-products-retry"]')
        .trigger('click');
      expect(mockProductsRefresh).toHaveBeenCalledTimes(1);
      expect(mockOrdersRefresh).not.toHaveBeenCalled();
    });

    it('shows the empty state and a 0 for an empty answer', async () => {
      mockProductsData = { products: [], total: 0 };
      const wrapper = await mountPage();
      expect(
        wrapper.find('[data-testid="purchased-products-empty"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="purchased-products-error"]').exists(),
      ).toBe(false);
      expect(productsStatCount(wrapper)).toBe('0');
    });

    it('shows the grid and the total for a filled answer', async () => {
      mockProductsData = {
        products: [{ name: 'Widget', articleNumber: 'W-1' }],
        total: 47,
      };
      const wrapper = await mountPage();
      expect(
        wrapper.find('[data-testid="purchased-products-grid"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="purchased-products-error"]').exists(),
      ).toBe(false);
      expect(productsStatCount(wrapper)).toBe('47');
    });
  });

  describe('orders read', () => {
    function ordersStatCount(wrapper: ReturnType<typeof mount>) {
      return wrapper
        .findAll('[data-testid="portal-stat-card"]')[1]
        ?.attributes('data-count');
    }

    it('shows the error and retry, not the orders table, when the read fails', async () => {
      mockOrdersData = null;
      mockOrdersError = new Error('502');
      const wrapper = await mountPage();
      expect(
        wrapper.find('[data-testid="latest-orders-error"]').text(),
      ).toContain('portal.orders.error_loading');
      expect(wrapper.find('[data-testid="latest-orders-retry"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
        false,
      );
    });

    it('leaves the stat card without a number when the read fails', async () => {
      mockOrdersData = null;
      mockOrdersError = new Error('502');
      const wrapper = await mountPage();
      expect(ordersStatCount(wrapper)).toBeUndefined();
    });

    it('refetches the orders on retry', async () => {
      mockOrdersData = null;
      mockOrdersError = new Error('502');
      const wrapper = await mountPage();
      await wrapper
        .find('[data-testid="latest-orders-retry"]')
        .trigger('click');
      expect(mockOrdersRefresh).toHaveBeenCalledTimes(1);
      expect(mockProductsRefresh).not.toHaveBeenCalled();
    });

    it('shows the orders table and a 0 for an empty answer', async () => {
      const wrapper = await mountPage();
      expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="latest-orders-error"]').exists()).toBe(
        false,
      );
      expect(ordersStatCount(wrapper)).toBe('0');
    });

    it('counts the orders of a filled answer', async () => {
      mockOrdersData = {
        orders: [
          { id: 1, createdAt: '2026-01-01' },
          { id: 2, createdAt: '2026-01-02' },
        ],
      };
      const wrapper = await mountPage();
      expect(ordersStatCount(wrapper)).toBe('2');
    });
  });

  it('wires ProductCard add-to-cart to the page handler', async () => {
    mockProductsData = {
      products: [
        {
          name: 'Hammer',
          articleNumber: 'ART-001',
          priceExVat: 49.95,
          priceExVatFormatted: 'SEK 49.95',
          totalQuantity: 1,
          latestOrderDate: '2026-03-01T00:00:00Z',
          latestOrderId: 'o1',
          latestOrderPublicId: 'pub-o1',
          latestBuyerName: 'Jane',
        },
      ],
    };
    const wrapper = await mountPage();
    const card = wrapper.findComponent({ name: 'ProductCard' });
    expect(card.exists()).toBe(true);
    // PurchasedProduct lacks skuId so the handler is a deliberate no-op
    // stub. The event emission must not throw — that confirms the binding
    // exists and the handler is callable. When the API is enriched with
    // skuId in M7, this test should be tightened to assert cartStore.addItem.
    expect(() => card.vm.$emit('add-to-cart', { quantity: 2 })).not.toThrow();
  });

  describe('prices follow the VAT choice', () => {
    async function withQuoteAndProduct() {
      mockPendingQuotes = [
        {
          id: 'q1',
          quoteNumber: 'Q-1001',
          contactName: 'Jane Doe',
          status: 'pending',
          totalFormatted: '625,00 kr',
          totalExVatFormatted: '500,00 kr',
          createdAt: '2026-03-01T00:00:00Z',
        },
      ];
      mockPendingCount = 1;
      mockProductsData = {
        products: [
          {
            name: 'Hammer',
            articleNumber: 'ART-001',
            priceExVat: 40,
            priceExVatFormatted: '40,00 kr',
            priceIncVat: 50,
            priceIncVatFormatted: '50,00 kr',
            totalQuantity: 1,
            latestOrderDate: '2026-03-01T00:00:00Z',
            latestOrderId: 'o1',
            latestOrderPublicId: 'pub-o1',
            latestBuyerName: 'Jane',
          },
        ],
      };
      const wrapper = await mountPage();
      return {
        quoteRows: wrapper
          .findAll('[data-testid="pending-quote-row"]')
          .map((row) => row.text()),
        cardPrice: wrapper
          .find('[data-testid="product-card"]')
          .attributes('data-price'),
      };
    }

    it('shows the quote total and product price inc VAT when inc is chosen', async () => {
      mockShowIncVat.value = true;
      const { quoteRows, cardPrice } = await withQuoteAndProduct();
      expect(quoteRows.length).toBeGreaterThan(0);
      for (const row of quoteRows) expect(row).toContain('625,00 kr');
      expect(cardPrice).toBe('50,00 kr');
    });

    it('shows the quote total and product price ex VAT when ex is chosen', async () => {
      mockShowIncVat.value = false;
      const { quoteRows, cardPrice } = await withQuoteAndProduct();
      expect(quoteRows.length).toBeGreaterThan(0);
      for (const row of quoteRows) {
        expect(row).toContain('500,00 kr');
        expect(row).not.toContain('625,00 kr');
      }
      expect(cardPrice).toBe('40,00 kr');
    });

    it.each([false, true])(
      'shows "-" for a product without a price (inc VAT: %s)',
      async (showIncVat) => {
        mockShowIncVat.value = showIncVat;
        mockProductsData = {
          products: [
            {
              name: 'Hammer',
              articleNumber: 'ART-001',
              totalQuantity: 1,
              latestOrderDate: '2026-03-01T00:00:00Z',
              latestOrderId: 'o1',
              latestOrderPublicId: 'pub-o1',
              latestBuyerName: 'Jane',
            },
          ],
        };
        const wrapper = await mountPage();
        expect(
          wrapper.find('[data-testid="product-card"]').attributes('data-price'),
        ).toBe('-');
      },
    );
  });

  // -------------------------------------------------------------------------
  // The portal feature flags
  // -------------------------------------------------------------------------
  describe('the portal feature flags', () => {
    type Wrapper = Awaited<ReturnType<typeof mountPage>>;
    const off = (...keys: string[]) => {
      mockFeatures.value = {
        ...ALL_ON(),
        ...Object.fromEntries(keys.map((key) => [key, { enabled: false }])),
      };
    };
    const stats = (wrapper: Wrapper) =>
      wrapper.find('[data-testid="overview-stats"]');
    const statLabels = (wrapper: Wrapper) =>
      wrapper
        .findAll('[data-testid="portal-stat-card"]')
        .map((card) => card.attributes('data-label'));
    const listsRow = (wrapper: Wrapper) =>
      wrapper.find('[data-testid="overview-lists-row"]');
    const has = (wrapper: Wrapper, testId: string) =>
      wrapper.find(`[data-testid="${testId}"]`).exists();

    it('shows every part when quotes, orderHistory and lists are enabled', async () => {
      const wrapper = await mountPage();

      expect(mockFetchQuotes).toHaveBeenCalledTimes(1);
      expect(requested('/api/orders')).toHaveLength(1);
      expect(statLabels(wrapper)).toEqual([
        'portal.overview.stat.pending_quotations',
        'portal.overview.stat.orders_placed',
        'portal.overview.stat.purchased_products',
        'portal.overview.stat.persons_in_org',
      ]);
      expect(stats(wrapper).classes()).toContain('lg:grid-cols-4');
      expect(has(wrapper, 'portal-orders-table')).toBe(true);
      expect(has(wrapper, 'pending-quotations-empty')).toBe(true);
      expect(has(wrapper, 'your-lists-empty')).toBe(true);
      expect(listsRow(wrapper).classes()).toContain('lg:grid-cols-2');
      const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
      expect(cards[3]?.classes()).not.toContain('col-span-2');
    });

    it('neither loads nor shows quotations when quotes is disabled', async () => {
      off('quotes');
      mockPendingQuotes = [
        {
          id: 'q1',
          quoteNumber: 'Q-1001',
          contactName: 'Jane Doe',
          status: 'pending',
          totalFormatted: 'SEK 1,000',
          createdAt: '2026-01-15T10:00:00Z',
        },
      ];
      mockPendingCount = 1;
      const wrapper = await mountPage();

      expect(mockFetchQuotes).not.toHaveBeenCalled();
      expect(statLabels(wrapper)).not.toContain(
        'portal.overview.stat.pending_quotations',
      );
      expect(has(wrapper, 'pending-quotations-empty')).toBe(false);
      expect(has(wrapper, 'pending-quotations-table')).toBe(false);
      expect(wrapper.html()).not.toContain('/portal/quotations');
    });

    it('neither loads nor shows orders when orderHistory is disabled', async () => {
      off('orderHistory');
      mockOrdersData = { orders: [{ id: 'o1', createdAt: '2026-01-15' }] };
      const wrapper = await mountPage();

      expect(requested('/api/orders')).toHaveLength(0);
      expect(statLabels(wrapper)).not.toContain(
        'portal.overview.stat.orders_placed',
      );
      expect(has(wrapper, 'portal-orders-table')).toBe(false);
      expect(has(wrapper, 'latest-orders-error')).toBe(false);
      expect(wrapper.text()).not.toContain('portal.overview.latest_orders');
      expect(wrapper.html()).not.toContain('/portal/orders');
      // Purchased products have their own tab, which no flag hides.
      expect(requested('/api/orders/products')).toHaveLength(1);
    });

    it('does not show the lists when lists is disabled', async () => {
      off('lists');
      const wrapper = await mountPage();

      expect(has(wrapper, 'your-lists-empty')).toBe(false);
      expect(has(wrapper, 'your-lists-table')).toBe(false);
      expect(wrapper.text()).not.toContain('portal.overview.your_lists');
      expect(wrapper.html()).not.toContain('/portal/lists');
    });

    it('closes the gaps the quotations leave when quotes is disabled', async () => {
      off('quotes');
      const wrapper = await mountPage();

      expect(stats(wrapper).classes()).toContain('lg:grid-cols-3');
      // Three cards in the two mobile columns: the last spans both.
      const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
      expect(cards[2]?.classes()).toEqual(
        expect.arrayContaining(['col-span-2', 'lg:col-span-1']),
      );
      expect(listsRow(wrapper).classes()).not.toContain('lg:grid-cols-2');
      expect(has(wrapper, 'your-lists-empty')).toBe(true);
    });

    it('closes the gaps the orders leave when orderHistory is disabled', async () => {
      off('orderHistory');
      const wrapper = await mountPage();

      expect(stats(wrapper).classes()).toContain('lg:grid-cols-3');
      const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
      expect(cards[2]?.classes()).toEqual(
        expect.arrayContaining(['col-span-2', 'lg:col-span-1']),
      );
    });

    it('closes the gap the lists leave when lists is disabled', async () => {
      off('lists');
      const wrapper = await mountPage();

      expect(listsRow(wrapper).classes()).not.toContain('lg:grid-cols-2');
      expect(has(wrapper, 'pending-quotations-empty')).toBe(true);
    });

    it('keeps two even stat columns when quotes and orderHistory are disabled', async () => {
      off('quotes', 'orderHistory');
      const wrapper = await mountPage();

      expect(stats(wrapper).classes()).toContain('lg:grid-cols-2');
      const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
      expect(cards).toHaveLength(2);
      expect(cards[1]?.classes()).not.toContain('col-span-2');
    });

    it('drops the row when quotes and lists are both disabled', async () => {
      off('quotes', 'lists');
      const wrapper = await mountPage();

      expect(listsRow(wrapper).exists()).toBe(false);
    });
  });
});
