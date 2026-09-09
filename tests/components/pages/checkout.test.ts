import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent, h, Suspense, computed } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defaultMountOptions } from '../../utils/component';

// ---------------------------------------------------------------------------
// Nuxt auto-import stubs
// ---------------------------------------------------------------------------
// Hoisted so the same spy instance backs the global stub, the module mock and
// the assertions — the page reaches each of these through a different import.
const { mockNavigateTo, mockSafeLocationRedirect, mockFetch } = vi.hoisted(
  () => ({
    mockNavigateTo: vi.fn<typeof navigateTo>(() => Promise.resolve()),
    mockSafeLocationRedirect: vi.fn<(url: string) => void>(),
    mockFetch: vi.fn(),
  }),
);

vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('safeLocationRedirect', mockSafeLocationRedirect);
vi.stubGlobal('$fetch', mockFetch);

// safeLocationRedirect is auto-imported from app/utils, so the global stub
// alone does not intercept it.
vi.mock('../../../app/utils/client-helpers', () => ({
  safeLocationRedirect: (url: string) => mockSafeLocationRedirect(url),
  safeConfirm: vi.fn(() => true),
  safeScrollTo: vi.fn(),
  safeHistoryBack: vi.fn(),
}));
vi.stubGlobal(
  'formatPrice',
  vi.fn(() => ''),
);
vi.stubGlobal('watch', vi.fn());
// Stub Nuxt's `callOnce` at the module level. The real impl reaches for
// the Nuxt instance via useNuxtApp() which isn't present under plain
// @vue/test-utils mount.
vi.mock('#app/composables/once', () => ({
  callOnce: vi.fn((_keyOrFn: unknown, maybeFn?: unknown) => {
    const fn = typeof _keyOrFn === 'function' ? _keyOrFn : maybeFn;
    return typeof fn === 'function' ? fn() : Promise.resolve();
  }),
}));

vi.mock('#app/composables/router', () => ({
  useRoute: () => ({ params: {}, query: {}, path: '/se/en/checkout' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  navigateTo: (...args: Parameters<typeof mockNavigateTo>) =>
    mockNavigateTo(...args),
}));

// ---------------------------------------------------------------------------
// Mock useFetch — controls company fetch result per test.
// Default: no company data (non-company / consumer user).
// Tests that need isCompanyUser=true set mockCompanyData before mounting.
// ---------------------------------------------------------------------------
const mockCompanyData = ref<{ company: object } | null>(null);

vi.mock('#app/composables/fetch', () => ({
  useFetch: vi.fn((_url: string) => {
    return Promise.resolve({
      data: ref(mockCompanyData.value),
      error: ref(null),
    });
  }),
}));

vi.stubGlobal(
  'useFetch',
  vi.fn((_url: string) => {
    return Promise.resolve({
      data: ref(mockCompanyData.value),
      error: ref(null),
    });
  }),
);

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
// Both fields the page branches on are refs the tests drive; the page reads
// them during setup, so each test sets them before mounting.
const mockCheckoutMode = ref<'custom' | 'hosted'>('custom');
const mockIsCatalogMode = ref(false);

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref({ locale: 'en' }),
    checkoutMode: mockCheckoutMode,
    isCatalogMode: computed(() => mockIsCatalogMode.value),
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
// Stable mock fn instances so each test can assert on the exact mock the
// component received at mount time (avoids the tautological re-import pattern).
let mockPlaceOrder = vi.fn().mockResolvedValue(undefined);

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
    customerOrderNumber: '',
    goodsLabel: '',
    desiredDeliveryDate: '',
    billingAddress: {},
    billingAddressId: null,
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
    placeOrder: (...args: Parameters<typeof mockPlaceOrder>) =>
      mockPlaceOrder(...args),
    toggleConsent: vi.fn(),
    fetchCheckout: (...args: Parameters<typeof mockFetchCheckout>) =>
      mockFetchCheckout(...args),
    prefillFromCompany: vi.fn(),
  })),
}));

type CheckoutStore = ReturnType<
  typeof import('../../../app/stores/checkout').useCheckoutStore
>;

/**
 * A checkout-store stand-in for `mockReturnValueOnce`. A Pinia `Store` also
 * carries `$state`/`$patch`/`$subscribe`, which none of these tests touch, so
 * the one widening that needs lives here rather than at each call site. The
 * fields a test varies go through `Partial<CheckoutStore>` and are checked.
 */
function checkoutStoreStub(overrides: Partial<CheckoutStore>): CheckoutStore {
  return {
    isLoading: false,
    isPlacingOrder: false,
    isBlacklisted: false,
    canPlaceOrder: true,
    error: null,
    orderResult: null,
    quoteResult: null,
    email: '',
    identityNumber: '',
    customerOrderNumber: '',
    goodsLabel: '',
    desiredDeliveryDate: '',
    billingAddress: {},
    billingAddressId: null,
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
    toggleConsent: vi.fn(),
    prefillFromCompany: vi.fn(),
    ...overrides,
  } as unknown as CheckoutStore;
}

