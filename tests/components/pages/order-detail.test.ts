import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import OrderDetail from '../../../app/pages/portal/orders/[id].vue';

// Hoist mock state so it's available inside vi.mock factories
const {
  mockData,
  mockError,
  mockPending,
  mockStatus,
  mockShowError,
  mockCreateError,
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
  };
});

// Mock definePageMeta (Nuxt macro)
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', vi.fn());
vi.stubGlobal('showError', mockShowError);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('useHead', vi.fn());

vi.mock('#app/composables/error', () => ({
  createError: mockCreateError,
  showError: mockShowError,
}));

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
const TEST_ORDER_ID = 'abc-123-def';
vi.stubGlobal('useRoute', () => ({
  params: { id: TEST_ORDER_ID },
  path: `/portal/orders/${TEST_ORDER_ID}`,
  query: {},
  hash: '',
  fullPath: `/portal/orders/${TEST_ORDER_ID}`,
  name: 'portal-orders-id',
  matched: [],
  meta: {},
}));

vi.mock('#app/composables/router', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRoute: () => ({
      params: { id: TEST_ORDER_ID },
      path: `/portal/orders/${TEST_ORDER_ID}`,
      query: {},
      hash: '',
      fullPath: `/portal/orders/${TEST_ORDER_ID}`,
      name: 'portal-orders-id',
      matched: [],
      meta: {},
    }),
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

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      id: '1',
      publicId: TEST_ORDER_ID,
      createdAt: '2026-03-15T10:00:00Z',
      status: 'placed',
      currency: 'SEK',
      billingAddress: {
        company: 'Acme Corp',
        firstName: 'John',
        lastName: 'Doe',
        addressLine1: 'Storgatan 1',
        addressLine2: '',
        addressLine3: '',
        zip: '111 22',
        city: 'Stockholm',
        country: 'SE',
        phone: '08-123456',
        mobile: '070-1234567',
      },
      shippingAddress: {
        company: 'Acme Warehouse',
        firstName: 'Jane',
        lastName: 'Smith',
        addressLine1: 'Lagervagen 5',
        zip: '333 44',
        city: 'Gothenburg',
        country: 'SE',
      },
      cart: {
        items: [
          {
            product: {
              productId: 101,
              name: 'Widget Pro',
              articleNumber: 'ART-001',
              alias: 'widget-pro',
              productImages: [{ fileName: 'widget.jpg' }],
            },
            skuId: 1001,
            quantity: 3,
            unitPrice: {
              sellingPriceIncVat: 150,
              sellingPriceIncVatFormatted: '150,00 kr',
            },
            totalPrice: {
              sellingPriceIncVat: 450,
              sellingPriceIncVatFormatted: '450,00 kr',
            },
          },
          {
            product: {
              productId: 102,
              name: 'Gadget Plus',
              articleNumber: 'ART-002',
              alias: 'gadget-plus',
              productImages: [],
            },
            skuId: 1002,
            quantity: 1,
            unitPrice: {
              sellingPriceIncVat: 200,
              sellingPriceIncVatFormatted: '200,00 kr',
            },
            totalPrice: {
              sellingPriceIncVat: 200,
              sellingPriceIncVatFormatted: '200,00 kr',
            },
          },
        ],
        summary: {
          subTotal: {
            sellingPriceIncVat: 650,
            sellingPriceIncVatFormatted: '650,00 kr',
          },
          shipping: {
            feeIncVat: 49,
            feeIncVatFormatted: '49,00 kr',
          },
          total: {
            sellingPriceIncVat: 699,
            sellingPriceIncVatFormatted: '699,00 kr',
            vat: 139.8,
            vatFormatted: '139,80 kr',
          },
        },
      },
      orderTotal: {
        sellingPriceIncVat: 699,
        sellingPriceIncVatFormatted: '699,00 kr',
      },
      shippingFee: {
        sellingPriceIncVat: 49,
        sellingPriceIncVatFormatted: '49,00 kr',
      },
      vat: {
        sellingPriceIncVat: 139.8,
        sellingPriceIncVatFormatted: '139,80 kr',
      },
      paymentDetails: [{ name: 'Invoice' }],
      shippingDetails: [{ name: 'Standard Delivery' }],
      ...overrides,
    },
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
  NuxtLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  GeinsImage: {
    template: '<img :data-file-name="fileName" :alt="alt" />',
    props: ['fileName', 'type', 'alt', 'aspectRatio', 'sizes'],
  },
};

