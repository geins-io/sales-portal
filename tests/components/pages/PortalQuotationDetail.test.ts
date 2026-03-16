import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import PortalQuotationDetail from '../../../app/pages/portal/quotations/[id].vue';
import type { Quote } from '../../../shared/types/quote';

// Hoist reactive store state and error mocks so they're available inside vi.mock factories
const {
  mockFetchQuote,
  mockAcceptQuote,
  mockRejectQuote,
  mockCurrentQuote,
  mockIsLoading,
  mockIsActionLoading,
  mockShowError,
  mockCreateError,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');

  const createErrorFn = (opts: {
    statusCode: number;
    statusMessage: string;
  }) => {
    const err = new Error(opts.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  };

  return {
    mockFetchQuote: vi.fn(() => Promise.resolve()),
    mockAcceptQuote: vi.fn(() => Promise.resolve()),
    mockRejectQuote: vi.fn(() => Promise.resolve()),
    mockCurrentQuote: ref<Quote | null>(null),
    mockIsLoading: ref(false),
    mockIsActionLoading: ref(false),
    mockShowError: vi.fn(),
    mockCreateError: createErrorFn,
  };
});

// Mock definePageMeta (Nuxt macro)
vi.stubGlobal('definePageMeta', vi.fn());

// Mock navigateTo
vi.stubGlobal('navigateTo', vi.fn());

// Mock showError and createError (used when quote not found after fetch)
vi.stubGlobal('showError', mockShowError);
vi.stubGlobal('createError', mockCreateError);

vi.mock('#app/composables/error', () => ({
  createError: mockCreateError,
  showError: mockShowError,
}));

// Mock useHead / head composables
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

// Mock route with an id param
vi.stubGlobal('useRoute', () => ({
  params: { id: 'q-001' },
  path: '/portal/quotations/q-001',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001',
  name: 'portal-quotations-id',
  matched: [],
  meta: {},
}));

vi.mock('#app/composables/router', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRoute: () => ({
      params: { id: 'q-001' },
      path: '/portal/quotations/q-001',
      query: {},
      hash: '',
      fullPath: '/portal/quotations/q-001',
      name: 'portal-quotations-id',
      matched: [],
      meta: {},
    }),
  };
});

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => ({
    // Use getters so template v-if sees the unwrapped value at render time
    get currentQuote() {
      return mockCurrentQuote.value;
    },
    get isLoading() {
      return mockIsLoading.value;
    },
    get isActionLoading() {
      return mockIsActionLoading.value;
    },
    fetchQuote: mockFetchQuote,
    acceptQuote: mockAcceptQuote,
    rejectQuote: mockRejectQuote,
  }),
}));

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q-001',
    quoteNumber: 'QUO-2026-001',
    organizationId: 'org-1',
    createdBy: 'user@example.com',
    contactName: 'Jane Doe',
    contactEmail: 'jane@example.com',
    status: 'pending',
    lineItems: [
      {
        productId: 1,
        sku: 'SKU-A',
        name: 'Widget Pro',
        articleNumber: 'ART-001',
        quantity: 2,
        unitPrice: 100,
        unitPriceFormatted: '100,00 kr',
        totalPrice: 200,
        totalPriceFormatted: '200,00 kr',
        imageUrl: '/img/widget.jpg',
      },
    ],
    subtotal: 200,
    subtotalFormatted: '200,00 kr',
    tax: 50,
    taxFormatted: '50,00 kr',
    total: 250,
    totalFormatted: '250,00 kr',
    currency: 'SEK',
    paymentTerms: 'Net 30',
    expiresAt: '2026-04-01T00:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
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
  Icon: {
    template: '<span class="icon" :data-name="name"></span>',
    props: ['name'],
  },
};

