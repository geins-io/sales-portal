import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import type { AuthUser } from '@geins/types';
import { enableAutoUnmount } from '@vue/test-utils';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { shallowMountComponent } from '../../utils/component';
import OrderDetail from '../../../app/pages/portal/orders/[id].vue';
import LineSpecification from '../../../app/components/cart/LineSpecification.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';
import { mockIsCatalogMode, mockShowIncVat } from '../../setup-components';

// The route's query is reactive here, so a page left mounted would react to
// the next test's reset: its 404s and polls would count against that test.
enableAutoUnmount(afterEach);

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. The real chain then runs over the fixture below.
vi.unmock('../../../app/composables/useFeatureAccess');

// `isAuthenticated` is `!!user.value`, so identity is all this needs to carry.
const SIGNED_IN: AuthUser = {
  userId: '1',
  username: 'buyer@example.com',
};

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

// File level, not inside a describe: both of these live for the whole file, so
// a reset scoped to one block would leave the last test's signed-in user and
// access rule in place for every block after it.
//
// The default is the seeded one, `reorder: { enabled: true }`. It cannot be an
// empty features object: the page reads `canAccess('reorder')` with no
// `isFeatureConfigured` guard, and `canAccessFeature(undefined, user)` denies,
// so an unconfigured key takes the button away. That is how eight of the
// eleven consumers behave — what offers an action falls closed, and only the
// three composables that hide information fall open.
beforeEach(() => {
  setFeatures({ reorder: { enabled: true } });
  // Sign out: the Pinia store is shared across this file's tests.
  useAuthStore().user = null;
});

// Hoist mock state so it's available inside vi.mock factories
const {
  mockData,
  mockError,
  mockPending,
  mockStatus,
  mockShowError,
  mockCreateError,
  mockUseHead,
  mockQuery,
  mockReplace,
  mockPollFetch,
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
    // `?awaiting=`, the order the confirmation link says is on its way.
    mockQuery: ref<Record<string, string>>({}),
    mockReplace: vi.fn(() => Promise.resolve()),
    // The waiting poll calls `$fetch` directly, not the page's useFetch.
    mockPollFetch: vi.fn(),
  };
});

// Mock cart store
const mockAddItems = vi.fn().mockResolvedValue(undefined);
const mockCartStore = {
  addItems: mockAddItems,
  isLoading: false,
};

vi.mock('../../../app/stores/cart', () => ({
  useCartStore: () => mockCartStore,
}));

vi.stubGlobal('useCartStore', () => mockCartStore);

// Mock navigateTo
const mockNavigateTo = vi.fn();

// Mock definePageMeta (Nuxt macro)
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('showError', mockShowError);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('useHead', mockUseHead);

vi.mock('#app/composables/error', () => ({
  createError: (...args: Parameters<typeof mockCreateError>) =>
    mockCreateError(...args),
  showError: (...args: Parameters<typeof mockShowError>) =>
    mockShowError(...args),
}));

