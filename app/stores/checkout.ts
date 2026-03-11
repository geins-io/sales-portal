import { defineStore } from 'pinia';
import type {
  CheckoutType,
  AddressInputType,
  ConsentType,
  PaymentOptionType,
  ShippingOptionType,
  CreateOrderResponseType,
} from '#shared/types/commerce';
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
  const useSeparateShipping = ref(false);
  const selectedPaymentId = ref<number | null>(null);
  const selectedShippingId = ref<number | null>(null);
  const email = ref('');
  const identityNumber = ref('');
  const message = ref('');
  const acceptedConsents = ref<string[]>([]);
  const isLoading = ref(false);
  const isPlacingOrder = ref(false);
  const error = ref<string | null>(null);
  const orderResult = ref<{ orderId: string; publicId: string } | null>(null);

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
  const canPlaceOrder = computed(() => {
    if (isLoading.value || isPlacingOrder.value) return false;
    if (!email.value) return false;
    const addr = billingAddress.value;
    if (
      !addr.firstName ||
      !addr.lastName ||
      !addr.addressLine1 ||
      !addr.city ||
      !addr.country ||
      !addr.zip
    )
      return false;
    if (!selectedPaymentId.value) return false;
    if (!selectedShippingId.value) return false;
    return true;
  });

  // Actions
  async function fetchCheckout(cartId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<CheckoutType>('/api/checkout', {
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

      // Auto-select default payment
      if (data.paymentOptions?.length) {
        const defaultOpt =
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
            checkoutOptions: {
              email: email.value,
              paymentId: selectedPaymentId.value,
              shippingId: selectedShippingId.value,
              message: message.value,
              acceptedConsents: acceptedConsents.value,
              billingAddress: billingAddress.value,
              shippingAddress: effectiveShippingAddress.value,
              identityNumber: identityNumber.value,
            },
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

  function reset() {
    checkout.value = null;
    billingAddress.value = emptyAddress();
    shippingAddress.value = emptyAddress();
    useSeparateShipping.value = false;
    selectedPaymentId.value = null;
    selectedShippingId.value = null;
    email.value = '';
    identityNumber.value = '';
    message.value = '';
    acceptedConsents.value = [];
    isLoading.value = false;
    isPlacingOrder.value = false;
    error.value = null;
    orderResult.value = null;
  }

  return {
    checkout,
    billingAddress,
    shippingAddress,
    useSeparateShipping,
    selectedPaymentId,
    selectedShippingId,
    email,
    identityNumber,
    message,
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
    fetchCheckout,
    toggleConsent,
    placeOrder,
    reset,
  };
});
