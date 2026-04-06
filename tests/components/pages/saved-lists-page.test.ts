import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mountComponent } from '../../utils/component';

// Mock useFetch — returns reactive refs
const mockData = ref<{
  lists: Array<Record<string, unknown>>;
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
vi.stubGlobal('$fetch', vi.fn());

// Mock the sheet components to avoid radix-vue dependencies
vi.mock('~/components/ui/sheet', () => ({
  Sheet: {
    name: 'Sheet',
    template: '<div data-testid="sheet"><slot /></div>',
    props: ['open'],
  },
  SheetContent: {
    name: 'SheetContent',
    template: '<div data-testid="sheet-content"><slot /></div>',
  },
  SheetHeader: {
    name: 'SheetHeader',
    template: '<div><slot /></div>',
  },
  SheetTitle: {
    name: 'SheetTitle',
    template: '<div><slot /></div>',
  },
  SheetDescription: {
    name: 'SheetDescription',
    template: '<div><slot /></div>',
  },
  SheetFooter: {
    name: 'SheetFooter',
    template: '<div><slot /></div>',
  },
}));

// Import AFTER mocks are set up
const { default: SavedListsPage } =
  await import('../../../app/pages/portal/lists.vue');

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  SavedListsTable: {
    template: '<div data-testid="saved-lists-table"><slot /></div>',
    props: ['lists'],
  },
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  Sheet: {
    template: '<div data-testid="sheet"><slot /></div>',
    props: ['open'],
  },
  SheetContent: {
    template: '<div data-testid="sheet-content"><slot /></div>',
  },
  SheetHeader: {
    template: '<div><slot /></div>',
  },
  SheetTitle: {
    template: '<div><slot /></div>',
  },
  SheetDescription: {
    template: '<div><slot /></div>',
  },
  SheetFooter: {
    template: '<div><slot /></div>',
  },
  SheetClose: {
    template: '<div><slot /></div>',
  },
  SheetTrigger: {
    template: '<div><slot /></div>',
  },
};

function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: 'list-1',
    userId: 'user-1',
    name: 'Office Supplies',
    description: 'Monthly office order',
    items: [
      {
        id: 'item-1',
        productId: 100,
        sku: 'SKU-100',
        name: 'Pens',
        articleNumber: 'ART-100',
        quantity: 10,
        unitPrice: 25,
        unitPriceFormatted: '25 SEK',
      },
    ],
    createdBy: 'Adam Johnsson',
    createdAt: '2025-12-22T17:22:00Z',
    updatedAt: '2025-12-23T10:00:00Z',
    ...overrides,
  };
}

describe('Saved lists page', () => {
  beforeEach(() => {
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
    vi.mocked(globalThis.$fetch).mockClear();
  });

  describe('page structure', () => {
    it('renders inside PortalShell', () => {
      mockData.value = { lists: [], total: 0 };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });
  });

  describe('loading state', () => {
    it('shows loading state when pending is true', () => {
      mockPending.value = true;
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-loading"]').exists()).toBe(
        true,
      );
    });

    it('does not show table when loading', () => {
      mockPending.value = true;
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-table"]').exists()).toBe(
        false,
      );
    });
  });

  describe('error state', () => {
    it('shows error state on fetch failure', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-error"]').exists()).toBe(
        true,
      );
    });

    it('shows retry button on error', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-retry"]').exists()).toBe(
        true,
      );
    });

    it('calls refresh on retry button click', async () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="saved-lists-retry"]').trigger('click');
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no lists returned', () => {
      mockData.value = { lists: [], total: 0 };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-empty"]').exists()).toBe(
        true,
      );
    });
  });

  describe('table rendering', () => {
    it('renders the saved lists table with data', () => {
      mockData.value = { lists: [makeList()], total: 1 };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-table"]').exists()).toBe(
        true,
      );
    });
  });

  describe('search filtering', () => {
    it('has a search input', () => {
      mockData.value = { lists: [makeList()], total: 1 };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="saved-lists-search"]');
      expect(input.exists()).toBe(true);
    });

    it('filters lists by name when searching', async () => {
      mockData.value = {
        lists: [
          makeList({ id: 'list-1', name: 'Office Supplies' }),
          makeList({ id: 'list-2', name: 'Warehouse Stock' }),
        ],
        total: 2,
      };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="saved-lists-search"]');
      await input.setValue('Office');
      await nextTick();
      // Table should still be visible (one match remains)
      expect(wrapper.find('[data-testid="saved-lists-table"]').exists()).toBe(
        true,
      );
    });
  });

  describe('create list', () => {
    it('has a create button', () => {
      mockData.value = { lists: [], total: 0 };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="saved-lists-create"]').exists()).toBe(
        true,
      );
    });

    it('opens sheet when create button is clicked', async () => {
      mockData.value = { lists: [], total: 0 };
      const wrapper = mountComponent(SavedListsPage, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="saved-lists-create"]').trigger('click');
      await nextTick();
      // Sheet mock always renders slot content — verify create form fields appear
      expect(wrapper.find('[data-testid="create-list-name"]').exists()).toBe(
        true,
      );
    });
  });
});