vi.mock('#app/composables/head', () => ({
  useHead: (...args: Parameters<typeof mockUseHead>) => mockUseHead(...args),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

// Mock route with an id param
const TEST_ORDER_ID = 'abc-123-def';
function testRoute() {
  return {
    params: { id: TEST_ORDER_ID },
    path: `/portal/orders/${TEST_ORDER_ID}`,
    // A getter, so dropping `?awaiting=` in a test reaches the page.
    get query() {
      return mockQuery.value;
    },
    hash: '',
    fullPath: `/portal/orders/${TEST_ORDER_ID}`,
    name: 'portal-orders-id',
    matched: [],
    meta: {},
  };
}

vi.stubGlobal('useRoute', testRoute);
vi.stubGlobal('$fetch', (...args: unknown[]) => mockPollFetch(...args));
// The page's auto-imported `$fetch` comes from here, read once when it loads.
vi.mock('#build/fetch', () => ({
  $fetch: (...args: unknown[]) => mockPollFetch(...args),
}));

vi.mock('#app/composables/router', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRoute: testRoute,
    useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
    navigateTo: (...args: Parameters<typeof mockNavigateTo>) =>
      mockNavigateTo(...args),
  };
});

// Mock useFetch
const mockUseFetch = vi.fn(
  (_url: string | (() => string), _options?: Record<string, unknown>) => ({
    data: mockData,
    error: mockError,
    status: mockStatus,
    pending: mockPending,
    refresh: vi.fn(),
    execute: vi.fn(),
  }),
);

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', mockUseFetch);

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
              sellingPriceExVat: 120,
              sellingPriceExVatFormatted: '120,00 kr',
            },
            totalPrice: {
              sellingPriceIncVat: 450,
              sellingPriceIncVatFormatted: '450,00 kr',
              sellingPriceExVat: 360,
              sellingPriceExVatFormatted: '360,00 kr',
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
              sellingPriceExVat: 160,
              sellingPriceExVatFormatted: '160,00 kr',
            },
            totalPrice: {
              sellingPriceIncVat: 200,
              sellingPriceIncVatFormatted: '200,00 kr',
              sellingPriceExVat: 160,
              sellingPriceExVatFormatted: '160,00 kr',
            },
          },
        ],
        summary: {
          subTotal: {
            sellingPriceIncVat: 650,
            sellingPriceIncVatFormatted: '650,00 kr',
            sellingPriceExVat: 520,
            sellingPriceExVatFormatted: '520,00 kr',
          },
          shipping: {
            feeIncVat: 49,
            feeIncVatFormatted: '49,00 kr',
            feeExVat: 39.2,
            feeExVatFormatted: '39,20 kr',
          },
          total: {
            sellingPriceIncVat: 699,
            sellingPriceIncVatFormatted: '699,00 kr',
            sellingPriceExVat: 559.2,
            sellingPriceExVatFormatted: '559,20 kr',
            vat: 139.8,
            vatFormatted: '139,80 kr',
          },
        },
      },
      orderTotal: {
        sellingPriceIncVat: 699,
        sellingPriceIncVatFormatted: '699,00 kr',
        sellingPriceExVat: 559.2,
        sellingPriceExVatFormatted: '559,20 kr',
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
  // Rendered for real: the page's rows, summary and addresses live in them.
  OrderItemsTable: false,
  OrderSummaryCard: false,
  OrderAddresses: false,
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
  AddressBlock: {
    template:
      '<div v-bind="$attrs"><p>{{ label }}</p><p v-if="address?.company">{{ address.company }}</p><p v-if="address?.firstName || address?.lastName">{{ address?.firstName }} {{ address?.lastName }}</p><p v-if="address?.addressLine1">{{ address.addressLine1 }}</p><p v-if="address?.addressLine2">{{ address.addressLine2 }}</p><p v-if="address?.addressLine3">{{ address.addressLine3 }}</p><p v-if="address?.zip || address?.city">{{ address?.zip }} {{ address?.city }}</p><p v-if="address?.country">{{ address.country }}</p></div>',
    props: ['label', 'icon', 'address'],
  },
  ProductThumbnail: {
    template:
      '<div class="product-thumbnail" :data-file-name="fileName" :data-alt="alt"></div>',
    props: ['fileName', 'alt', 'size', 'radius', 'iconSize'],
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
    mockUseHead.mockClear();
    mockAddItems.mockClear();
    mockNavigateTo.mockClear();
    mockAddItems.mockResolvedValue(undefined);
    mockShowIncVat.value = true;
    mockQuery.value = {};
    mockReplace.mockClear();
    mockPollFetch.mockReset();
  });

  // canReorder is `canAccess('reorder') && !isCatalogMode`, so each test has to
  // pin the half it is not about. Every case below leaves catalog mode at its
  // default false and varies only the configured value of `reorder`, except
  // the one catalog case, which does the opposite. One test per cell, each
  // naming the key, registered in tests/unit/config-coverage/map.ts.
  describe('reorder per mode and access', () => {
    afterEach(() => {
      mockIsCatalogMode.value = false;
    });

    function mountWithOrder() {
      mockData.value = makeOrder();
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }

    function hasReorderButton(): boolean {
      return mountWithOrder().find('[data-testid="reorder-button"]').exists();
    }

    it('renders the reorder button in commerce mode with reorder access', () => {
      setFeatures({ reorder: { enabled: true } });
      expect(hasReorderButton()).toBe(true);
    });

    it('hides the reorder button when mode is catalog', () => {
      // The access half is deliberately permissive, so only catalog mode can
      // be what takes the button away.
      setFeatures({ reorder: { enabled: true } });
      mockIsCatalogMode.value = true;
      expect(hasReorderButton()).toBe(false);
    });

    it('hides the reorder button when reorder is disabled', () => {
      setFeatures({ reorder: { enabled: false } });
      expect(hasReorderButton()).toBe(false);
    });

    it('renders the reorder button when reorder access is open to all', () => {
      setFeatures({ reorder: { enabled: true, access: 'all' } });
      expect(hasReorderButton()).toBe(true);
    });

    it('hides the reorder button when reorder requires authentication and the user is anonymous', () => {
      setFeatures({ reorder: { enabled: true, access: 'authenticated' } });
      expect(hasReorderButton()).toBe(false);
    });

    it('renders the reorder button when reorder requires authentication and the user is signed in', () => {
      setFeatures({ reorder: { enabled: true, access: 'authenticated' } });
      useAuthStore().user = SIGNED_IN;
      expect(hasReorderButton()).toBe(true);
    });
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      mockPending.value = true;

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-loading"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="order-detail"]').exists()).toBe(false);
      // An ordinary load is not a wait for a new order: no waiting text.
      expect(wrapper.find('[data-testid="order-loading"]').text()).toBe('');
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

  /**
   * Arriving from the confirmation page before the platform has the order.
   *
   * The link carries `?awaiting=<publicId>`. With it, a miss is a wait rather
   * than a 404: the page polls the order until it is readable, bounded. The
   * parameter is dropped as soon as the order is on screen, whichever response
   * brought it, so a reload starts no new wait.
   */
  describe('awaiting a just-placed order', () => {
    function notFound() {
      return Object.assign(new Error('Not found'), { statusCode: 404 });
    }

    function mount() {
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('drops the parameter when the order is there on the first response', async () => {
      mockQuery.value = { awaiting: TEST_ORDER_ID, tab: 'rows' };
      mockData.value = makeOrder();
      mount();

      await vi.advanceTimersByTimeAsync(0);

      expect(mockReplace).toHaveBeenCalledWith({ query: { tab: 'rows' } });
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockPollFetch).not.toHaveBeenCalled();
    });

    it('waits on a miss instead of showing a 404', async () => {
      mockQuery.value = { awaiting: TEST_ORDER_ID };
      mockError.value = notFound();
      mockPollFetch.mockRejectedValue(notFound());
      const wrapper = mount();

      await vi.advanceTimersByTimeAsync(5000);

      expect(mockShowError).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="order-loading"]').exists()).toBe(true);
      expect(mockPollFetch.mock.calls).toEqual([
        [`/api/orders/${TEST_ORDER_ID}`, { cache: 'no-store' }],
        [`/api/orders/${TEST_ORDER_ID}`, { cache: 'no-store' }],
      ]);
    });

    it('renders the order when it arrives, then drops the parameter', async () => {
      mockQuery.value = { awaiting: TEST_ORDER_ID };
      mockError.value = notFound();
      mockPollFetch.mockResolvedValue(makeOrder());
      const wrapper = mount();

      await vi.advanceTimersByTimeAsync(2500);

      expect(wrapper.find('[data-testid="order-detail"]').exists()).toBe(true);
      expect(mockReplace).toHaveBeenCalledWith({ query: {} });
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('keeps the order it waited for once the parameter is gone', async () => {
      mockQuery.value = { awaiting: TEST_ORDER_ID };
      mockError.value = notFound();
      mockPollFetch.mockResolvedValue(makeOrder());
      const wrapper = mount();
      await vi.advanceTimersByTimeAsync(2500);

      // What `router.replace` does, and a later refetch settling: the first
      // response's 404 is still on the fetch, but the order is on screen.
      mockQuery.value = {};
      mockPending.value = true;
      await wrapper.vm.$nextTick();
      mockPending.value = false;
      await wrapper.vm.$nextTick();

      expect(mockShowError).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="order-detail"]').exists()).toBe(true);
    });

    it('says it is fetching the order while it waits, as a status', () => {
      mockQuery.value = { awaiting: TEST_ORDER_ID };
      mockError.value = notFound();
      mockPollFetch.mockRejectedValue(notFound());
      const indicator = mount().find('[data-testid="order-loading"]');

      expect(indicator.attributes('role')).toBe('status');
      expect(indicator.text()).toBe('common.fetching_order');
    });

    it('at the bound, says it is slow and offers the way back, without a 404', async () => {
      mockQuery.value = { awaiting: TEST_ORDER_ID };
      mockError.value = notFound();
      mockPollFetch.mockRejectedValue(notFound());
      const wrapper = mount();

      await vi.advanceTimersByTimeAsync(115000);
      expect(wrapper.find('[data-testid="order-slow"]').exists()).toBe(false);

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockShowError).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="order-loading"]').exists()).toBe(
        false,
      );
      const slow = wrapper.find('[data-testid="order-slow"]');
      expect(slow.attributes('role')).toBe('status');
      expect(slow.text()).toContain('portal.orders.detail.order_slow');
      expect(slow.find('[data-testid="back-link"]').attributes('href')).toBe(
        '/se/en/portal/orders',
      );
      // Kept, so a reload waits again.
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('shows the 404 at once without the parameter, and does not wait', async () => {
      mockError.value = notFound();
      mount();

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockShowError).toHaveBeenCalledTimes(1);
      expect(mockPollFetch).not.toHaveBeenCalled();
    });

    it('does not wait for a different order than the one on the page', async () => {
      mockQuery.value = { awaiting: 'some-other-order' };
      mockError.value = notFound();
      mount();

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockShowError).toHaveBeenCalledTimes(1);
      expect(mockPollFetch).not.toHaveBeenCalled();
    });
  });

  describe('order detail rendering', () => {
    it('renders order detail with correct data', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-detail"]').exists()).toBe(true);
      const headerText = wrapper.find('[data-testid="order-header"]').text();
      expect(headerText).toContain('portal.orders.detail.title');
      expect(headerText).toContain('1');
    });

    it('renders inside PortalShell', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });

    function statusBadgeText(status: string): string {
      mockData.value = makeOrder({ status });
      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
      return wrapper.find('[data-testid="status-badge"]').text();
    }

    it('translates a Geins status outside the original six', () => {
      expect(statusBadgeText('backorder')).toBe(
        'portal.orders.status.backorder',
      );
    });

    it('shows an unknown status as readable text, not a key path', () => {
      expect(statusBadgeText('ready-for-pickup')).toBe('Ready for pickup');
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

  describe('action toolbar', () => {
    it('renders the action toolbar container', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(
        wrapper.find('[data-testid="order-action-toolbar"]').exists(),
      ).toBe(true);
    });

    it('has back link inside the toolbar', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const toolbar = wrapper.find('[data-testid="order-action-toolbar"]');
      const backLink = toolbar.find('[data-testid="back-link"]');
      expect(backLink.exists()).toBe(true);
      expect(backLink.attributes('href')).toContain('/portal/orders');
    });

    it('renders the reorder action in the toolbar without a communication button', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const toolbar = wrapper.find('[data-testid="order-action-toolbar"]');
      expect(toolbar.exists()).toBe(true);
      expect(toolbar.text()).toContain('portal.orders.detail.actions.reorder');
      expect(toolbar.text()).not.toContain(
        'portal.orders.detail.actions.order_communication',
      );
      expect(toolbar.text()).not.toContain(
        'portal.orders.detail.actions.view_additional_data',
      );
      expect(toolbar.text()).not.toContain(
        'portal.orders.detail.actions.download_receipt',
      );
    });

    it('renders the reorder button and no communication button', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(
        wrapper.find('[data-testid="order-communication-button"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="reorder-button"]').exists()).toBe(
        true,
      );
      expect(
        wrapper.find('[data-testid="view-additional-data-button"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="download-receipt-button"]').exists(),
      ).toBe(false);
    });

    it('reorder button uses the primary store-settings color (no explicit variant)', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: {
          stubs: {
            ...defaultStubs,
            Button: {
              template:
                '<button v-bind="$attrs" :data-variant="variant" @click="$emit(\'click\')"><slot /></button>',
              props: ['variant'],
              emits: ['click'],
            },
          },
        },
      });

      const reorder = wrapper.find('[data-testid="reorder-button"]');
      // The Reorder button does not declare a variant prop so it falls back
      // to the Button component's default (primary, theme-driven).
      expect(reorder.attributes('data-variant')).toBeUndefined();
    });
  });

  describe('order message', () => {
    it('renders the order message grey box when a message exists', () => {
      mockData.value = makeOrder({
        message: 'Please deliver to the back door.',
      });

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const box = wrapper.find('[data-testid="order-message"]');
      expect(box.exists()).toBe(true);
      expect(box.text()).toContain('portal.orders.detail.order_message');
      expect(box.text()).toContain('Please deliver to the back door.');
    });

    it('does not render the order message box when no message exists', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-message"]').exists()).toBe(
        false,
      );
    });

    it('does not render the order message box when the message is empty', () => {
      mockData.value = makeOrder({ message: '' });

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-message"]').exists()).toBe(
        false,
      );
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

    it('names the ordered SKU after the article number', () => {
      const data = makeOrder();
      const [first] = data.order.cart.items;
      // The order's product carries only the ordered SKU, its id a string.
      Object.assign(first!.product, { skus: [{ skuId: '1001', name: 'L' }] });
      mockData.value = data;

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const cells = wrapper.findAll('[data-testid="order-item-article-cell"]');
      expect(cells.map((c) => c.text())).toEqual(['ART-001 • L', 'ART-002']);
      const numbers = wrapper.findAll(
        '[data-testid="order-item-article-number"]',
      );
      expect(numbers.map((n) => n.text())).toEqual(['ART-001', 'ART-002']);
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

    it('renders in-table totals footer with 4 rows', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const footer = wrapper.find('[data-testid="order-items-footer"]');
      expect(footer.exists()).toBe(true);
      const rows = footer.findAll('tr');
      expect(rows).toHaveLength(4);
    });

    it('subtotal row in footer uses subtotal_with_count i18n key', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const footer = wrapper.find('[data-testid="order-items-footer"]');
      // i18n mock renders key literals — confirm the key is used (not the plain subtotal key)
      expect(footer.text()).toContain(
        'portal.orders.detail.summary.subtotal_with_count',
      );
    });

    it('in-table footer total amount matches sidebar total', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const footer = wrapper.find('[data-testid="order-items-footer"]');
      const sidebar = wrapper.find('[data-testid="order-summary"]');
      // Both should show the same total formatted value
      expect(footer.text()).toContain('699,00 kr');
      expect(sidebar.text()).toContain('699,00 kr');
    });

    it('column header for unit price uses unit_price i18n key (à price)', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const table = wrapper.find('[data-testid="order-items-table"]');
      // The i18n mock renders the key — verify it's present in headers
      expect(table.text()).toContain('portal.orders.detail.items.unit_price');
    });
  });

  describe('a configured row', () => {
    const SUMMARY = [
      { label: 'Machine weight (7-20)', value: '12 t' },
      { label: 'Adapter', value: 'S45' },
    ];
    const OTHER_SUMMARY = [{ label: 'Adapter', value: 'S60' }];

    /** Two configured rows of one product and SKU, after a plain one. */
    function configuredOrder(otherSummary = OTHER_SUMMARY) {
      const base = makeOrder();
      const [plain] = base.order.cart.items;
      const configured = {
        product: {
          productId: 1359,
          name: 'Tiltrotator',
          articleNumber: 'TR-1',
          alias: 'tiltrotator',
          canonicalUrl: '/se/sv/redskap/tiltrotator',
          productImages: [],
        },
        skuId: 2001,
        quantity: 1,
        unitPrice: {
          sellingPriceIncVat: 2711.08,
          sellingPriceIncVatFormatted: '2 711,08 kr',
        },
        totalPrice: {
          sellingPriceIncVat: 2711.08,
          sellingPriceIncVatFormatted: '2 711,08 kr',
        },
      };
      return makeOrder({
        cart: {
          ...base.order.cart,
          items: [
            plain,
            { ...configured, configuration: { summary: SUMMARY } },
            { ...configured, configuration: { summary: otherSummary } },
          ],
        },
      });
    }

    function mountOrder(otherSummary = OTHER_SUMMARY) {
      mockData.value = configuredOrder(otherSummary);
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }

    it('offers each row its own specification in the table, handed the row, and none on a plain row', () => {
      const wrapper = mountOrder();

      const rows = wrapper.findAll('[data-testid="order-item-row"]');
      expect(rows).toHaveLength(3);
      /** The props of each specification in a row. */
      const specOf = (index: number): Record<string, unknown>[] =>
        rows[index]!.findAllComponents(LineSpecification).map(
          (block: { props: () => Record<string, unknown> }) => block.props(),
        );
      expect(specOf(0)).toEqual([]);
      expect(specOf(1)).toEqual([
        {
          id: 'order-item-configuration-1',
          productName: 'Tiltrotator',
          quantity: 1,
          configuration: { summary: SUMMARY },
          unitPrice: configuredOrder().order.cart.items[1]!.unitPrice,
          totalPrice: configuredOrder().order.cart.items[1]!.totalPrice,
        },
      ]);
      expect(specOf(2).map((props) => props.configuration)).toEqual([
        { summary: OTHER_SUMMARY },
      ]);
      expect(specOf(1)[0]!.id).not.toBe(specOf(2)[0]!.id);
    });

    it('offers a row committed with the defaults only its specification too', () => {
      const row = mountOrder([]).findAll('[data-testid="order-item-row"]')[2]!;

      expect(
        row
          .findAllComponents(LineSpecification)
          .map(
            (block: { props: () => Record<string, unknown> }) =>
              block.props().configuration,
          ),
      ).toEqual([{ summary: [] }]);
    });

    // Opening a summary makes the row taller; its other cells stay on the
    // title's line instead of following the row's middle down.
    it('aligns a configured row to the top and leaves a plain row as it was', () => {
      const rows = mountOrder().findAll('[data-testid="order-item-row"]');

      expect(rows.map((row) => row.classes('align-top'))).toEqual([
        false,
        true,
        true,
      ]);
    });

    it('marks a configured row "Konfigurerad produkt" under its name, and no plain row', () => {
      const rows = mountOrder().findAll('[data-testid="order-item-row"]');

      expect(
        rows.map((row) =>
          row.find('[data-testid="order-item-configured"]').exists(),
        ),
      ).toEqual([false, true, true]);
      const cell = rows[1]!.find('td');
      expect(cell.find('[data-testid="order-item-configured"]').text()).toBe(
        'cart.configured_product',
      );
      expect(cell.html().indexOf('order-item-name')).toBeLessThan(
        cell.html().indexOf('order-item-configured'),
      );
    });

    it('renders two rows of one SKU without a duplicate key', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const wrapper = mountOrder();
      // Vue checks keys when it moves rows in a patch, not on the first
      // render, so the same rows arrive again in another order.
      const reordered = configuredOrder();
      reordered.order.cart.items.reverse();
      mockData.value = reordered;
      await wrapper.vm.$nextTick();

      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).includes('Duplicate keys'),
        ),
      ).toEqual([]);
      warn.mockRestore();
    });

    it("links a configured row's name to its configurator page with that row's choices, and a plain row's as before", () => {
      const wrapper = mountOrder();

      const links = wrapper
        .findAll('[data-testid="order-item-row"]')
        .map((row) =>
          row.find('[data-testid="order-item-name-link"]').attributes('href'),
        );
      expect(links[0]).not.toContain('?');
      expect(links[1]).toBe(
        `/se/en/p/redskap/tiltrotator?order=${TEST_ORDER_ID}&row=1`,
      );
      expect(links[2]).toBe(
        `/se/en/p/redskap/tiltrotator?order=${TEST_ORDER_ID}&row=2`,
      );
    });

    it('links a configured row without a canonical path to its product page as before, since the redirect would drop the replay', () => {
      const order = configuredOrder();
      const row = order.order.cart.items[1] as {
        product: { canonicalUrl?: string };
      };
      delete row.product.canonicalUrl;
      mockData.value = order;
      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const link = wrapper
        .findAll('[data-testid="order-item-row"]')[1]!
        .find('[data-testid="order-item-name-link"]');
      expect(link.attributes('href')).toBe('/se/en/p/tiltrotator');
      const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
      expect((sheet.props('items') as { href?: string }[])[1]!.href).toBe(
        undefined,
      );
    });

    it('hands the mobile sheet the same links, and none for a plain row', () => {
      const wrapper = mountOrder();

      const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
      const items = sheet.props('items') as { href?: string }[];
      expect(items.map((item) => item.href)).toEqual([
        undefined,
        `/se/en/p/redskap/tiltrotator?order=${TEST_ORDER_ID}&row=1`,
        `/se/en/p/redskap/tiltrotator?order=${TEST_ORDER_ID}&row=2`,
      ]);
    });

    it('hands the mobile sheet one row per order row, each with its own key, configuration and prices', () => {
      const wrapper = mountOrder();
      const order = configuredOrder().order;

      const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
      const items = sheet.props('items') as {
        key: string;
        configuration?: { summary: unknown };
        unitPrice?: unknown;
        totalPrice?: unknown;
      }[];
      expect(items.map((item) => item.configuration)).toEqual([
        undefined,
        { summary: SUMMARY },
        { summary: OTHER_SUMMARY },
      ]);
      expect(items.map((item) => [item.unitPrice, item.totalPrice])).toEqual(
        order.cart.items.map((item) => [item.unitPrice, item.totalPrice]),
      );
      expect(new Set(items.map((item) => item.key)).size).toBe(3);
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

    it('sidebar subtotal uses subtotal_with_count i18n key', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const summary = wrapper.find('[data-testid="order-summary"]');
      expect(summary.text()).toContain(
        'portal.orders.detail.summary.subtotal_with_count',
      );
    });
  });

  describe('prices follow the VAT choice', () => {
    function mountDefault() {
      mockData.value = makeOrder();
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }

    function texts(wrapper: ReturnType<typeof mountDefault>, id: string) {
      return wrapper.findAll(`[data-testid="${id}"]`).map((el) => el.text());
    }

    function sheetValues(wrapper: ReturnType<typeof mountDefault>) {
      const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
      const items = sheet.props('items') as {
        unitPriceFormatted?: string;
        totalPriceFormatted?: string;
      }[];
      const totals = sheet.props('totals') as { value?: string }[];
      return {
        rows: items.map((i) => [i.unitPriceFormatted, i.totalPriceFormatted]),
        totals: totals.map((row) => row.value),
      };
    }

    it.each([
      [true, 'common.vat_included'],
      [false, 'common.vat'],
    ])(
      'labels the VAT row by the chosen side on the card, the table and the sheet (incl. VAT: %s)',
      (incVat, label) => {
        mockShowIncVat.value = incVat;
        const wrapper = mountDefault();
        const tax = wrapper.find('[data-testid="order-summary-tax"]');
        const footerLabels = wrapper.findAll('tfoot td').map((td) => td.text());
        const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
        const sheetLabels = (sheet.props('totals') as { label: string }[]).map(
          (row) => row.label,
        );

        expect(tax.element.previousElementSibling?.textContent?.trim()).toBe(
          label,
        );
        expect(footerLabels).toContain(label);
        expect(sheetLabels).toContain(label);
        expect(wrapper.text()).not.toContain('summary.tax');
      },
    );

    it('shows every amount inc VAT when inc is chosen', () => {
      mockShowIncVat.value = true;
      const wrapper = mountDefault();

      expect(texts(wrapper, 'order-item-unit-price')).toEqual([
        '150,00 kr',
        '200,00 kr',
      ]);
      expect(texts(wrapper, 'order-item-total-price')).toEqual([
        '450,00 kr',
        '200,00 kr',
      ]);
      expect(
        wrapper.find('[data-testid="order-items-footer"]').text(),
      ).toContain('650,00 kr');
      expect(
        wrapper.find('[data-testid="order-items-footer-total"]').text(),
      ).toBe('699,00 kr');
      expect(
        wrapper.find('[data-testid="order-summary-subtotal"]').text(),
      ).toBe('650,00 kr');
      expect(
        wrapper.find('[data-testid="order-summary-shipping"]').text(),
      ).toBe('49,00 kr');
      expect(wrapper.find('[data-testid="order-summary-total"]').text()).toBe(
        '699,00 kr',
      );
      expect(sheetValues(wrapper)).toEqual({
        rows: [
          ['150,00 kr', '450,00 kr'],
          ['200,00 kr', '200,00 kr'],
        ],
        totals: ['650,00 kr', '49,00 kr', '139,80 kr', '699,00 kr'],
      });
    });

    it('shows every amount ex VAT when ex is chosen, VAT unchanged', () => {
      mockShowIncVat.value = false;
      const wrapper = mountDefault();

      expect(texts(wrapper, 'order-item-unit-price')).toEqual([
        '120,00 kr',
        '160,00 kr',
      ]);
      expect(texts(wrapper, 'order-item-total-price')).toEqual([
        '360,00 kr',
        '160,00 kr',
      ]);
      const footer = wrapper.find('[data-testid="order-items-footer"]').text();
      expect(footer).toContain('520,00 kr');
      expect(footer).toContain('39,20 kr');
      expect(footer).toContain('139,80 kr');
      expect(footer).not.toContain('650,00 kr');
      expect(
        wrapper.find('[data-testid="order-items-footer-total"]').text(),
      ).toBe('559,20 kr');
      expect(
        wrapper.find('[data-testid="order-summary-subtotal"]').text(),
      ).toBe('520,00 kr');
      expect(
        wrapper.find('[data-testid="order-summary-shipping"]').text(),
      ).toBe('39,20 kr');
      expect(wrapper.find('[data-testid="order-summary-tax"]').text()).toBe(
        '139,80 kr',
      );
      expect(wrapper.find('[data-testid="order-summary-total"]').text()).toBe(
        '559,20 kr',
      );
      expect(sheetValues(wrapper)).toEqual({
        rows: [
          ['120,00 kr', '360,00 kr'],
          ['160,00 kr', '160,00 kr'],
        ],
        totals: [
          '520,00 kr',
          '39,20 kr',
          '139,80 kr',
          '559,20 kr',
          '699,00 kr',
        ],
      });
    });

    it('falls back to the order total of the same side, never the other side', () => {
      mockShowIncVat.value = false;
      const base = makeOrder().order;
      mockData.value = makeOrder({
        cart: {
          ...base.cart,
          summary: {
            ...base.cart.summary,
            total: {
              sellingPriceIncVat: 699,
              sellingPriceIncVatFormatted: '699,00 kr',
              vatFormatted: '139,80 kr',
            },
          },
        },
      });
      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="order-summary-total"]').text()).toBe(
        '559,20 kr',
      );
    });
  });

  describe('where priceVisibility hides prices', () => {
    function mountOrder() {
      mockData.value = makeOrder();
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }
    const sheetShowsPrices = (wrapper: ReturnType<typeof mountOrder>) =>
      wrapper
        .findComponent({ name: 'PortalItemRowsSheet' })
        .props('showPrices');

    it('shows the amounts and lets the sheet show them when priceVisibility is enabled', () => {
      setFeatures({
        reorder: { enabled: true },
        priceVisibility: { enabled: true },
      });
      const wrapper = mountOrder();

      expect(wrapper.find('[data-testid="order-summary"]').exists()).toBe(true);
      expect(
        wrapper.findAll('[data-testid="order-item-unit-price"]'),
      ).toHaveLength(2);
      expect(sheetShowsPrices(wrapper)).toBe(true);
    });

    it('shows the rows with no amount and hides them in the sheet when priceVisibility is disabled', () => {
      setFeatures({
        reorder: { enabled: true },
        priceVisibility: { enabled: false },
      });
      const wrapper = mountOrder();

      expect(wrapper.findAll('[data-testid="order-item-row"]')).toHaveLength(2);
      expect(wrapper.find('[data-testid="order-summary"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.find('[data-testid="order-item-unit-price"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="order-items-footer"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).not.toContain('kr');
      expect(sheetShowsPrices(wrapper)).toBe(false);
    });
  });

  describe('the inc-VAT total under an ex-VAT total', () => {
    type Total = {
      sellingPriceIncVat?: number;
      sellingPriceIncVatFormatted?: string;
      sellingPriceExVat?: number;
      sellingPriceExVatFormatted?: string;
    };

    function mountWith(totals?: { summary?: Total; order?: Total }) {
      const base = makeOrder().order;
      mockData.value = totals
        ? makeOrder({
            cart: {
              ...base.cart,
              summary: {
                ...base.cart.summary,
                total: { vatFormatted: '139,80 kr', ...totals.summary },
              },
            },
            orderTotal: totals.order,
          })
        : makeOrder();
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }

    function read(wrapper: ReturnType<typeof mountWith>) {
      const row = (id: string) => {
        const value = wrapper.find(`[data-testid="${id}"]`);
        return value.exists()
          ? [
              value.element.previousElementSibling?.textContent?.trim(),
              value.text(),
            ]
          : null;
      };
      const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
      const totals = sheet.props('totals') as {
        label: string;
        value?: string;
      }[];
      return {
        card: row('order-summary-total-inc-vat'),
        table: row('order-items-footer-total-inc-vat'),
        sheet: totals.slice(4).map((r) => [r.label, r.value]),
      };
    }

    const NONE = { card: null, table: null, sheet: [] };

    it('shows "Totalt inkl. moms" under the total on the card, the table and the sheet in ex mode', () => {
      mockShowIncVat.value = false;
      const row = ['common.total_inc_vat', '699,00 kr'];

      expect(read(mountWith())).toEqual({
        card: row,
        table: row,
        sheet: [row],
      });
    });

    it('adds no row in inc mode', () => {
      mockShowIncVat.value = true;
      const wrapper = mountWith();

      expect(read(wrapper)).toEqual(NONE);
      expect(wrapper.text()).not.toContain('common.total_inc_vat');
    });

    it('takes the order total when the summary has no inc amount', () => {
      mockShowIncVat.value = false;
      const row = ['common.total_inc_vat', '699,00 kr'];

      expect(
        read(
          mountWith({
            summary: {
              sellingPriceExVat: 559.2,
              sellingPriceExVatFormatted: '559,20 kr',
            },
            order: {
              sellingPriceIncVat: 699,
              sellingPriceIncVatFormatted: '699,00 kr',
              sellingPriceExVat: 559.2,
              sellingPriceExVatFormatted: '559,20 kr',
            },
          }),
        ),
      ).toEqual({ card: row, table: row, sheet: [row] });
    });

    it.each([
      [
        'missing',
        {
          summary: {
            sellingPriceExVat: 559.2,
            sellingPriceExVatFormatted: '559,20 kr',
          },
          order: {
            sellingPriceExVat: 559.2,
            sellingPriceExVatFormatted: '559,20 kr',
          },
        },
      ],
      [
        '0',
        {
          summary: {
            sellingPriceIncVat: 0,
            sellingPriceIncVatFormatted: '0,00 kr',
            sellingPriceExVat: 559.2,
            sellingPriceExVatFormatted: '559,20 kr',
          },
          order: {
            sellingPriceIncVat: 0,
            sellingPriceIncVatFormatted: '0,00 kr',
            sellingPriceExVat: 559.2,
            sellingPriceExVatFormatted: '559,20 kr',
          },
        },
      ],
    ])(
      'hides the row when the inc amount is %s, and never puts the ex amount under the inc label',
      (_, totals) => {
        mockShowIncVat.value = false;
        const wrapper = mountWith(totals);

        expect(read(wrapper)).toEqual(NONE);
        expect(wrapper.text()).not.toContain('common.total_inc_vat');
        expect(wrapper.find('[data-testid="order-summary-total"]').text()).toBe(
          '559,20 kr',
        );
      },
    );
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

    it('wraps billing + shipping in a single grey container', () => {
      mockData.value = makeOrder();

      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      const billing = wrapper.find('[data-testid="billing-address"]');
      const shipping = wrapper.find('[data-testid="shipping-address"]');
      // Both blocks share the same parent and that parent carries the
      // grey rounded container styling.
      expect(billing.element.parentElement).toBe(
        shipping.element.parentElement,
      );
      const parentClass =
        billing.element.parentElement?.getAttribute('class') ?? '';
      expect(parentClass).toContain('bg-muted');
      expect(parentClass).toContain('rounded-lg');
    });
  });

  describe('useFetch call', () => {
    it('calls useFetch with the correct order ID URL', () => {
      mockData.value = makeOrder();

      shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockUseFetch).toHaveBeenCalled();
      const [urlOrFn] = mockUseFetch.mock.calls[0]!;
      const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
      expect(url).toBe(`/api/orders/${TEST_ORDER_ID}`);
    });
  });

  describe('page title', () => {
    it('sets page title with order ID via useHead', () => {
      mockData.value = makeOrder();

      shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });

      expect(mockUseHead).toHaveBeenCalled();
    });
  });

  describe('reorder action', () => {
    function mountOrder(order = makeOrder()) {
      mockData.value = order;
      return shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
    }

    async function reorder(wrapper: ReturnType<typeof mountOrder>) {
      await wrapper.find('[data-testid="reorder-button"]').trigger('click');
      await vi.dynamicImportSettled();
    }

    it('adds all order items to cart in one bulk add when reorder button is clicked', async () => {
      const wrapper = mountOrder();
      expect(wrapper.find('[data-testid="reorder-button"]').exists()).toBe(
        true,
      );

      await reorder(wrapper);

      expect(mockAddItems.mock.calls).toEqual([
        [
          [
            { skuId: 1001, quantity: 3 },
            { skuId: 1002, quantity: 1 },
          ],
          0,
        ],
      ]);
    });

    it('stays on the order after reorder, and the store opens the cart drawer', async () => {
      await reorder(mountOrder());

      expect(mockAddItems).toHaveBeenCalledTimes(1);
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('shows loading state on reorder button while adding items', async () => {
      let resolveAdd!: () => void;
      mockAddItems.mockImplementation(
        () => new Promise<void>((r) => (resolveAdd = r)),
      );
      const wrapper = mountOrder();

      wrapper.find('[data-testid="reorder-button"]').trigger('click');
      await wrapper.vm.$nextTick();

      expect(
        wrapper.find('[data-testid="reorder-button"]').attributes('disabled'),
      ).toBeDefined();

      resolveAdd();
      await vi.dynamicImportSettled();
    });

    it('skips items without skuId', async () => {
      const wrapper = mountOrder(
        makeOrder({
          cart: {
            items: [
              { product: { name: 'No SKU' }, skuId: undefined, quantity: 1 },
              { product: { name: 'Has SKU' }, skuId: 2001, quantity: 2 },
            ],
            summary: {},
          },
        }),
      );

      await reorder(wrapper);

      expect(mockAddItems.mock.calls).toEqual([
        [[{ skuId: 2001, quantity: 2 }], 0],
      ]);
    });

    it('leaves out a configured row and a configurable one, and hands the cart the count', async () => {
      setFeatures({
        reorder: { enabled: true },
      });
      useAuthStore().user = SIGNED_IN;
      const base = makeOrder();
      const [plain] = base.order.cart.items;
      const configurable = {
        product: { productId: 1359, name: 'Bucket', configurable: true },
        skuId: 1652,
        quantity: 1,
      };
      const wrapper = mountOrder(
        makeOrder({
          cart: {
            ...base.order.cart,
            items: [
              plain,
              configurable,
              {
                ...configurable,
                configuration: { summary: [{ label: 'A', value: 'B' }] },
              },
            ],
          },
        }),
      );

      await reorder(wrapper);

      expect(mockAddItems.mock.calls).toEqual([
        [[{ skuId: 1001, quantity: 3 }], 2],
      ]);
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    // The button and the click share one rule: an order where "Beställ igen"
    // would add nothing shows no button.
    describe('an order with configured rows', () => {
      const configured = {
        product: { productId: 1359, name: 'Bucket', configurable: true },
        skuId: 1652,
        quantity: 1,
        configuration: { summary: [{ label: 'A', value: 'B' }] },
      };

      function orderOf(items: unknown[]) {
        const base = makeOrder();
        return makeOrder({ cart: { ...base.order.cart, items } });
      }

      beforeEach(() => {
        setFeatures({
          reorder: { enabled: true },
        });
        useAuthStore().user = SIGNED_IN;
      });

      it('offers no "Beställ igen" when every row is configured', () => {
        const wrapper = mountOrder(orderOf([configured, { ...configured }]));

        expect(wrapper.find('[data-testid="reorder-button"]').exists()).toBe(
          false,
        );
      });

      it('offers it on a mix, and adds the ordinary rows with the count skipped', async () => {
        const [plain] = makeOrder().order.cart.items;
        const wrapper = mountOrder(orderOf([plain, configured]));

        await reorder(wrapper);

        expect(mockAddItems.mock.calls).toEqual([
          [[{ skuId: 1001, quantity: 3 }], 1],
        ]);
      });

      it('offers it on an order of ordinary rows only', async () => {
        const wrapper = mountOrder(orderOf(makeOrder().order.cart.items));

        await reorder(wrapper);

        expect(mockAddItems.mock.calls).toEqual([
          [
            [
              { skuId: 1001, quantity: 3 },
              { skuId: 1002, quantity: 1 },
            ],
            0,
          ],
        ]);
      });
    });
  });

  describe('additional information', () => {
    it('renders the additional info section when fields are present', () => {
      mockData.value = makeOrder({
        customerOrderNumber: 'PO-421FE',
        goodsLabel: 'labeltext',
        desiredDeliveryDate: '2025-01-12T00:00:00Z',
      });
      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
      const section = wrapper.find('[data-testid="order-additional-info"]');
      expect(section.exists()).toBe(true);
      expect(section.text()).toContain('PO-421FE');
      expect(section.text()).toContain('labeltext');
      expect(section.text()).toContain('2025-01-12');
    });

    it('renders only the fields that are present', () => {
      mockData.value = makeOrder({ customerOrderNumber: 'PO-ONLY' });
      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="order-additional-info"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="additional-your-reference"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="additional-goods-label"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="additional-delivery-date"]').exists(),
      ).toBe(false);
    });

    it('hides the additional info section when every field is absent', () => {
      // The payment method lives in this block too, so it goes as well.
      mockData.value = makeOrder({ paymentDetails: [] });
      const wrapper = shallowMountComponent(OrderDetail, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="order-additional-info"]').exists(),
      ).toBe(false);
    });
  });
});

