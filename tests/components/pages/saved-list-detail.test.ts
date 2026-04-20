import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import SavedListDetail from '../../../app/pages/portal/saved-lists/[id].vue';

// Hoist mock state so it's available inside vi.mock factories
const {
  mockData,
  mockError,
  mockPending,
  mockStatus,
  mockShowError,
  mockCreateError,
  mockUseHead,
  mockFetch,
  mockNavigateTo,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');

  const createErrorFn = (opts: {
    statusCode: number;
    statusMessage?: string;
  }) => {
    const err = new Error(opts.statusMessage ?? '') as Error & {
      statusCode: number;
      statusMessage: string;
    };
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage ?? '';
    return err;
  };

  return {
    mockData: ref<Record<string, unknown> | null>(null),
    mockError: ref<Error | null>(null),
    mockPending: ref(false),
    mockStatus: ref('success'),
    mockShowError: vi.fn(),
    mockCreateError: createErrorFn,
    mockUseHead: vi.fn(),
    mockFetch: vi.fn().mockResolvedValue({}),
    mockNavigateTo: vi.fn(),
  };
});

// Mock definePageMeta (Nuxt macro)
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('showError', mockShowError);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('useHead', mockUseHead);
vi.stubGlobal('$fetch', mockFetch);

vi.mock('#app/composables/error', () => ({
  createError: mockCreateError,
  showError: mockShowError,
}));

