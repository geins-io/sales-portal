import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { mountComponent } from '../../utils/component';

// Mock useFetch — returns reactive refs
const mockData = ref<{
  orders: Array<Record<string, unknown>>;
  total: number;
} | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);
const mockRefresh = vi.fn();

const useFetchMock = vi.fn(
  (_url: string, _options?: Record<string, unknown>) => ({
    data: mockData,
    pending: mockPending,
    error: mockError,
    refresh: mockRefresh,
  }),
);

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof useFetchMock>) => useFetchMock(...args),
}));

vi.stubGlobal('useFetch', useFetchMock);
vi.stubGlobal('definePageMeta', vi.fn());

// Import AFTER mocks are set up
const { default: OrdersPage } =
  await import('../../../app/pages/portal/orders/index.vue');

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  PortalOrdersTable: {
    name: 'PortalOrdersTable',
    template: '<div data-testid="portal-orders-table"><slot /></div>',
    props: ['orders'],
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

type Wrapper = ReturnType<typeof mountComponent>;

function mountPage(): Wrapper {
  return mountComponent(OrdersPage, { global: { stubs: defaultStubs } });
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    publicId: 'abc-def-123',
    status: 'placed',
    createdAt: '2025-12-22T17:22:00Z',
    orderTotal: {
      sellingPriceIncVat: 17000,
      sellingPriceIncVatFormatted: '17 000 SEK',
    },
    ...overrides,
  };
}

function page(count: number, total: number) {
  return {
    orders: Array.from({ length: count }, (_, i) =>
      makeOrder({ id: i + 1, publicId: `pub-${i}` }),
    ),
    total,
  };
}

/** The options the page reads its rows with. */
function fetchOptions(): Record<string, unknown> {
  const call = useFetchMock.mock.calls.find(([url]) => url === '/api/orders');
  return call?.[1] ?? {};
}

/** The query the page reads its rows with, as it stands now. */
function listQuery(): Record<string, unknown> {
  return (fetchOptions().query as Ref<Record<string, unknown>>).value;
}

/** Types a search and lets the debounce pass. */
async function search(wrapper: Wrapper, term: string) {
  await wrapper.find('[data-testid="orders-search"]').setValue(term);
  await vi.advanceTimersByTimeAsync(300);
}

async function switchMine(wrapper: Wrapper) {
  await wrapper.find('[data-testid="orders-mine"]').trigger('click');
}

function pageButtons(wrapper: Wrapper) {
  return wrapper.findAll('[data-testid="orders-pagination"] button');
}

