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
  navigateTo: vi.fn().mockResolvedValue(undefined),
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
    placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
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
    mockPlaceOrder = vi.fn().mockResolvedValue(undefined);
    // Reset to non-company state between tests
    mockCompanyData.value = null;
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.user = null;
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

  it('blocks handlePlaceOrder when customerOrderNumber is empty for a company user', async () => {
    // Company user context: billingAddressId is set (simulating prefillFromCompany),
    // customerOrderNumber is '' so the B2B PO-gate fires and placeOrder is never called.
    // Terms are auto-accepted so the terms gate is NOT the blocker — if we deleted
    // the PO gate, this test would fail because placeOrder would be called.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce({
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
      billingAddress: {},
      billingAddressId: 'addr-b2b-1',
      shippingAddress: {},
      useSeparateShipping: false,
      message: '',
      paymentOptions: [],
      shippingOptions: [],
      consents: [],
      acceptedConsents: [],
      selectedPaymentId: 1,
      selectedShippingId: 1,
      checkout: null,
      placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
      toggleConsent: vi.fn(),
      fetchCheckout: mockFetchCheckout,
      prefillFromCompany: vi.fn(),
    } as ReturnType<typeof useCheckoutStore>);

    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = { username: 'buyer@company.com' };
    mockCompanyData.value = {
      company: {
        id: 'c1',
        name: 'Acme AB',
        addresses: [],
      },
    };

    // Auto-accept terms so the terms gate is cleared; only the PO gate blocks.
    const stubbedStubs = {
      ...stubs,
      CheckoutTermsAgreement: {
        template: '<div data-testid="checkout-terms-auto" />',
        props: ['modelValue', 'disabled'],
        emits: ['update:modelValue'],
        mounted() {
          (this as unknown as { $emit: (e: string, v: boolean) => void }).$emit(
            'update:modelValue',
            true,
          );
        },
      },
    };

    const Wrapper = defineComponent({
      components: { CheckoutPage },
      setup() {
        return () => h(Suspense, null, { default: () => h(CheckoutPage) });
      },
    });

    const wrapper = mount(Wrapper, {
      global: {
        ...defaultMountOptions.global,
        stubs: stubbedStubs,
        mocks: {
          ...defaultMountOptions.global?.mocks,
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });

  it('allows a company user with customerOrderNumber and billingAddressId to place an order', async () => {
    // B2B happy path: billingAddressId is set, customerOrderNumber is non-empty,
    // and terms are accepted. All gates pass and placeOrder is called.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce({
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
      billingAddress: {},
      billingAddressId: 'addr-b2b-1',
      shippingAddress: {},
      useSeparateShipping: false,
      message: '',
      paymentOptions: [],
      shippingOptions: [],
      consents: [],
      acceptedConsents: [],
      selectedPaymentId: 1,
      selectedShippingId: 1,
      checkout: null,
      placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
      toggleConsent: vi.fn(),
      fetchCheckout: mockFetchCheckout,
      prefillFromCompany: vi.fn(),
    } as ReturnType<typeof useCheckoutStore>);

    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = { username: 'buyer@company.com' };
    mockCompanyData.value = {
      company: {
        id: 'c1',
        name: 'Acme AB',
        addresses: [],
      },
    };

    const stubbedStubs = {
      ...stubs,
      CheckoutTermsAgreement: {
        template: '<div data-testid="checkout-terms-auto" />',
        props: ['modelValue', 'disabled'],
        emits: ['update:modelValue'],
        mounted() {
          (this as unknown as { $emit: (e: string, v: boolean) => void }).$emit(
            'update:modelValue',
            true,
          );
        },
      },
    };

    const Wrapper = defineComponent({
      components: { CheckoutPage },
      setup() {
        return () => h(Suspense, null, { default: () => h(CheckoutPage) });
      },
    });

    const wrapper = mount(Wrapper, {
      global: {
        ...defaultMountOptions.global,
        stubs: stubbedStubs,
        mocks: {
          ...defaultMountOptions.global?.mocks,
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

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
    vi.mocked(useCheckoutStore).mockReturnValueOnce({
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
      billingAddress: {},
      shippingAddress: {},
      useSeparateShipping: false,
      message: '',
      paymentOptions: [],
      shippingOptions: [],
      consents: [],
      acceptedConsents: [],
      selectedPaymentId: 1,
      selectedShippingId: 1,
      checkout: null,
      placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
      toggleConsent: vi.fn(),
      fetchCheckout: mockFetchCheckout,
      prefillFromCompany: vi.fn(),
    } as ReturnType<typeof useCheckoutStore>);

    const stubbedStubs = {
      ...stubs,
      CheckoutTermsAgreement: {
        template: '<div data-testid="checkout-terms-auto" />',
        props: ['modelValue', 'disabled'],
        emits: ['update:modelValue'],
        mounted() {
          (this as unknown as { $emit: (e: string, v: boolean) => void }).$emit(
            'update:modelValue',
            true,
          );
        },
      },
    };

    const Wrapper = defineComponent({
      components: { CheckoutPage },
      setup() {
        return () => h(Suspense, null, { default: () => h(CheckoutPage) });
      },
    });

    const wrapper = mount(Wrapper, {
      global: {
        ...defaultMountOptions.global,
        stubs: stubbedStubs,
        mocks: {
          ...defaultMountOptions.global?.mocks,
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  it('calls placeOrder when customerOrderNumber is present and canPlaceOrder is true', async () => {
    // Mount with a stub for CheckoutTermsAgreement that auto-checks terms
    // on mount (sets acceptedTerms = true via v-model emit), and a store
    // mock that provides a non-empty customerOrderNumber so all gates pass.
    const { useCheckoutStore } = await import('../../../app/stores/checkout');
    vi.mocked(useCheckoutStore).mockReturnValueOnce({
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
      billingAddress: {},
      shippingAddress: {},
      useSeparateShipping: false,
      message: '',
      paymentOptions: [],
      shippingOptions: [],
      consents: [],
      acceptedConsents: [],
      selectedPaymentId: 1,
      selectedShippingId: 1,
      checkout: null,
      placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
      toggleConsent: vi.fn(),
      fetchCheckout: mockFetchCheckout,
      prefillFromCompany: vi.fn(),
    } as ReturnType<typeof useCheckoutStore>);

    // Stub CheckoutTermsAgreement to auto-accept (emits true on mount)
    const stubbedStubs = {
      ...stubs,
      CheckoutTermsAgreement: {
        template: '<div data-testid="checkout-terms-auto" />',
        props: ['modelValue', 'disabled'],
        emits: ['update:modelValue'],
        mounted() {
          (this as unknown as { $emit: (e: string, v: boolean) => void }).$emit(
            'update:modelValue',
            true,
          );
        },
      },
    };

    const Wrapper = defineComponent({
      components: { CheckoutPage },
      setup() {
        return () => h(Suspense, null, { default: () => h(CheckoutPage) });
      },
    });

    const wrapper = mount(Wrapper, {
      global: {
        ...defaultMountOptions.global,
        stubs: stubbedStubs,
        mocks: {
          ...defaultMountOptions.global?.mocks,
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const placeOrderButton = wrapper.find('[data-testid="place-order-button"]');
    await placeOrderButton.trigger('click');
    await flushPromises();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });
});