/**
 * Fees on a placed order: a row only when the order carries the fee (> 0), on
 * the chosen VAT side, in the card, the table footer and the mobile sheet.
 */
describe('OrderDetail — fees', () => {
  const PAYMENT_FEE = {
    sellingPriceIncVat: 25,
    sellingPriceIncVatFormatted: '25,00 kr',
    sellingPriceExVat: 20,
    sellingPriceExVatFormatted: '20,00 kr',
  };
  const NO_SHIPPING = {
    feeIncVat: 0,
    feeIncVatFormatted: '0,00 kr',
    feeExVat: 0,
    feeExVatFormatted: '0,00 kr',
  };

  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockPending.value = false;
    mockQuery.value = {};
    mockShowIncVat.value = true;
  });

  function mountWith(overrides: Record<string, unknown>) {
    mockData.value = makeOrder(overrides);
    return shallowMountComponent(OrderDetail, {
      global: { stubs: defaultStubs },
    });
  }

  function orderWithShipping(
    shipping: Record<string, unknown> | undefined,
    shippingFee?: Record<string, unknown>,
  ) {
    const { order } = makeOrder();
    const cart = order.cart as { summary: Record<string, unknown> };
    return {
      cart: { ...cart, summary: { ...cart.summary, shipping } },
      shippingFee,
    };
  }

  function sheetTotals(wrapper: ReturnType<typeof mountWith>) {
    const sheet = wrapper.findComponent({ name: 'PortalItemRowsSheet' });
    return (sheet.props('totals') as { label: string; value?: string }[]).map(
      (row) => row.label,
    );
  }

  it.each([
    [
      'a zero fee',
      NO_SHIPPING,
      { sellingPriceIncVat: 0, sellingPriceExVat: 0 },
    ],
    ['no fee at all', undefined, undefined],
  ])('shows no shipping row for %s', (_, shipping, shippingFee) => {
    const wrapper = mountWith(orderWithShipping(shipping, shippingFee));

    expect(
      wrapper.find('[data-testid="order-summary-shipping"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="order-items-footer-shipping"]').exists(),
    ).toBe(false);
    expect(sheetTotals(wrapper)).not.toContain(
      'portal.orders.detail.summary.shipping',
    );
  });

  it.each([
    [true, '49,00 kr'],
    [false, '39,20 kr'],
  ])(
    'shows the shipping row on the chosen side (incl. VAT: %s)',
    (incVat, value) => {
      mockShowIncVat.value = incVat;
      const wrapper = mountWith({});

      expect(
        wrapper.find('[data-testid="order-summary-shipping"]').text(),
      ).toBe(value);
      expect(
        wrapper.find('[data-testid="order-items-footer-shipping"]').text(),
      ).toBe(value);
      expect(sheetTotals(wrapper)).toContain(
        'portal.orders.detail.summary.shipping',
      );
    },
  );

  it.each([
    // The cart summary carries only the other side; the order's own fee fills
    // the side being read.
    [true, { feeExVat: 1, feeExVatFormatted: '1,00 kr' }, '62,50 kr'],
    [false, { feeIncVat: 1, feeIncVatFormatted: '1,00 kr' }, '50,00 kr'],
  ])(
    "falls back to the order's shipping fee, field by field (incl. VAT: %s)",
    (incVat, shipping, value) => {
      mockShowIncVat.value = incVat;
      const wrapper = mountWith(
        orderWithShipping(shipping, {
          sellingPriceIncVat: 62.5,
          sellingPriceIncVatFormatted: '62,50 kr',
          sellingPriceExVat: 50,
          sellingPriceExVatFormatted: '50,00 kr',
        }),
      );

      expect(
        wrapper.find('[data-testid="order-summary-shipping"]').text(),
      ).toBe(value);
    },
  );

  it.each([
    [true, '25,00 kr'],
    [false, '20,00 kr'],
  ])(
    'shows the payment fee on the chosen side (incl. VAT: %s)',
    (incVat, value) => {
      mockShowIncVat.value = incVat;
      const wrapper = mountWith({ paymentFee: PAYMENT_FEE });

      expect(
        wrapper.find('[data-testid="order-summary-payment-fee"]').text(),
      ).toBe(value);
      expect(
        wrapper.find('[data-testid="order-items-footer-payment-fee"]').text(),
      ).toBe(value);
      expect(sheetTotals(wrapper)).toContain('common.payment_fee');
    },
  );

  it.each([
    ['a zero fee', { sellingPriceIncVat: 0, sellingPriceExVat: 0 }],
    ['no fee at all', undefined],
  ])('shows no payment-fee row for %s', (_, paymentFee) => {
    const wrapper = mountWith({ paymentFee });

    expect(
      wrapper.find('[data-testid="order-summary-payment-fee"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="order-items-footer-payment-fee"]').exists(),
    ).toBe(false);
    expect(sheetTotals(wrapper)).not.toContain('common.payment_fee');
  });
});