describe('PortalQuotationDetail', () => {
  beforeEach(() => {
    mockCurrentQuote.value = null;
    mockIsLoading.value = false;
    mockIsActionLoading.value = false;
    mockFetchQuote.mockClear();
    mockAcceptQuote.mockClear();
    mockRejectQuote.mockClear();
    mockShowError.mockClear();
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      mockIsLoading.value = true;

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="quote-loading"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="quote-detail"]').exists()).toBe(false);
    });
  });

  describe('line items table', () => {
    it('renders line items with product details', () => {
      mockCurrentQuote.value = makeQuote();

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const table = wrapper.find('[data-testid="line-items-table"]');
      expect(table.exists()).toBe(true);
      expect(table.text()).toContain('Widget Pro');
      expect(table.text()).toContain('ART-001');
      expect(table.text()).toContain('2');
      expect(table.text()).toContain('100,00 kr');
      expect(table.text()).toContain('200,00 kr');
    });

    it('renders all line items', () => {
      mockCurrentQuote.value = makeQuote({
        lineItems: [
          {
            productId: 1,
            sku: 'SKU-A',
            name: 'Widget Pro',
            articleNumber: 'ART-001',
            quantity: 2,
            unitPrice: 100,
            unitPriceFormatted: '100,00 kr',
            totalPrice: 200,
            totalPriceFormatted: '200,00 kr',
          },
          {
            productId: 2,
            sku: 'SKU-B',
            name: 'Gadget Plus',
            articleNumber: 'ART-002',
            quantity: 1,
            unitPrice: 50,
            unitPriceFormatted: '50,00 kr',
            totalPrice: 50,
            totalPriceFormatted: '50,00 kr',
          },
        ],
      });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const rows = wrapper.findAll('[data-testid="line-item-row"]');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.text()).toContain('Widget Pro');
      expect(rows[1]!.text()).toContain('Gadget Plus');
    });
  });

  describe('summary sidebar', () => {
    it('shows subtotal, tax, and grand total', () => {
      mockCurrentQuote.value = makeQuote();

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const summary = wrapper.find('[data-testid="quote-summary"]');
      expect(summary.exists()).toBe(true);
      expect(summary.text()).toContain('200,00 kr');
      expect(summary.text()).toContain('50,00 kr');
      expect(summary.text()).toContain('250,00 kr');
    });

    it('shows payment terms when present', () => {
      mockCurrentQuote.value = makeQuote({ paymentTerms: 'Net 30' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="payment-terms"]').text()).toContain(
        'Net 30',
      );
    });

    it('hides payment terms block when absent', () => {
      mockCurrentQuote.value = makeQuote({ paymentTerms: undefined });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="payment-terms"]').exists()).toBe(
        false,
      );
    });

    it('shows expiration date when present', () => {
      mockCurrentQuote.value = makeQuote({
        expiresAt: '2026-04-01T00:00:00Z',
      });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="expires-at"]').exists()).toBe(true);
    });

    it('shows contact info', () => {
      mockCurrentQuote.value = makeQuote({
        contactName: 'Jane Doe',
        contactEmail: 'jane@example.com',
      });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const contact = wrapper.find('[data-testid="sale-contact"]');
      expect(contact.text()).toContain('Jane Doe');
      expect(contact.text()).toContain('jane@example.com');
    });
  });

  describe('status badge', () => {
    it('shows pending badge for pending quotes', () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const badge = wrapper.find('[data-testid="status-badge"]');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('portal.quotations.status_pending');
    });

    it('shows accepted badge for accepted quotes', () => {
      mockCurrentQuote.value = makeQuote({ status: 'accepted' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const badge = wrapper.find('[data-testid="status-badge"]');
      expect(badge.text()).toContain('portal.quotations.status_accepted');
    });

    it('shows rejected badge for rejected quotes', () => {
      mockCurrentQuote.value = makeQuote({ status: 'rejected' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      const badge = wrapper.find('[data-testid="status-badge"]');
      expect(badge.text()).toContain('portal.quotations.status_rejected');
    });
  });

  describe('accept / decline buttons', () => {
    it('shows accept and decline buttons only for pending quotes', () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(true);
    });

    it('hides accept and decline buttons for accepted quotes', () => {
      mockCurrentQuote.value = makeQuote({ status: 'accepted' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false);
    });

    it('hides accept and decline buttons for rejected quotes', () => {
      mockCurrentQuote.value = makeQuote({ status: 'rejected' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false);
    });

    it('calls acceptQuote when accept button is clicked', async () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      await wrapper.find('[data-testid="accept-btn"]').trigger('click');

      expect(mockAcceptQuote).toHaveBeenCalledWith('q-001');
    });

    it('shows decline reason textarea when decline button is clicked', async () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="decline-form"]').exists()).toBe(false);

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');

      expect(wrapper.find('[data-testid="decline-form"]').exists()).toBe(true);
    });

    it('calls rejectQuote with reason when confirm decline is clicked', async () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');

      const textarea = wrapper.find('[data-testid="decline-reason-input"]');
      await textarea.setValue('Price too high');

      await wrapper
        .find('[data-testid="confirm-decline-btn"]')
        .trigger('click');

      expect(mockRejectQuote).toHaveBeenCalledWith('q-001', 'Price too high');
    });

    it('calls rejectQuote with empty string when no reason given', async () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');
      await wrapper
        .find('[data-testid="confirm-decline-btn"]')
        .trigger('click');

      expect(mockRejectQuote).toHaveBeenCalledWith('q-001', '');
    });

    it('dismisses decline form when cancel is clicked', async () => {
      mockCurrentQuote.value = makeQuote({ status: 'pending' });

      const wrapper = shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');
      expect(wrapper.find('[data-testid="decline-form"]').exists()).toBe(true);

      await wrapper.find('[data-testid="cancel-decline-btn"]').trigger('click');
      expect(wrapper.find('[data-testid="decline-form"]').exists()).toBe(false);
    });
  });

  describe('fetchQuote on mount', () => {
    it('calls fetchQuote with the route id on mount', () => {
      shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockFetchQuote).toHaveBeenCalledWith('q-001');
    });
  });

  describe('error handling', () => {
    it('calls showError with 404 when quote is not found after fetch', async () => {
      // currentQuote stays null (default), simulating a failed or empty fetch
      mockFetchQuote.mockResolvedValue(undefined);

      shallowMountComponent(PortalQuotationDetail, {
        global: { stubs: defaultStubs },
      });

      // Wait for the onMounted async callback to complete
      await vi.waitFor(() => {
        expect(mockShowError).toHaveBeenCalledTimes(1);
      });

      const errorArg = mockShowError.mock.calls[0]![0] as Error & {
        statusCode: number;
      };
      expect(errorArg.statusCode).toBe(404);
    });
  });
});
