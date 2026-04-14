import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type { Quote } from '../../../shared/types/quote';

// Hoist reactive mock state so it's available inside vi.mock factories
const {
  mockData,
  mockError,
  mockPending,
  mockUseFetch,
  mockAcceptQuote,
  mockRejectQuote,
  mockIsActionLoading,
  mockIsLoading,
  mockStoreCurrentQuote,
  mockCreateError,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');

  const createErrorFn = (opts: {
    statusCode: number;
    statusMessage?: string;
    fatal?: boolean;
  }) => {
    const err = new Error(opts.statusMessage ?? '') as Error & {
      statusCode: number;
      statusMessage: string;
      fatal: boolean;
    };
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage ?? '';
    err.fatal = opts.fatal ?? false;
    return err;
  };

  return {
    mockData: ref<{ quote: Quote } | null>(null),
    mockError: ref<Error | null>(null),
    mockPending: ref(false),
    mockUseFetch: vi.fn(),
    mockAcceptQuote: vi.fn(() => Promise.resolve()),
    mockRejectQuote: vi.fn(() => Promise.resolve()),
    mockIsActionLoading: ref(false),
    mockIsLoading: ref(false),
    mockStoreCurrentQuote: ref<Quote | null>(null),
    mockCreateError: createErrorFn,
  };
});

// Mock definePageMeta (Nuxt macro)
vi.stubGlobal('definePageMeta', vi.fn());

// Mock navigateTo
vi.stubGlobal('navigateTo', vi.fn());

// Mock createError — throw path uses this
vi.stubGlobal('createError', mockCreateError);

vi.mock('#app/composables/error', () => ({
  createError: mockCreateError,
  showError: vi.fn(),
}));

// Mock useFetch — the detail page awaits it at the top of setup
mockUseFetch.mockImplementation(() => ({
  data: mockData,
  error: mockError,
  pending: mockPending,
  refresh: vi.fn(),
  execute: vi.fn(),
  status: { value: 'success' },
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

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

// Mock safeConfirm — the detail page calls it before rejecting. Default true
// so the decline flow proceeds in tests; override per-test to assert cancel.
const mockSafeConfirm = vi.fn(() => true);
vi.mock('../../../app/utils/client-helpers', () => ({
  safeConfirm: (...args: unknown[]) => mockSafeConfirm(...args),
  safeScrollTo: vi.fn(),
  safeLocationRedirect: vi.fn(),
  safeHistoryBack: vi.fn(),
}));

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => ({
    // currentQuote is read/written by the detail page — back with a hoisted ref
    get currentQuote() {
      return mockStoreCurrentQuote.value;
    },
    set currentQuote(value: Quote | null) {
      mockStoreCurrentQuote.value = value;
    },
    get isLoading() {
      return mockIsLoading.value;
    },
    get isActionLoading() {
      return mockIsActionLoading.value;
    },
    acceptQuote: mockAcceptQuote,
    rejectQuote: mockRejectQuote,
  }),
}));

// Import the component AFTER mocks are set up. Top-level-await in the
// component's <script setup> makes it an async component, so it must be
// rendered inside a <Suspense> boundary.
const { default: PortalQuotationDetail } =
  await import('../../../app/pages/portal/quotations/[id].vue');

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
  GeinsImage: {
    template:
      '<img data-testid="geins-image" :data-file-name="fileName" :data-type="type" :alt="alt" />',
    props: ['fileName', 'type', 'alt', 'aspectRatio', 'sizes', 'loading'],
  },
};

// Mount the detail page wrapped in <Suspense>. Captures any error thrown
// during async setup via onErrorCaptured so callers can assert the 404 throw.
async function mountDetailPage() {
  const captured: Array<Error & { statusCode?: number; fatal?: boolean }> = [];
  const Wrapper = defineComponent({
    components: { PortalQuotationDetail },
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as Error & { statusCode?: number; fatal?: boolean });
        // Swallow so the test doesn't log an unhandled error
        return false;
      });
      return () =>
        h(Suspense, null, {
          default: () => h(PortalQuotationDetail),
          fallback: () => h('div', { 'data-testid': 'suspense-fallback' }),
        });
    },
  });

  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...(defaultMountOptions.global?.stubs ?? {}),
        ...defaultStubs,
      },
    },
  });
  await flushPromises();
  return { wrapper, captured };
}

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
        imageFileName: '/img/widget.jpg',
      },
    ],
    subtotal: 200,
    subtotalFormatted: '200,00 kr',
    tax: 50,
    taxFormatted: '50,00 kr',
    shipping: 0,
    shippingFormatted: '',
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