describe('OrderDetail', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockPending.value = false;
    mockStatus.value = 'success';
    mockUseFetch.mockClear();
    mockShowError.mockClear();
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      mockPending.value = true;

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-loading"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="order-detail"]').exists()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('calls showError with 404 when order not found', () => {
      mockData.value = null;
      mockError.value = new Error('Not found');

      shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockShowError).toHaveBeenCalled();
      const errorArg = mockShowError.mock.calls[0]![0] as Error & {
        statusCode: number;
      };
      expect(errorArg.statusCode).toBe(404);
    });

    it('calls showError with 404 when data has no order', () => {
      mockData.value = { order: null };

      shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockShowError).toHaveBeenCalled();
      const errorArg = mockShowError.mock.calls[0]![0] as Error & {
        statusCode: number;
      };
      expect(errorArg.statusCode).toBe(404);
    });
  });

  describe('order detail rendering', () => {
    it('renders order detail with correct data', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-detail"]').exists()).toBe(true);
      expect(wrapper.text()).toContain(TEST_ORDER_ID);
    });

    it('renders inside PortalShell', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });
  });

  describe('back link', () => {
    it('has a back link to the orders list', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const backLink = wrapper.find('[data-testid="back-link"]');
      expect(backLink.exists()).toBe(true);
      // localePath mock prepends /se/en
      expect(backLink.attributes('href')).toContain('/portal/orders');
    });
  });

  describe('action buttons', () => {
    it('renders all four action buttons', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const buttons = wrapper.find('[data-testid="action-buttons"]');
      expect(buttons.exists()).toBe(true);
      expect(buttons.text()).toContain(
        'portal.orders.detail.actions.new_order_same_data',
      );
      expect(buttons.text()).toContain(
        'portal.orders.detail.actions.download_invoice',
      );
      expect(buttons.text()).toContain(
        'portal.orders.detail.actions.other_communication',
      );
      expect(buttons.text()).toContain('portal.orders.detail.actions.reorder');
    });
  });

  describe('items table', () => {
    it('renders order items with product info', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const table = wrapper.find('[data-testid="order-items-table"]');
      expect(table.exists()).toBe(true);
      expect(table.text()).toContain('Widget Pro');
      expect(table.text()).toContain('ART-001');
      expect(table.text()).toContain('3');
      expect(table.text()).toContain('150,00 kr');
      expect(table.text()).toContain('450,00 kr');
    });

    it('renders all order items', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const rows = wrapper.findAll('[data-testid="order-item-row"]');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.text()).toContain('Widget Pro');
      expect(rows[1]!.text()).toContain('Gadget Plus');
    });
  });

  describe('summary sidebar', () => {
    it('shows subtotal, shipping, tax, and total', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const summary = wrapper.find('[data-testid="order-summary"]');
      expect(summary.exists()).toBe(true);
      expect(summary.text()).toContain('650,00 kr');
      expect(summary.text()).toContain('49,00 kr');
      expect(summary.text()).toContain('139,80 kr');
      expect(summary.text()).toContain('699,00 kr');
    });
  });

  describe('billing address', () => {
    it('shows billing address details', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const billing = wrapper.find('[data-testid="billing-address"]');
      expect(billing.exists()).toBe(true);
      expect(billing.text()).toContain('Acme Corp');
      expect(billing.text()).toContain('John');
      expect(billing.text()).toContain('Doe');
      expect(billing.text()).toContain('Storgatan 1');
      expect(billing.text()).toContain('111 22');
      expect(billing.text()).toContain('Stockholm');
    });
  });

  describe('shipping address', () => {
    it('shows shipping address when present', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const shipping = wrapper.find('[data-testid="shipping-address"]');
      expect(shipping.exists()).toBe(true);
      expect(shipping.text()).toContain('Acme Warehouse');
      expect(shipping.text()).toContain('Lagervagen 5');
      expect(shipping.text()).toContain('Gothenburg');
    });

    it('hides shipping address when not present', () => {
      mockData.value = makeOrder({ shippingAddress: undefined });

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="shipping-address"]').exists()).toBe(
        false,
      );
    });
  });

  describe('useFetch call', () => {
    it('calls useFetch with the correct order ID URL', () => {
      mockData.value = makeOrder();

      shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockUseFetch).toHaveBeenCalled();
      const [url] = mockUseFetch.mock.calls[0]!;
      expect(url).toBe(`/api/orders/${TEST_ORDER_ID}`);
    });
  });
});