describe('Orders page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFetchMock.mockClear();
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('page structure', () => {
    it('renders inside PortalShell', () => {
      mockData.value = { orders: [], total: 0 };
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });
  });

  describe('the read', () => {
    it("reads the first 20 of the company's orders", () => {
      mockData.value = page(20, 103);
      mountPage();

      expect(listQuery()).toEqual({ skip: 0, take: 20 });
    });

    // The query changes with page, search and mine: the newest read wins.
    it('lets the newest read win', () => {
      mountPage();

      expect(fetchOptions().dedupe).toBe('cancel');
    });

    it('shows the rows the server answered, as it answered them', () => {
      mockData.value = {
        orders: [makeOrder({ id: 9 }), makeOrder({ id: 3 })],
        total: 2,
      };
      const wrapper = mountPage();

      const table = wrapper.findComponent({ name: 'PortalOrdersTable' });
      expect(
        (table.props('orders') as Array<{ id: number }>).map(({ id }) => id),
      ).toEqual([9, 3]);
    });

    it('offers no newest/oldest order: the table gets no sort', () => {
      mockData.value = page(2, 2);
      const wrapper = mountPage();

      const table = wrapper.findComponent({ name: 'PortalOrdersTable' });
      expect(table.attributes()).not.toHaveProperty('sort-direction');
      expect(wrapper.find('[data-testid="sort-created"]').exists()).toBe(false);
    });
  });

  describe('loading state', () => {
    it('shows loading state when pending is true', () => {
      mockPending.value = true;
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="orders-loading"]').exists()).toBe(
        true,
      );
    });

    it('does not show table when loading', () => {
      mockPending.value = true;
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
        false,
      );
    });

    it('keeps the rows on screen while the next page reads', () => {
      mockData.value = page(20, 103);
      mockPending.value = true;
      const wrapper = mountPage();

      expect(wrapper.find('[data-testid="orders-loading"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
        true,
      );
    });
  });

  describe('error state', () => {
    it('shows error state on fetch failure', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="orders-error"]').exists()).toBe(true);
    });

    it('shows retry button on error', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="orders-retry"]').exists()).toBe(true);
    });

    it('calls refresh on retry button click', async () => {
      mockError.value = new Error('Network error');
      const wrapper = mountPage();
      await wrapper.find('[data-testid="orders-retry"]').trigger('click');
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no orders returned', () => {
      mockData.value = { orders: [], total: 0 };
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="orders-empty"]').exists()).toBe(true);
    });
  });

  describe('search', () => {
    it('searches the order number on the server once the typing stops', async () => {
      mockData.value = page(20, 103);
      const wrapper = mountPage();

      await wrapper.find('[data-testid="orders-search"]').setValue('121');
      await vi.advanceTimersByTimeAsync(299);
      expect(listQuery()).not.toHaveProperty('search');
      await vi.advanceTimersByTimeAsync(1);

      expect(listQuery()).toEqual({ search: '121', skip: 0, take: 20 });
    });

    it('sends the search trimmed', async () => {
      const wrapper = mountPage();

      await search(wrapper, '  1213 ');

      expect(listQuery().search).toBe('1213');
    });

    it('counts a blank search as no search', async () => {
      const wrapper = mountPage();

      await search(wrapper, '   ');

      expect(listQuery()).not.toHaveProperty('search');
    });

    it('takes no more than the server reads', () => {
      const wrapper = mountPage();

      expect(
        wrapper.find('[data-testid="orders-search"]').attributes('maxlength'),
      ).toBe('50');
    });

    it('says in the field that it searches the order number', () => {
      const wrapper = mountPage();
      const input = wrapper.find('[data-testid="orders-search"]');

      expect(input.attributes('placeholder')).toBe(
        'portal.orders.search_placeholder',
      );
      expect(input.attributes('aria-label')).toBe(
        'portal.orders.search_placeholder',
      );
    });

    it('goes back to page 1 when the search changes', async () => {
      mockData.value = page(20, 103);
      const wrapper = mountPage();
      await wrapper.find('[data-testid="orders-next"]').trigger('click');
      expect(listQuery().skip).toBe(20);

      await search(wrapper, '12');

      expect(listQuery()).toMatchObject({ search: '12', skip: 0 });
    });
  });

  describe('Visa bara mina', () => {
    it("is off at first, so the list reads the company's orders", () => {
      const wrapper = mountPage();
      const mine = wrapper.find('[data-testid="orders-mine"]');

      expect(mine.attributes('aria-checked')).toBe('false');
      expect(listQuery()).not.toHaveProperty('mine');
    });

    it("reads the buyer's own orders when switched on, and the company's when off again", async () => {
      const wrapper = mountPage();

      await switchMine(wrapper);
      expect(listQuery()).toEqual({ mine: true, skip: 0, take: 20 });
      expect(
        wrapper.find('[data-testid="orders-mine"]').attributes('aria-checked'),
      ).toBe('true');

      await switchMine(wrapper);
      expect(listQuery()).not.toHaveProperty('mine');
    });

    it('is named by its label', () => {
      const wrapper = mountPage();
      const id = wrapper.find('[data-testid="orders-mine"]').attributes('id');

      expect(id).toBeTruthy();
      expect(wrapper.find(`label[for="${id}"]`).text()).toBe(
        'portal.orders.only_mine',
      );
    });

    it('sits under the heading and its subtitle, apart from the search', () => {
      const wrapper = mountPage();
      const heading = wrapper.find('[data-testid="orders-heading"]');

      const parts = heading.element.children;
      expect(parts[0]!.tagName).toBe('H2');
      expect(parts[1]!.textContent?.trim()).toBe('portal.orders.subtitle');
      expect(
        parts[2]!.querySelector('[data-testid="orders-mine"]'),
      ).not.toBeNull();
      expect(heading.find('[data-testid="orders-search"]').exists()).toBe(
        false,
      );
    });

    it('goes back to page 1 and keeps the search', async () => {
      mockData.value = page(20, 103);
      const wrapper = mountPage();
      await search(wrapper, '12');
      await wrapper.find('[data-testid="orders-next"]').trigger('click');
      expect(listQuery().skip).toBe(20);

      await switchMine(wrapper);

      expect(listQuery()).toEqual({
        mine: true,
        search: '12',
        skip: 0,
        take: 20,
      });
    });
  });

  describe('pagination', () => {
    it('pages by the count of every order, not by the rows on the page', () => {
      mockData.value = page(20, 103);
      const wrapper = mountPage();

      expect(wrapper.find('[data-testid="orders-pagination"]').exists()).toBe(
        true,
      );
      // 103 orders are six pages: the last page's button is there.
      const pages = pageButtons(wrapper).map((button) => button.text());
      expect(pages).toContain('6');
      expect(pages).not.toContain('7');
    });

    it('reads the next page from the server', async () => {
      mockData.value = page(20, 103);
      const wrapper = mountPage();

      await wrapper.find('[data-testid="orders-next"]').trigger('click');

      expect(listQuery()).toEqual({ skip: 20, take: 20 });
    });

    it('reads a page by its number', async () => {
      mockData.value = page(20, 103);
      const wrapper = mountPage();

      const last = pageButtons(wrapper).find(
        (button) => button.text() === '6',
      )!;
      await last.trigger('click');

      expect(listQuery()).toEqual({ skip: 100, take: 20 });
    });

    it('goes no further than the last page', async () => {
      mockData.value = page(20, 25);
      const wrapper = mountPage();

      await wrapper.find('[data-testid="orders-next"]').trigger('click');
      expect(
        wrapper.find('[data-testid="orders-next"]').attributes('disabled'),
      ).toBeDefined();
      await wrapper.find('[data-testid="orders-next"]').trigger('click');

      expect(listQuery().skip).toBe(20);
    });

    it('previous button is disabled on first page', () => {
      mockData.value = page(20, 25);
      const wrapper = mountPage();
      const prevBtn = wrapper.find('[data-testid="orders-previous"]');
      expect(prevBtn.exists()).toBe(true);
      expect(prevBtn.attributes('disabled')).toBeDefined();
    });

    it('counts the orders shown so far against the count of every order', async () => {
      mockData.value = page(20, 25);
      const wrapper = mountPage();
      const summary = () =>
        wrapper.find('[data-testid="orders-showing-count"]');

      expect(summary().attributes()).toMatchObject({
        'data-shown': '20',
        'data-total': '25',
      });

      await wrapper.find('[data-testid="orders-next"]').trigger('click');
      mockData.value = page(5, 25);
      await wrapper.vm.$nextTick();

      expect(summary().attributes()).toMatchObject({
        'data-shown': '25',
        'data-total': '25',
      });
    });

    it('does not show pagination when orders fit on one page', () => {
      mockData.value = page(20, 20);
      const wrapper = mountPage();
      expect(wrapper.find('[data-testid="orders-pagination"]').exists()).toBe(
        false,
      );
    });
  });
});