describe('PortalQuotationDetail', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockPending.value = false;
    mockIsActionLoading.value = false;
    mockIsLoading.value = false;
    mockStoreCurrentQuote.value = null;
    mockUseFetch.mockClear();
    mockAcceptQuote.mockClear();
    mockRejectQuote.mockClear();
    mockSafeConfirm.mockClear();
    mockSafeConfirm.mockReturnValue(true);
  });

  describe('SSR 404 handling', () => {
    it('throws createError with statusCode 404 when useFetch errors', async () => {
      mockData.value = null;
      mockError.value = new Error('Network error');

      const { captured } = await mountDetailPage();

      // Vue may capture the same error at multiple boundaries (Suspense +
      // wrapper) — assert at least one matches our 404 throw.
      expect(captured.length).toBeGreaterThanOrEqual(1);
      expect(captured[0]).toMatchObject({
        statusCode: 404,
        fatal: true,
      });
    });

    it('throws createError with statusCode 404 when data has no quote', async () => {
      mockData.value = null;
      mockError.value = null;

      const { captured } = await mountDetailPage();

      expect(captured.length).toBeGreaterThanOrEqual(1);
      expect(captured[0]).toMatchObject({
        statusCode: 404,
        fatal: true,
      });
    });
  });

  describe('useFetch call', () => {
    it('calls useFetch with the correct quote id URL', async () => {
      mockData.value = { quote: makeQuote() };
      await mountDetailPage();

      expect(mockUseFetch).toHaveBeenCalled();
      const [urlOrFn] = mockUseFetch.mock.calls[0]!;
      const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
      expect(url).toBe('/api/quotes/q-001');
    });

    it('passes dedupe: defer to useFetch', async () => {
      mockData.value = { quote: makeQuote() };
      await mountDetailPage();
      expect(mockUseFetch.mock.calls[0]?.[1]).toMatchObject({
        dedupe: 'defer',
      });
    });
  });

  describe('line items table', () => {
    it('renders line items with product details', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const table = wrapper.find('[data-testid="line-items-table"]');
      expect(table.exists()).toBe(true);
      expect(table.text()).toContain('Widget Pro');
      expect(table.text()).toContain('ART-001');
      expect(table.text()).toContain('2');
      expect(table.text()).toContain('100,00 kr');
      expect(table.text()).toContain('200,00 kr');
    });

    it('renders a GeinsImage with the product file name and type=product when imageFileName is set', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const img = wrapper.find('[data-testid="geins-image"]');
      expect(img.exists()).toBe(true);
      expect(img.attributes('data-file-name')).toBe('/img/widget.jpg');
      expect(img.attributes('data-type')).toBe('product');
      expect(img.attributes('alt')).toBe('Widget Pro');
    });

    it('does not render a GeinsImage when imageFileName is missing', async () => {
      mockData.value = {
        quote: makeQuote({
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
          ],
        }),
      };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="geins-image"]').exists()).toBe(false);
    });

    it('does not render any raw <img> tags for line item thumbnails', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      // The only <img> rendered inside the line items table should be the
      // GeinsImage stub (which carries data-testid="geins-image"). No raw
      // <img :src="..."> for the thumbnail should remain.
      const table = wrapper.find('[data-testid="line-items-table"]');
      const imgs = table.findAll('img');
      for (const img of imgs) {
        expect(img.attributes('data-testid')).toBe('geins-image');
      }
    });

    it('renders all line items', async () => {
      mockData.value = {
        quote: makeQuote({
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
        }),
      };
      const { wrapper } = await mountDetailPage();

      const rows = wrapper.findAll('[data-testid="line-item-row"]');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.text()).toContain('Widget Pro');
      expect(rows[1]!.text()).toContain('Gadget Plus');
    });
  });

  describe('summary sidebar', () => {
    it('shows subtotal, tax, and grand total', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const summary = wrapper.find('[data-testid="quote-summary"]');
      expect(summary.exists()).toBe(true);
      expect(summary.text()).toContain('200,00 kr');
      expect(summary.text()).toContain('50,00 kr');
      expect(summary.text()).toContain('250,00 kr');
    });

    it('shows payment terms when present', async () => {
      mockData.value = { quote: makeQuote({ paymentTerms: 'Net 30' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="payment-terms"]').text()).toContain(
        'Net 30',
      );
    });

    it('hides payment terms block when absent', async () => {
      mockData.value = { quote: makeQuote({ paymentTerms: undefined }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="payment-terms"]').exists()).toBe(
        false,
      );
    });

    it('shows expiration date when present', async () => {
      mockData.value = {
        quote: makeQuote({ expiresAt: '2026-04-01T00:00:00Z' }),
      };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="expires-at"]').exists()).toBe(true);
    });

    it('shows contact info', async () => {
      mockData.value = {
        quote: makeQuote({
          contactName: 'Jane Doe',
          contactEmail: 'jane@example.com',
        }),
      };
      const { wrapper } = await mountDetailPage();

      const contact = wrapper.find('[data-testid="sale-contact"]');
      expect(contact.text()).toContain('Jane Doe');
      expect(contact.text()).toContain('jane@example.com');
    });
  });

  describe('status badge', () => {
    it('shows pending badge for pending quotes', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      const badge = wrapper.find('[data-testid="status-badge"]');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('portal.quotations.status_pending');
    });

    it('shows accepted badge for accepted quotes', async () => {
      mockData.value = { quote: makeQuote({ status: 'accepted' }) };
      const { wrapper } = await mountDetailPage();

      const badge = wrapper.find('[data-testid="status-badge"]');
      expect(badge.text()).toContain('portal.quotations.status_accepted');
    });

    it('shows rejected badge for rejected quotes', async () => {
      mockData.value = { quote: makeQuote({ status: 'rejected' }) };
      const { wrapper } = await mountDetailPage();

      const badge = wrapper.find('[data-testid="status-badge"]');
      expect(badge.text()).toContain('portal.quotations.status_rejected');
    });
  });

  describe('accept / decline buttons', () => {
    it('shows accept and decline buttons only for pending quotes', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(true);
    });

    it('hides accept and decline buttons for accepted quotes', async () => {
      mockData.value = { quote: makeQuote({ status: 'accepted' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false);
    });

    it('hides accept and decline buttons for rejected quotes', async () => {
      mockData.value = { quote: makeQuote({ status: 'rejected' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false);
    });

    it('calls acceptQuote when accept button is clicked', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="accept-btn"]').trigger('click');

      expect(mockAcceptQuote).toHaveBeenCalledWith('q-001');
    });

    it('does not render a decline-reason textarea', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="decline-form"]').exists()).toBe(false);
      expect(
        wrapper.find('[data-testid="decline-reason-input"]').exists(),
      ).toBe(false);
    });

    it('calls rejectQuote with id only when decline button is clicked', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');

      expect(mockSafeConfirm).toHaveBeenCalled();
      expect(mockRejectQuote).toHaveBeenCalledWith('q-001');
      expect(mockRejectQuote.mock.calls[0]).toHaveLength(1);
    });

    it('does not call rejectQuote when decline confirm is cancelled', async () => {
      mockSafeConfirm.mockReturnValue(false);
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');

      expect(mockSafeConfirm).toHaveBeenCalled();
      expect(mockRejectQuote).not.toHaveBeenCalled();
    });
  });

  describe('store seeding', () => {
    it('seeds the quotes store currentQuote from the fetch result', async () => {
      const quote = makeQuote({ id: 'q-001' });
      mockData.value = { quote };
      await mountDetailPage();

      expect(mockStoreCurrentQuote.value).toEqual(quote);
    });
  });
});