describe('OrderDetail — discount, payment method and the inc-VAT label', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockPending.value = false;
    mockQuery.value = {};
    mockShowIncVat.value = true;
  });

  function mountWith(overrides: Record<string, unknown>) {
    mockData.value = makeOrder(overrides);
    return shallowMountComponent(OrderDetail, {
      global: { stubs: defaultStubs },
    });
  }

  function withDiscount(inc: number | undefined, ex: number | undefined) {
    const { order } = makeOrder();
    const cart = order.cart as { summary: Record<string, unknown> };
    return {
      cart: {
        ...cart,
        summary: {
          ...cart.summary,
          fixedAmountDiscountIncVat: inc,
          fixedAmountDiscountExVat: ex,
        },
      },
    };
  }

  it.each([
    [true, '25'],
    [false, '20'],
  ])(
    'shows the order discount on the chosen side (incl. VAT: %s)',
    (incVat, amount) => {
      mockShowIncVat.value = incVat;
      const wrapper = mountWith(withDiscount(25, 20));

      expect(
        wrapper.find('[data-testid="order-summary-discount"]').text(),
      ).toMatch(new RegExp(`-\\D*${amount}`));
      expect(
        wrapper.find('[data-testid="order-items-footer-discount"]').text(),
      ).toMatch(new RegExp(`-\\D*${amount}`));
    },
  );

  it("formats the discount in the buyer's own locale", () => {
    const wrapper = mountWith(withDiscount(25, 20));

    expect(
      wrapper.find('[data-testid="order-items-footer-discount"]').text(),
    ).toBe('-SEK\u00a025.00');
  });

  it('shows no discount row without a discount', () => {
    const wrapper = mountWith(withDiscount(0, 0));

    expect(
      wrapper.find('[data-testid="order-summary-discount"]').exists(),
    ).toBe(false);
  });

  it('shows the payment method in the additional information', () => {
    const wrapper = mountWith({
      paymentDetails: [{ displayName: 'Faktura 30 dagar', name: 'Invoice' }],
    });

    expect(
      wrapper.find('[data-testid="additional-payment-method"]').text(),
    ).toContain('Faktura 30 dagar');
  });

  it('labels the inc-VAT line "total incl. VAT" on the order page', () => {
    mockShowIncVat.value = false;
    const wrapper = mountWith({});

    expect(
      wrapper.find('[data-testid="order-summary-total-inc-vat"]').element
        .previousElementSibling?.textContent,
    ).toBe('common.total_inc_vat');
  });
});
