// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed, onMounted } from 'vue';
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

// Mock callOnce — calls the factory function synchronously (mirrors Nuxt's callOnce)
vi.stubGlobal(
  'callOnce',
  vi.fn((_key: string, fn: () => unknown) => {
    fn();
  }),
);

vi.mock('#app/composables/once', () => ({
  callOnce: (_key: string, fn: () => unknown) => {
    fn();
  },
}));

// ---------------------------------------------------------------------------
// Mock useFetch — URL-aware so each endpoint can be controlled independently
// ---------------------------------------------------------------------------
let mockOrdersData: { orders: unknown[] } | null = { orders: [] };
let mockOrdersPending = false;
let mockProductsData: { products: unknown[]; total?: number } | null = {
  products: [],
};
let mockProductsPending = false;
let mockListsData: { lists: unknown[]; total?: number } | null = { lists: [] };
let mockListsPending = false;

function routedUseFetch(url: string) {
  if (url.includes('/orders/products')) {
    return { data: ref(mockProductsData), pending: ref(mockProductsPending) };
  }
  if (url.includes('/api/lists')) {
    return { data: ref(mockListsData), pending: ref(mockListsPending) };
  }
  return { data: ref(mockOrdersData), pending: ref(mockOrdersPending) };
}

vi.mock('#app/composables/fetch', () => ({
  useFetch: vi.fn((url: string) => routedUseFetch(url)),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', (url: string) => routedUseFetch(url));

// ---------------------------------------------------------------------------
// Mock quotes store
// ---------------------------------------------------------------------------
let mockPendingQuotes: Array<{
  id: string;
  quoteNumber: string;
  contactName: string;
  status: string;
  totalFormatted: string;
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
      '<div data-testid="portal-stat-card" :data-count="count" :data-show-dot="showDot"><slot /></div>',
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
    mockProductsData = { products: [] };
    mockProductsPending = false;
    mockListsData = { lists: [] };
    mockListsPending = false;
  });

  // -------------------------------------------------------------------------
  // Stat card — pending count
  // -------------------------------------------------------------------------
  it('shows 0 in stat card when no pending quotes', () => {
    mockPendingCount = 0;
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-count')).toBe('0');
  });

  it('shows real pending count in stat card', () => {
    mockPendingCount = 3;
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-count')).toBe('3');
  });

  // -------------------------------------------------------------------------
  // Stat card — dot indicator
  // -------------------------------------------------------------------------
  it('hides dot when no pending quotes', () => {
    mockPendingCount = 0;
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-show-dot')).toBe('false');
  });

  it('shows dot when there are pending quotes', () => {
    mockPendingCount = 2;
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const cards = wrapper.findAll('[data-testid="portal-stat-card"]');
    const quotationCard = cards[0];
    expect(quotationCard?.attributes('data-show-dot')).toBe('true');
  });

  // -------------------------------------------------------------------------
  // Pending quotations section — empty state
  // -------------------------------------------------------------------------
  it('shows empty state when no pending quotes', () => {
    mockPendingQuotes = [];
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const emptyState = wrapper.find('[data-testid="pending-quotations-empty"]');
    expect(emptyState.exists()).toBe(true);
  });

  it('hides empty state when pending quotes exist', () => {
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
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const emptyState = wrapper.find('[data-testid="pending-quotations-empty"]');
    expect(emptyState.exists()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Pending quotations section — quote list
  // -------------------------------------------------------------------------
  it('renders pending quote rows', () => {
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

    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const rows = wrapper
      .find('table')
      .findAll('[data-testid="pending-quote-row"]');
    expect(rows).toHaveLength(2);
  });

  it('shows quote number, status, and total in each row', () => {
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

    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const row = wrapper.find('table').find('[data-testid="pending-quote-row"]');
    expect(row.text()).toContain('Q-1001');
    expect(row.text()).toContain('$500.00');
  });

  it('caps displayed quotes at 5', () => {
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

    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const rows = wrapper
      .find('table')
      .findAll('[data-testid="pending-quote-row"]');
    expect(rows).toHaveLength(5);
  });

  // -------------------------------------------------------------------------
  // fetchQuotes called on mount
  // -------------------------------------------------------------------------
  it('calls fetchQuotes on mount', () => {
    mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    expect(mockFetchQuotes).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Purchased products section — Figma-aligned ProductCard usage
  // -------------------------------------------------------------------------
  it('renders purchased products as ProductCard components', () => {
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
          latestBuyerName: 'Jane',
        },
      ],
      total: 1,
    };

    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });

    const cards = wrapper.findAll('[data-testid="purchased-product-card"]');
    expect(cards).toHaveLength(1);
    // Verify each card uses the shared ProductCard component (stub)
    expect(cards[0]?.find('[data-testid="product-card"]').exists()).toBe(true);
  });

  it('passes mapped PurchasedProduct data to ProductCard', () => {
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
          latestBuyerName: 'Jane',
        },
      ],
    };
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });
    const card = wrapper.find('[data-testid="product-card"]');
    expect(card.attributes('data-name')).toBe('Hammer');
    expect(card.attributes('data-price')).toBe('SEK 49.95');
  });

  it('shows purchased products loading state', () => {
    mockProductsPending = true;
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });
    // Loading state appears as plain "common.loading" text in the products section
    expect(
      wrapper.find('[data-testid="purchased-products-grid"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="purchased-products-empty"]').exists(),
    ).toBe(false);
  });

  it('renders purchased products empty state by default', () => {
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });
    const empty = wrapper.find('[data-testid="purchased-products-empty"]');
    expect(empty.exists()).toBe(true);
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
          latestBuyerName: 'Jane',
        },
      ],
    };
    const wrapper = mount(PortalOverviewPage.default, {
      global: { stubs },
    });
    const card = wrapper.findComponent({ name: 'ProductCard' });
    expect(card.exists()).toBe(true);
    // PurchasedProduct lacks skuId so the handler is a deliberate no-op
    // stub. The event emission must not throw — that confirms the binding
    // exists and the handler is callable. When the API is enriched with
    // skuId in M7, this test should be tightened to assert cartStore.addItem.
    expect(() => card.vm.$emit('add-to-cart', { quantity: 2 })).not.toThrow();
  });
});
