import { defineStore } from 'pinia';
import type {
  CheckoutType,
  AddressInputType,
  ConsentType,
  PaymentOptionType,
  ShippingOptionType,
  CreateOrderResponseType,
} from '#shared/types/commerce';
import type { Company, CompanyAddress } from '#shared/types/company';
import { checkoutAddressFields } from '#shared/utils/checkout-address';
import { useCartStore } from '~/stores/cart';
import { useAuthStore } from '~/stores/auth';

function emptyAddress(): AddressInputType {
  return {
    firstName: '',
    lastName: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    entryCode: '',
    careOf: '',
    city: '',
    state: '',
    country: '',
    zip: '',
    company: '',
    mobile: '',
    phone: '',
  };
}

export const useCheckoutStore = defineStore('checkout', () => {
  const checkout = ref<CheckoutType | null>(null);
  const billingAddress = ref<AddressInputType>(emptyAddress());
  const shippingAddress = ref<AddressInputType>(emptyAddress());
  // Company (B2B) checkouts must reference predefined addresses by id;
  // these are set by prefillFromCompany and consumed by placeOrder.
  // null on consumer checkouts — the address objects are sent instead.
  const billingAddressId = ref<string | null>(null);
  const shippingAddressId = ref<string | null>(null);
  const useSeparateShipping = ref(false);
  const selectedPaymentId = ref<number | null>(null);
  const selectedShippingId = ref<number | null>(null);
  const email = ref('');
  const identityNumber = ref('');
  const message = ref('');
  const customerOrderNumber = ref('');
  const goodsLabel = ref('');
  const desiredDeliveryDate = ref(''); // ISO yyyy-mm-dd string
  const acceptedConsents = ref<string[]>([]);
  const isLoading = ref(false);
  const isPlacingOrder = ref(false);
  const error = ref<string | null>(null);
  const orderResult = ref<{ orderId: string; publicId: string } | null>(null);
  const quoteMessage = ref('');
  const isRequestingQuote = ref(false);
  const quoteResult = ref<{ quoteId: string; quoteNumber: string } | null>(
    null,
  );

  // Computeds
  const paymentOptions = computed<PaymentOptionType[]>(
    () => checkout.value?.paymentOptions ?? [],
  );
  const shippingOptions = computed<ShippingOptionType[]>(
    () => checkout.value?.shippingOptions ?? [],
  );
  const consents = computed<ConsentType[]>(
    () => checkout.value?.consents ?? [],
  );
  const isBlacklisted = computed(
    () => checkout.value?.checkoutStatus === 'CUSTOMER_BLACKLISTED',
  );
  const effectiveShippingAddress = computed<AddressInputType>(() =>
    useSeparateShipping.value ? shippingAddress.value : billingAddress.value,
  );
  const isAddressComplete = computed(() => {
    const addr = billingAddress.value;
    return !!(
      addr.firstName &&
      addr.lastName &&
      addr.addressLine1 &&
      addr.city &&
      addr.country &&
      addr.zip
    );
  });
  const canPlaceOrder = computed(() => {
    if (isLoading.value || isPlacingOrder.value) return false;
    if (!email.value) return false;
    if (!isAddressComplete.value) return false;
    if (!selectedPaymentId.value) return false;
    return true;
  });
  const canRequestQuote = computed(() => {
    if (isLoading.value || isRequestingQuote.value) return false;
    if (!email.value) return false;
    if (!isAddressComplete.value) return false;
    return true;
  });

  // Actions
  async function fetchCheckout(cartId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await internalFetch<CheckoutType>('/api/checkout', {
        query: { cartId },
      });
      checkout.value = data;

      // Pre-fill email: checkout response first, then auth user
      if (data.email) {
        email.value = data.email;
      } else {
        const authStore = useAuthStore();
        if (authStore.user?.username) {
          email.value = authStore.user.username;
        }
      }

      // Pre-fill addresses
      if (data.billingAddress) {
        billingAddress.value = {
          ...emptyAddress(),
          ...data.billingAddress,
        };
      }
      if (data.shippingAddress) {
        shippingAddress.value = {
          ...emptyAddress(),
          ...data.shippingAddress,
        };
      }

      // Auto-select default payment. Invoice (STANDARD) option wins when
      // present, even if admin marked a different option as default. Fall
      // back to admin default, then to the first option in the list.
      if (data.paymentOptions?.length) {
        const invoiceOpt = data.paymentOptions.find(
          (o) => o.paymentType === 'STANDARD',
        );
        const defaultOpt =
          invoiceOpt ??
          data.paymentOptions.find((o) => o.isDefault || o.isSelected) ??
          data.paymentOptions[0]!;
        selectedPaymentId.value = defaultOpt.id;
      }

      // Auto-select default shipping
      if (data.shippingOptions?.length) {
        const defaultOpt =
          data.shippingOptions.find((o) => o.isDefault || o.isSelected) ??
          data.shippingOptions[0]!;
        selectedShippingId.value = defaultOpt.id;
      }

      // Auto-accept consents with autoAccept flag
      if (data.consents?.length) {
        const autoAccepted = data.consents
          .filter((c) => c.autoAccept && c.type)
          .map((c) => c.type!);
        acceptedConsents.value = [...autoAccepted];
      }
    } catch {
      error.value = 'Failed to load checkout';
    } finally {
      isLoading.value = false;
    }
  }

  function toggleConsent(consentType: string) {
    const idx = acceptedConsents.value.indexOf(consentType);
    if (idx >= 0) {
      acceptedConsents.value.splice(idx, 1);
    } else {
      acceptedConsents.value.push(consentType);
    }
  }

  async function placeOrder(cartId: string) {
    isPlacingOrder.value = true;
    error.value = null;
    try {
      const response = await $fetch<CreateOrderResponseType>(
        '/api/checkout/create-order',
        {
          method: 'POST',
          body: {
            cartId,
            email: email.value,
            paymentId: selectedPaymentId.value,
            shippingId: selectedShippingId.value,
            message: message.value || undefined,
            acceptedConsents:
              acceptedConsents.value.length > 0
                ? acceptedConsents.value
                : undefined,
            ...checkoutAddressFields(
              'billing',
              billingAddress.value,
              billingAddressId.value,
            ),
            // Shipping is omitted when not separate — Geins reuses billing.
            ...(useSeparateShipping.value
              ? checkoutAddressFields(
                  'shipping',
                  effectiveShippingAddress.value,
                  shippingAddressId.value,
                )
              : {}),
            identityNumber: identityNumber.value || undefined,
            customerOrderNumber: customerOrderNumber.value || undefined,
            goodsLabel: goodsLabel.value || undefined,
            desiredDeliveryDate: desiredDeliveryDate.value || undefined,
          },
        },
      );

      orderResult.value = {
        orderId: response.orderId ?? '',
        publicId: response.publicId ?? '',
      };

      // Clear cart store — cart no longer exists after order
      const cartStore = useCartStore();
      cartStore.cart = null;
      cartStore.cartId = null;
    } catch {
      error.value = 'Failed to place order';
    } finally {
      isPlacingOrder.value = false;
    }
  }

  async function requestQuote(cartId: string) {
    isRequestingQuote.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ quoteId: string; quoteNumber: string }>(
        '/api/quotes',
        {
          method: 'POST',
          body: {
            cartId,
            message: quoteMessage.value,
          },
        },
      );
      quoteResult.value = {
        quoteId: response.quoteId,
        quoteNumber: response.quoteNumber,
      };
    } catch {
      error.value = 'Failed to request quote';
    } finally {
      isRequestingQuote.value = false;
    }
  }

  function resolveBillingAddress(company: Company): CompanyAddress | null {
    const addresses = company.addresses ?? [];
    return (
      addresses.find((a) => a.addressType?.toLowerCase().includes('billing')) ??
      addresses[0] ??
      null
    );
  }

  function resolveDeliveryAddress(
    company: Company,
    billingFallback: CompanyAddress | null,
  ): CompanyAddress | null {
    const addresses = company.addresses ?? [];
    return (
      addresses.find(
        (a) =>
          a.addressType?.toLowerCase().includes('delivery') ||
          a.addressType?.toLowerCase().includes('shipping'),
      ) ?? billingFallback
    );
  }

  function companyAddressToInput(addr: CompanyAddress): AddressInputType {
    return {
      firstName: addr.firstName ?? '',
      lastName: addr.lastName ?? '',
      addressLine1: addr.addressLine1 ?? '',
      addressLine2: addr.addressLine2 ?? '',
      addressLine3: addr.addressLine3 ?? '',
      entryCode: '',
      careOf: addr.careOf ?? '',
      city: addr.city ?? '',
      state: '',
      country: addr.country ?? '',
      zip: addr.zip ?? '',
      company: addr.company ?? '',
      mobile: '',
      phone: addr.phone ?? '',
    };
  }

  function prefillFromCompany(company: Company) {
    const billingAddr = resolveBillingAddress(company);
    const deliveryAddr = resolveDeliveryAddress(company, billingAddr);

    const authStore = useAuthStore();
    email.value = authStore.user?.username ?? billingAddr?.email ?? '';

    // B2B checkout: Geins rejects literal addresses and requires the
    // predefined addressId. Both the object (for display) and the id
    // (for placeOrder) are populated; the helper picks at submit time.
    if (billingAddr) {
      billingAddress.value = companyAddressToInput(billingAddr);
      billingAddressId.value = billingAddr.addressId ?? null;
    }
    if (deliveryAddr) {
      shippingAddress.value = companyAddressToInput(deliveryAddr);
      shippingAddressId.value = deliveryAddr.addressId ?? null;
    }
  }

  function reset() {
    checkout.value = null;
    billingAddress.value = emptyAddress();
    shippingAddress.value = emptyAddress();
    billingAddressId.value = null;
    shippingAddressId.value = null;
    useSeparateShipping.value = false;
    selectedPaymentId.value = null;
    selectedShippingId.value = null;
    email.value = '';
    identityNumber.value = '';
    message.value = '';
    customerOrderNumber.value = '';
    goodsLabel.value = '';
    desiredDeliveryDate.value = '';
    acceptedConsents.value = [];
    isLoading.value = false;
    isPlacingOrder.value = false;
    error.value = null;
    orderResult.value = null;
    quoteMessage.value = '';
    isRequestingQuote.value = false;
    quoteResult.value = null;
  }

  return {
    checkout,
    billingAddress,
    shippingAddress,
    billingAddressId,
    shippingAddressId,
    useSeparateShipping,
    selectedPaymentId,
    selectedShippingId,
    email,
    identityNumber,
    message,
    customerOrderNumber,
    goodsLabel,
    desiredDeliveryDate,
    acceptedConsents,
    isLoading,
    isPlacingOrder,
    error,
    orderResult,
    paymentOptions,
    shippingOptions,
    consents,
    isBlacklisted,
    effectiveShippingAddress,
    canPlaceOrder,
    canRequestQuote,
    quoteMessage,
    isRequestingQuote,
    quoteResult,
    fetchCheckout,
    toggleConsent,
    placeOrder,
    requestQuote,
    prefillFromCompany,
    reset,
  };
});
