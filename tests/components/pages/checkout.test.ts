import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent, h, Suspense, computed } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defaultMountOptions } from '../../utils/component';

// ---------------------------------------------------------------------------
// Nuxt auto-import stubs
// ---------------------------------------------------------------------------
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', vi.fn().mockResolvedValue(undefined));
vi.stubGlobal('safeLocationRedirect', vi.fn());
vi.stubGlobal(
  'formatPrice',
  vi.fn(() => ''),
);
vi.stubGlobal('watch', vi.fn());

vi.mock('#app/composables/router', () => ({
  useRoute: () => ({ params: {}, query: {}, path: '/se/en/checkout' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  navigateTo: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock useCookie — cart ID present so no redirect fires
// ---------------------------------------------------------------------------
const mockCartIdCookie = ref<string | null>('cart-test-001');

vi.mock('#app/composables/cookie', () => ({
  useCookie: vi.fn(() => mockCartIdCookie),
}));

vi.stubGlobal(
  'useCookie',
  vi.fn(() => mockCartIdCookie),
);

// ---------------------------------------------------------------------------
// Override useTenant for checkout mode — provides checkoutMode needed by page
// ---------------------------------------------------------------------------
vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref({ locale: 'en' }),
    checkoutMode: ref('custom'),
    isCatalogMode: computed(() => false),
    hasFeature: vi.fn(() => true),
    suspense: vi.fn().mockResolvedValue(undefined),
    tenantId: computed(() => 'test-tenant'),
    hostname: computed(() => 'test.example.com'),
    isLoading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  }),
  useTenantTheme: () => ({
    colors: computed(() => undefined),
    radius: computed(() => '0.625rem'),
    getColor: () => '',
    primaryColor: computed(() => 'oklch(0.205 0 0)'),
    secondaryColor: computed(() => 'oklch(0.97 0 0)'),
    backgroundColor: computed(() => 'oklch(1 0 0)'),
    foregroundColor: computed(() => 'oklch(0.145 0 0)'),
  }),
}));

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------
const mockFetchCheckout = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../app/stores/checkout', () => ({
  useCheckoutStore: vi.fn(() => ({
    isLoading: false,
    isPlacingOrder: false,
    isBlacklisted: false,
    canPlaceOrder: true,
    error: null,
    orderResult: null,
    quoteResult: null,
    email: '',
    identityNumber: '',
    poNumber: '',
    billingAddress: {},
    shippingAddress: {},
    useSeparateShipping: false,
    message: '',
    paymentOptions: [],
    shippingOptions: [],
    consents: [],
    acceptedConsents: [],
    selectedPaymentId: null,
    selectedShippingId: null,
    checkout: null,
    placeOrder: vi.fn(),
    toggleConsent: vi.fn(),
    fetchCheckout: mockFetchCheckout,
    prefillFromCompany: vi.fn(),
  })),
}));

vi.mock('../../../app/stores/cart', () => ({
  useCartStore: vi.fn(() => ({
    cart: null,
    cartId: 'cart-test-001',
    itemCount: 0,
    discountAmount: 0,
  })),
}));

vi.mock('../../../app/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
  })),
}));

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: { CART_ID: 'cart_id' },
}));

// ---------------------------------------------------------------------------
// Stubs for child components
// ---------------------------------------------------------------------------
const stubs = {
  ...defaultMountOptions.global?.stubs,
  CheckoutCartItems: { template: '<div data-testid="checkout-cart-items" />' },
  CheckoutInvoiceInfo: {
    template: '<div data-testid="checkout-invoice-info" />',
  },
  CheckoutAddressForm: {
    template: '<div data-testid="checkout-address-form" />',
  },
  CheckoutPaymentOptions: {
    template: '<div data-testid="checkout-payment-options" />',
  },
  CheckoutShippingOptions: {
    template: '<div data-testid="checkout-shipping-options" />',
  },
  CheckoutConsents: {
    template: '<div data-testid="checkout-consents" />',
  },
  CheckoutOrderSummary: {
    template:
      '<div data-testid="checkout-order-summary"><button data-testid="place-order-button" @click="$emit(\'placeOrder\')" /></div>',
    props: [
      'itemCount',
      'subtotal',
      'shippingFee',
      'tax',
      'total',
      'discount',
      'canPlaceOrder',
      'isPlacingOrder',
    ],
    emits: ['placeOrder'],
  },
  Card: { template: '<div><slot /></div>' },
  CardHeader: { template: '<div><slot /></div>' },
  CardTitle: { template: '<div><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'variant'],
    emits: ['click'],
  },
  Input: { template: '<input />' },
  Label: { template: '<label><slot /></label>' },
  Checkbox: { template: '<input type="checkbox" />' },
  Loader2: { template: '<span data-testid="loader2" />' },
  Mail: { template: '<span />' },
  MapPin: { template: '<span />' },
  CreditCard: { template: '<span />' },
  Truck: { template: '<span />' },
  MessageSquare: { template: '<span />' },
  FileCheck: { template: '<span />' },
};

// ---------------------------------------------------------------------------
// Import page after mocks
// ---------------------------------------------------------------------------
const { default: CheckoutPage } =
  await import('../../../app/pages/checkout.vue');

// ---------------------------------------------------------------------------
// Mount helper — wraps in Suspense for top-level await in setup
// ---------------------------------------------------------------------------
async function mountCheckoutPage() {
  const Wrapper = defineComponent({
    components: { CheckoutPage },
    setup() {
      return () => h(Suspense, null, { default: () => h(CheckoutPage) });
    },
  });
  const wrapper = mount(Wrapper, {
    global: {
      ...defaultMountOptions.global,
      stubs,
      mocks: {
        ...defaultMountOptions.global?.mocks,
        $t: (key: string) => key,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('checkout page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCartIdCookie.value = 'cart-test-001';
    mockFetchCheckout.mockClear();
  });

  it('renders checkout page container', async () => {
    const wrapper = await mountCheckoutPage();
    expect(wrapper.find('[data-testid="checkout-page"]').exists()).toBe(true);
  });

  it('renders checkout heading with checkout.heading i18n key', async () => {
    const wrapper = await mountCheckoutPage();
    const heading = wrapper.find('[data-testid="checkout-heading"]');
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toContain('checkout.heading');
  });

  it('does not render request-quote-button', async () => {
    const wrapper = await mountCheckoutPage();
    expect(wrapper.find('[data-testid="request-quote-button"]').exists()).toBe(
      false,
    );
  });

  it('calls fetchCheckout on load when cart cookie is present', async () => {
    await mountCheckoutPage();
    expect(mockFetchCheckout).toHaveBeenCalledWith('cart-test-001');
  });
});
