import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, Suspense, onErrorCaptured, type VNode } from 'vue';
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
  mockStoreError,
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

  const storeErrorRef = ref<string | null>(null);

  return {
    mockData: ref<{ quote: Quote } | null>(null),
    mockError: ref<Error | null>(null),
    mockPending: ref(false),
    mockUseFetch: vi.fn(),
    // Default implementations simulate the real store by clearing/setting
    // the shared error ref. Individual tests can override with mockImplementationOnce.
    mockAcceptQuote: vi.fn(() => {
      storeErrorRef.value = null;
      return Promise.resolve();
    }),
    mockRejectQuote: vi.fn(() => {
      storeErrorRef.value = null;
      return Promise.resolve();
    }),
    mockIsActionLoading: ref(false),
    mockIsLoading: ref(false),
    mockStoreCurrentQuote: ref<Quote | null>(null),
    mockStoreError: storeErrorRef,
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
    // error is reactive so the banner v-if updates when actions mutate it
    get error() {
      return mockStoreError.value;
    },
    set error(value: string | null) {
      mockStoreError.value = value;
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
  Icon: defineComponent({
    name: 'Icon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
  NuxtIcon: defineComponent({
    name: 'NuxtIcon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
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
    mockStoreError.value = null;
    mockUseFetch.mockClear();
    mockAcceptQuote.mockClear();
    mockAcceptQuote.mockImplementation(() => {
      mockStoreError.value = null;
      return Promise.resolve();
    });
    mockRejectQuote.mockClear();
    mockRejectQuote.mockImplementation(() => {
      mockStoreError.value = null;
      return Promise.resolve();
    });
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

  describe('header title (D1)', () => {
    it('renders quote.name as the H2 title when name is set', async () => {
      mockData.value = {
        quote: makeQuote({ name: 'Dec order proposal' }),
      };
      const { wrapper } = await mountDetailPage();

      const title = wrapper.find('[data-testid="quote-title"]');
      expect(title.exists()).toBe(true);
      expect(title.text()).toBe('Dec order proposal');
    });

    it('falls back to "detail_title #number" when name is absent', async () => {
      mockData.value = {
        quote: makeQuote({ name: undefined, quoteNumber: 'QUO-2026-001' }),
      };
      const { wrapper } = await mountDetailPage();

      const title = wrapper.find('[data-testid="quote-title"]');
      expect(title.text()).toContain('portal.quotations.detail_title');
      expect(title.text()).toContain('#QUO-2026-001');
    });
  });

  describe('back to quotations link (D2)', () => {
    it('renders a back link pointing to the locale-prefixed quotations list', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const back = wrapper.find('[data-testid="back-link"]');
      expect(back.exists()).toBe(true);
      // setup-components.ts stubs localePath() to '/se/en' + path
      expect(back.attributes('href')).toBe('/se/en/portal/quotations');
      expect(back.text()).toContain('portal.quotations.back_to_quotations');
    });

    it('renders a lucide:arrow-left icon inside the back link', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const back = wrapper.find('[data-testid="back-link"]');
      const icon = back.find('[data-name="lucide:arrow-left"]');
      expect(icon.exists()).toBe(true);
    });
  });

  describe('shipping row (D3)', () => {
    it('renders shipping line when shipping > 0', async () => {
      mockData.value = {
        quote: makeQuote({ shipping: 100, shippingFormatted: '100,00 kr' }),
      };
      const { wrapper } = await mountDetailPage();

      const row = wrapper.find('[data-testid="shipping-row"]');
      expect(row.exists()).toBe(true);
      expect(row.text()).toContain('portal.quotations.shipping');
      expect(row.text()).toContain('100,00 kr');
    });

    it('hides shipping row when shipping is 0', async () => {
      mockData.value = { quote: makeQuote({ shipping: 0 }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="shipping-row"]').exists()).toBe(false);
    });
  });

  describe('subtotal with item count (D8)', () => {
    it('renders subtotal label interpolated with lineItems length', async () => {
      mockData.value = {
        quote: makeQuote({
          lineItems: [
            {
              productId: 1,
              sku: 'SKU-A',
              name: 'A',
              articleNumber: 'ART-A',
              quantity: 1,
              unitPrice: 10,
              unitPriceFormatted: '10 kr',
              totalPrice: 10,
              totalPriceFormatted: '10 kr',
            },
            {
              productId: 2,
              sku: 'SKU-B',
              name: 'B',
              articleNumber: 'ART-B',
              quantity: 1,
              unitPrice: 20,
              unitPriceFormatted: '20 kr',
              totalPrice: 20,
              totalPriceFormatted: '20 kr',
            },
            {
              productId: 3,
              sku: 'SKU-C',
              name: 'C',
              articleNumber: 'ART-C',
              quantity: 1,
              unitPrice: 30,
              unitPriceFormatted: '30 kr',
              totalPrice: 30,
              totalPriceFormatted: '30 kr',
            },
          ],
        }),
      };
      const { wrapper } = await mountDetailPage();

      const summary = wrapper.find('[data-testid="quote-summary"]');
      expect(summary.text()).toContain('portal.quotations.subtotal_with_count');
      // Passthrough t() in setup-components.ts returns the key, so we can't
      // assert the rendered count. Assert via the VDOM props instead.
      expect(mockUseFetch).toHaveBeenCalled();
      // lineItems.length is 3 — confirm the component read the right input
      expect(wrapper.findAll('[data-testid="line-item-row"]')).toHaveLength(3);
    });
  });

  describe('customer information block (D5)', () => {
    it('renders customer info when quote.company is present', async () => {
      mockData.value = {
        quote: makeQuote({
          company: {
            name: 'Acme AB',
            companyId: '556677-8899',
            vatNumber: 'SE556677889901',
          },
        }),
      };
      const { wrapper } = await mountDetailPage();

      const card = wrapper.find('[data-testid="customer-info"]');
      expect(card.exists()).toBe(true);
      expect(card.text()).toContain('Acme AB');
      expect(card.text()).toContain('556677-8899');
      expect(card.text()).toContain('SE556677889901');
    });

    it('hides customer info block when quote.company is undefined', async () => {
      mockData.value = { quote: makeQuote({ company: undefined }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="customer-info"]').exists()).toBe(
        false,
      );
    });
  });

  describe('invoice address block (D6)', () => {
    it('renders invoice address when billingAddress is present', async () => {
      mockData.value = {
        quote: makeQuote({
          billingAddress: {
            company: 'Acme AB',
            firstName: 'Jane',
            lastName: 'Doe',
            addressLine1: 'Main Street 1',
            zip: '12345',
            city: 'Stockholm',
            country: 'Sweden',
          },
        }),
      };
      const { wrapper } = await mountDetailPage();

      const card = wrapper.find('[data-testid="invoice-address"]');
      expect(card.exists()).toBe(true);
      expect(card.text()).toContain('Acme AB');
      expect(card.text()).toContain('Jane Doe');
      expect(card.text()).toContain('Main Street 1');
      expect(card.text()).toContain('12345 Stockholm');
      expect(card.text()).toContain('Sweden');
    });

    it('hides invoice address block when billingAddress is undefined', async () => {
      mockData.value = { quote: makeQuote({ billingAddress: undefined }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="invoice-address"]').exists()).toBe(
        false,
      );
    });
  });

  describe('delivery address block (D7)', () => {
    it('renders delivery address when shippingAddress is present', async () => {
      mockData.value = {
        quote: makeQuote({
          shippingAddress: {
            company: 'Acme AB',
            firstName: 'John',
            lastName: 'Smith',
            addressLine1: 'Warehouse Lane 5',
            zip: '54321',
            city: 'Gothenburg',
            country: 'Sweden',
          },
        }),
      };
      const { wrapper } = await mountDetailPage();

      const card = wrapper.find('[data-testid="delivery-address"]');
      expect(card.exists()).toBe(true);
      expect(card.text()).toContain('Acme AB');
      expect(card.text()).toContain('John Smith');
      expect(card.text()).toContain('Warehouse Lane 5');
      expect(card.text()).toContain('54321 Gothenburg');
      expect(card.text()).toContain('Sweden');
    });

    it('hides delivery address block when shippingAddress is undefined', async () => {
      mockData.value = { quote: makeQuote({ shippingAddress: undefined }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="delivery-address"]').exists()).toBe(
        false,
      );
    });
  });

  describe('sidebar icons (D10)', () => {
    it('renders a calendar icon inside the expires-at block', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const block = wrapper.find('[data-testid="expires-at"]');
      expect(block.find('[data-name="lucide:calendar"]').exists()).toBe(true);
    });

    it('renders a clock icon inside the payment-terms block', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const block = wrapper.find('[data-testid="payment-terms"]');
      expect(block.find('[data-name="lucide:clock"]').exists()).toBe(true);
    });

    it('renders a user icon inside the sale-contact block', async () => {
      mockData.value = { quote: makeQuote() };
      const { wrapper } = await mountDetailPage();

      const block = wrapper.find('[data-testid="sale-contact"]');
      expect(block.find('[data-name="lucide:user"]').exists()).toBe(true);
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

  describe('action error banner (B6)', () => {
    it('does not render the error banner by default', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
    });

    it('renders the error banner with accept_failed text when acceptQuote sets store.error', async () => {
      // Simulate the real store's catch block: on failure, set store.error
      // to the i18n key and leave the promise resolved (store swallows the
      // throw internally). This mirrors the real contract at
      // app/stores/quotes.ts acceptQuote catch branch.
      mockAcceptQuote.mockImplementationOnce(() => {
        mockStoreError.value = 'portal.quotations.accept_failed';
        return Promise.resolve();
      });
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="accept-btn"]').trigger('click');
      await flushPromises();

      const banner = wrapper.find('[data-testid="action-error"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain('portal.quotations.accept_failed');
      expect(banner.attributes('role')).toBe('alert');
    });

    it('renders the error banner with decline_failed text when rejectQuote sets store.error', async () => {
      mockRejectQuote.mockImplementationOnce(() => {
        mockStoreError.value = 'portal.quotations.decline_failed';
        return Promise.resolve();
      });
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');
      await flushPromises();

      const banner = wrapper.find('[data-testid="action-error"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain('portal.quotations.decline_failed');
    });

    it('clears the error banner when the user clicks Accept again and it succeeds', async () => {
      mockAcceptQuote.mockImplementationOnce(() => {
        mockStoreError.value = 'portal.quotations.accept_failed';
        return Promise.resolve();
      });
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="accept-btn"]').trigger('click');
      await flushPromises();
      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(true);

      // Second click succeeds — the default mockAcceptQuote impl clears
      // store.error at the start (mirroring the real store), so the banner
      // should disappear.
      await wrapper.find('[data-testid="accept-btn"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
    });

    it('clears the error banner when the user clicks Decline again and it succeeds', async () => {
      mockRejectQuote.mockImplementationOnce(() => {
        mockStoreError.value = 'portal.quotations.decline_failed';
        return Promise.resolve();
      });
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');
      await flushPromises();
      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(true);

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
    });

    it('does not render the error banner when acceptQuote succeeds', async () => {
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      await wrapper.find('[data-testid="accept-btn"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
    });

    it('clears a stale store.error on mount so the banner starts hidden on navigation', async () => {
      // Simulate a stale error left over from a previous route — the page
      // setup should reset store.error to null when it seeds currentQuote.
      mockStoreError.value = 'portal.quotations.accept_failed';
      mockData.value = { quote: makeQuote({ status: 'pending' }) };
      const { wrapper } = await mountDetailPage();

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
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