vi.mock('../../../app/stores/cart', () => ({
  useCartStore: vi.fn(() => ({
    cart: null,
    cartId: 'cart-test-001',
    itemCount: 0,
    discountAmount: 0,
  })),
}));

const mockAuthStore = {
  isAuthenticated: false,
  isInitialized: true,
  user: null as { username: string } | null,
  fetchUser: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../../app/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
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
  CheckoutCompanyInfo: {
    template: '<div data-testid="checkout-company-info" />',
    props: ['company', 'buyerEmail', 'customerOrderNumber', 'disabled'],
    emits: ['update:customerOrderNumber'],
  },
  CheckoutDeliveryInfo: {
    template: '<div data-testid="checkout-delivery-info" />',
    props: [
      'company',
      'desiredDeliveryDate',
      'goodsLabel',
      'disabled',
      'todayIso',
    ],
    emits: ['update:desiredDeliveryDate', 'update:goodsLabel'],
  },
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
    // The terms-acceptance checkbox now lives inside the summary, above the
    // button. Auto-accept on mount mirrors a buyer who ticked it, clearing the
    // page's place-order gate (acceptedTerms) the same way the real flow does.
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
      'termsAccepted',
    ],
    emits: ['placeOrder', 'update:termsAccepted'],
    mounted() {
      (this as unknown as { $emit: (e: string, v: boolean) => void }).$emit(
        'update:termsAccepted',
        true,
      );
    },
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
    mockPlaceOrder = vi.fn().mockResolvedValue(undefined);
    // Reset to non-company state between tests
    mockCompanyData.value = null;
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.user = null;
    mockCheckoutMode.value = 'custom';
    mockIsCatalogMode.value = false;
    mockNavigateTo.mockClear();
    mockSafeLocationRedirect.mockClear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      token: 'tok-123',
      checkoutUrl: 'https://checkout.geins.services/tok-123',
    });
  });

  describe('catalog mode', () => {
    // Only the redirect is asserted, not the absence of the page: navigateTo is
    // a resolving spy here, so setup runs on past it and the template still
    // renders. Asserting it away would be asserting the mock.
    it('redirects to the start page when mode is catalog', async () => {
      mockIsCatalogMode.value = true;

      await mountCheckoutPage();

      expect(mockNavigateTo).toHaveBeenCalledWith('/se/en/', {
        replace: true,
      });
    });

    it('renders the checkout and does not redirect in commerce mode', async () => {
      const wrapper = await mountCheckoutPage();

      expect(mockNavigateTo).not.toHaveBeenCalledWith('/se/en/', {
        replace: true,
      });
      expect(wrapper.find('[data-testid="checkout-page"]').exists()).toBe(true);
    });
  });

  describe('checkout mode', () => {
    // In hosted mode the checkout is not ours to render: the page trades the
    // cart id for a token during setup and hands the buyer to Geins.
    it('posts the cart id and redirects to the hosted checkout when checkoutMode is hosted', async () => {
      mockCheckoutMode.value = 'hosted';

      const wrapper = await mountCheckoutPage();

      expect(mockFetch).toHaveBeenCalledWith('/api/checkout/token', {
        method: 'POST',
        body: { cartId: 'cart-test-001' },
      });
      expect(mockSafeLocationRedirect).toHaveBeenCalledWith(
        'https://checkout.geins.services/tok-123',
      );
      expect(wrapper.find('[data-testid="checkout-hosted"]').exists()).toBe(
        true,
      );
      expect(
        wrapper.find('[data-testid="checkout-redirecting"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="checkout-address-form"]').exists(),
      ).toBe(false);
    });

    it('shows the redirect error when the token call fails', async () => {
      mockCheckoutMode.value = 'hosted';
      mockFetch.mockRejectedValue(new Error('token service down'));

      const wrapper = await mountCheckoutPage();

      expect(mockSafeLocationRedirect).not.toHaveBeenCalled();
      expect(
        wrapper.find('[data-testid="checkout-redirect-error"]').exists(),
      ).toBe(true);
    });

    it('renders the in-app form and requests no token when checkoutMode is custom', async () => {
      const wrapper = await mountCheckoutPage();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSafeLocationRedirect).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="checkout-hosted"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.find('[data-testid="checkout-address-form"]').exists(),
      ).toBe(true);
    });
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

  it('allows handlePlaceOrder when customerOrderNumber is empty for a company user (PO optional)', async () => {
    // Company user context: billingAddressId is set (simulating prefillFromCompany)
    // with an empty customerOrderNumber. The PO number is optional, so with terms
    // auto-accepted the order places successfully.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce(
      checkoutStoreStub({
        isLoading: false,
        isPlacingOrder: false,
        isBlacklisted: false,
        canPlaceOrder: true,
        error: null,
        orderResult: null,
        quoteResult: null,
        email: 'buyer@company.com',
        identityNumber: '',
        customerOrderNumber: '',
        goodsLabel: '',
        desiredDeliveryDate: '',
        billingAddressId: 'addr-b2b-1',
        useSeparateShipping: false,
        message: '',
        paymentOptions: [],
        shippingOptions: [],
        consents: [],
        acceptedConsents: [],
        selectedPaymentId: 1,
        selectedShippingId: 1,
        checkout: null,
        placeOrder: mockPlaceOrder,
        toggleConsent: vi.fn(),
        fetchCheckout: mockFetchCheckout,
        prefillFromCompany: vi.fn(),
      }),
    );

    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = { username: 'buyer@company.com' };
    mockCompanyData.value = {
      company: {
        id: 'c1',
        name: 'Acme AB',
        addresses: [],
      },
    };

    const wrapper = await mountCheckoutPage();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  it('allows a company user with customerOrderNumber and billingAddressId to place an order', async () => {
    // B2B happy path: billingAddressId is set, customerOrderNumber is non-empty,
    // and terms are accepted. All gates pass and placeOrder is called.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce(
      checkoutStoreStub({
        isLoading: false,
        isPlacingOrder: false,
        isBlacklisted: false,
        canPlaceOrder: true,
        error: null,
        orderResult: null,
        quoteResult: null,
        email: 'buyer@company.com',
        identityNumber: '',
        customerOrderNumber: 'PO-B2B-001',
        goodsLabel: '',
        desiredDeliveryDate: '',
        billingAddressId: 'addr-b2b-1',
        useSeparateShipping: false,
        message: '',
        paymentOptions: [],
        shippingOptions: [],
        consents: [],
        acceptedConsents: [],
        selectedPaymentId: 1,
        selectedShippingId: 1,
        checkout: null,
        placeOrder: mockPlaceOrder,
        toggleConsent: vi.fn(),
        fetchCheckout: mockFetchCheckout,
        prefillFromCompany: vi.fn(),
      }),
    );

    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = { username: 'buyer@company.com' };
    mockCompanyData.value = {
      company: {
        id: 'c1',
        name: 'Acme AB',
        addresses: [],
      },
    };

    const wrapper = await mountCheckoutPage();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  it('allows a non-company user to place an order with empty customerOrderNumber', async () => {
    // Non-company user: isAuthenticated=false (default), so isCompanyUser is
    // false. The PO gate must NOT fire — placeOrder should be called when
    // canPlaceOrder is true and terms are accepted.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce(
      checkoutStoreStub({
        isLoading: false,
        isPlacingOrder: false,
        isBlacklisted: false,
        canPlaceOrder: true,
        error: null,
        orderResult: null,
        quoteResult: null,
        email: 'consumer@example.com',
        identityNumber: '',
        customerOrderNumber: '',
        goodsLabel: '',
        desiredDeliveryDate: '',
        useSeparateShipping: false,
        message: '',
        paymentOptions: [],
        shippingOptions: [],
        consents: [],
        acceptedConsents: [],
        selectedPaymentId: 1,
        selectedShippingId: 1,
        checkout: null,
        placeOrder: mockPlaceOrder,
        toggleConsent: vi.fn(),
        fetchCheckout: mockFetchCheckout,
        prefillFromCompany: vi.fn(),
      }),
    );

    const wrapper = await mountCheckoutPage();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  it('calls placeOrder when customerOrderNumber is present and canPlaceOrder is true', async () => {
    // The shared CheckoutOrderSummary stub auto-accepts terms on mount, and
    // the store mock provides a non-empty customerOrderNumber, so all gates
    // pass and placeOrder is called.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce(
      checkoutStoreStub({
        isLoading: false,
        isPlacingOrder: false,
        isBlacklisted: false,
        canPlaceOrder: true,
        error: null,
        orderResult: null,
        quoteResult: null,
        email: 'buyer@example.com',
        identityNumber: '',
        customerOrderNumber: 'PO-TEST',
        goodsLabel: '',
        desiredDeliveryDate: '',
        useSeparateShipping: false,
        message: '',
        paymentOptions: [],
        shippingOptions: [],
        consents: [],
        acceptedConsents: [],
        selectedPaymentId: 1,
        selectedShippingId: 1,
        checkout: null,
        placeOrder: mockPlaceOrder,
        toggleConsent: vi.fn(),
        fetchCheckout: mockFetchCheckout,
        prefillFromCompany: vi.fn(),
      }),
    );

    const wrapper = await mountCheckoutPage();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });
});