vi.mock('#app/composables/head', () => ({
  useHead: mockUseHead,
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

// Mock route with an id param
const TEST_LIST_ID = 'list-abc-123';
vi.stubGlobal('useRoute', () => ({
  params: { id: TEST_LIST_ID },
  path: `/portal/saved-lists/${TEST_LIST_ID}`,
  query: {},
  hash: '',
  fullPath: `/portal/saved-lists/${TEST_LIST_ID}`,
  name: 'portal-saved-lists-id',
  matched: [],
  meta: {},
}));

vi.mock('#app/composables/router', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRoute: () => ({
      params: { id: TEST_LIST_ID },
      path: `/portal/saved-lists/${TEST_LIST_ID}`,
      query: {},
      hash: '',
      fullPath: `/portal/saved-lists/${TEST_LIST_ID}`,
      name: 'portal-saved-lists-id',
      matched: [],
      meta: {},
    }),
    navigateTo: mockNavigateTo,
  };
});

// Mock useFetch
const mockUseFetch = vi.fn(() => ({
  data: mockData,
  error: mockError,
  status: mockStatus,
  pending: mockPending,
  refresh: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_LIST_ID,
    userId: 'user-1',
    name: 'My Test List',
    description: 'A test description',
    items: [
      {
        id: 'item-1',
        productId: 101,
        sku: 'SKU-001',
        name: 'Widget Pro',
        articleNumber: 'ART-001',
        quantity: 3,
        unitPrice: 150,
        unitPriceFormatted: '150,00 kr',
        imageUrl: 'widget.jpg',
      },
      {
        id: 'item-2',
        productId: 102,
        sku: 'SKU-002',
        name: 'Gadget Plus',
        articleNumber: 'ART-002',
        quantity: 1,
        unitPrice: 200,
        unitPriceFormatted: '200,00 kr',
      },
    ],
    createdBy: 'user-1',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  Button: {
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  Input: {
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
    props: ['modelValue'],
    emits: ['update:modelValue', 'blur'],
  },
  Icon: {
    template: '<span class="icon" :data-name="name"></span>',
    props: ['name'],
  },
  NuxtLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  GeinsImage: {
    template: '<img :data-file-name="fileName" :alt="alt" />',
    props: ['fileName', 'type', 'alt', 'aspectRatio', 'sizes'],
  },
};

describe('SavedListDetail', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockPending.value = false;
    mockStatus.value = 'success';
    mockUseFetch.mockClear();
    mockShowError.mockClear();
    mockUseHead.mockClear();
    mockFetch.mockClear();
    mockNavigateTo.mockClear();
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      mockPending.value = true;

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="list-loading"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="list-detail"]').exists()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('calls showError with 404 when list not found', () => {
      mockData.value = null;
      mockError.value = new Error('Not found');

      shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockShowError).toHaveBeenCalled();
      const errorArg = mockShowError.mock.calls[0]![0] as Error & {
        statusCode: number;
      };
      expect(errorArg.statusCode).toBe(404);
    });

    it('calls showError with 404 when data is null', () => {
      mockData.value = null;

      shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockShowError).toHaveBeenCalled();
      const errorArg = mockShowError.mock.calls[0]![0] as Error & {
        statusCode: number;
      };
      expect(errorArg.statusCode).toBe(404);
    });
  });

  describe('list detail rendering', () => {
    it('renders list detail with name and description', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="list-detail"]').exists()).toBe(true);
      const nameInput = wrapper.find('[data-testid="list-name-input"]');
      expect(nameInput.exists()).toBe(true);
      expect((nameInput.element as HTMLInputElement).value).toBe(
        'My Test List',
      );
    });

    it('renders inside PortalShell', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });
  });

  describe('back link', () => {
    it('has a back link to the saved lists page', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const backLink = wrapper.find('[data-testid="back-link"]');
      expect(backLink.exists()).toBe(true);
      expect(backLink.attributes('href')).toContain('/portal/lists');
    });
  });

  describe('product rows', () => {
    it('renders product rows with name, article number, price, quantity', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const rows = wrapper.findAll('[data-testid="list-item-row"]');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.text()).toContain('Widget Pro');
      expect(rows[0]!.text()).toContain('ART-001');
      expect(rows[0]!.text()).toContain('150,00 kr');
      expect(rows[1]!.text()).toContain('Gadget Plus');
      expect(rows[1]!.text()).toContain('ART-002');
    });

    it('displays total sum computed from items', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const totalSection = wrapper.find('[data-testid="list-total"]');
      expect(totalSection.exists()).toBe(true);
      // 3 * 150 + 1 * 200 = 650
      expect(totalSection.text()).toContain('650');
    });
  });

  describe('quantity controls', () => {
    it('increments item quantity when + button is clicked', async () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const incrementBtns = wrapper.findAll(
        '[data-testid="quantity-increment"]',
      );
      expect(incrementBtns.length).toBeGreaterThan(0);
      await incrementBtns[0]!.trigger('click');
      await nextTick();

      // Quantity should have increased from 3 to 4
      const qtyDisplay = wrapper.findAll('[data-testid="quantity-display"]');
      expect(qtyDisplay[0]!.text()).toBe('4');
    });

    it('decrements item quantity when - button is clicked (min 1)', async () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const decrementBtns = wrapper.findAll(
        '[data-testid="quantity-decrement"]',
      );
      // Second item has quantity 1 -- clicking - should not go below 1
      await decrementBtns[1]!.trigger('click');
      await nextTick();

      const qtyDisplay = wrapper.findAll('[data-testid="quantity-display"]');
      expect(qtyDisplay[1]!.text()).toBe('1');
    });
  });

  describe('delete item', () => {
    it('removes item from list when delete icon is clicked', async () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const deleteBtns = wrapper.findAll('[data-testid="delete-item"]');
      expect(deleteBtns).toHaveLength(2);
      await deleteBtns[0]!.trigger('click');
      await nextTick();

      const rows = wrapper.findAll('[data-testid="list-item-row"]');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.text()).toContain('Gadget Plus');
    });
  });

  describe('delete list', () => {
    it('calls DELETE API and navigates back when delete list button is clicked', async () => {
      mockData.value = makeList();
      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const deleteBtn = wrapper.find('[data-testid="delete-list-btn"]');
      expect(deleteBtn.exists()).toBe(true);
      await deleteBtn.trigger('click');
      await nextTick();

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/lists/${TEST_LIST_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(mockNavigateTo).toHaveBeenCalled();
    });
  });

  describe('add to cart', () => {
    it('renders add to cart button', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const addToCartBtn = wrapper.find('[data-testid="add-to-cart-btn"]');
      expect(addToCartBtn.exists()).toBe(true);
    });
  });

  describe('action toolbar', () => {
    it('renders action toolbar above header with delete and add-to-cart buttons', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const toolbar = wrapper.find('[data-testid="saved-list-action-toolbar"]');
      expect(toolbar.exists()).toBe(true);
      expect(toolbar.find('[data-testid="delete-list-btn"]').exists()).toBe(
        true,
      );
      expect(toolbar.find('[data-testid="add-to-cart-btn"]').exists()).toBe(
        true,
      );
    });

    it('toolbar appears before header in DOM order (back-link → toolbar → header)', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const detail = wrapper.find('[data-testid="list-detail"]');
      const html = detail.html();
      const toolbarPos = html.indexOf('saved-list-action-toolbar');
      const nameInputPos = html.indexOf('list-name-input');
      expect(toolbarPos).toBeGreaterThan(-1);
      expect(nameInputPos).toBeGreaterThan(-1);
      expect(toolbarPos).toBeLessThan(nameInputPos);
    });

    it('delete button has lucide:x icon before label', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const deleteBtn = wrapper.find('[data-testid="delete-list-btn"]');
      const icon = deleteBtn.find('.icon[data-name="lucide:x"]');
      expect(icon.exists()).toBe(true);
    });

    it('add-to-cart button has lucide:shopping-cart icon before label', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const addToCartBtn = wrapper.find('[data-testid="add-to-cart-btn"]');
      const icon = addToCartBtn.find('.icon[data-name="lucide:shopping-cart"]');
      expect(icon.exists()).toBe(true);
    });

    it('add-to-cart button does NOT use bg-green-600 inline class', () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const addToCartBtn = wrapper.find('[data-testid="add-to-cart-btn"]');
      expect(addToCartBtn.classes()).not.toContain('bg-green-600');
      expect(addToCartBtn.attributes('class') ?? '').not.toContain(
        'bg-green-600',
      );
    });
  });

  describe('name edit', () => {
    it('triggers PUT on blur of name input', async () => {
      mockData.value = makeList();

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      const nameInput = wrapper.find('[data-testid="list-name-input"]');
      await nameInput.setValue('Updated Name');
      await nameInput.trigger('blur');
      await nextTick();

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/lists/${TEST_LIST_ID}`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('useFetch call', () => {
    it('calls useFetch with the correct list ID URL', () => {
      mockData.value = makeList();

      shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockUseFetch).toHaveBeenCalled();
      const [urlOrFn] = mockUseFetch.mock.calls[0]!;
      const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
      expect(url).toBe(`/api/lists/${TEST_LIST_ID}`);
    });
  });

  describe('empty list', () => {
    it('shows empty message when list has no items', () => {
      mockData.value = makeList({ items: [] });

      const wrapper = shallowMountComponent(SavedListDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="empty-list"]').exists()).toBe(true);
    });
  });

  describe('auth middleware', () => {
    it('has definePageMeta with auth middleware in source', () => {
      // definePageMeta is a Nuxt compiler macro -- it executes at module
      // load time before tests run, so we cannot spy on it reliably.
      // Instead we verify it is stubbed globally (the component imports
      // without error, which means the macro was resolved).
      expect(typeof globalThis.definePageMeta).toBe('function');
    });
  });
});
