<script setup lang="ts">
import type { AddressType } from '#shared/types/commerce';
import type { QuoteAddress } from '#shared/types/quote';

/** An order's addresses and additional information in one grey box. */
const props = defineProps<{
  billingAddress?: AddressType | null;
  shippingAddress?: AddressType | null;
  customerOrderNumber?: string | null;
  goodsLabel?: string | null;
  desiredDeliveryDate?: string | null;
}>();

const { t } = useI18n();

function mapAddress(
  a: AddressType | null | undefined,
): QuoteAddress | undefined {
  if (!a) return undefined;
  return {
    company: a.company ?? undefined,
    firstName: a.firstName ?? undefined,
    lastName: a.lastName ?? undefined,
    addressLine1: a.addressLine1 ?? undefined,
    addressLine2: a.addressLine2 ?? undefined,
    addressLine3: a.addressLine3 ?? undefined,
    zip: a.zip ?? undefined,
    city: a.city ?? undefined,
    country: a.country ?? undefined,
    phone: a.phone ?? a.mobile ?? undefined,
  };
}

const billingAddress = computed(() => mapAddress(props.billingAddress));
const shippingAddress = computed(() => mapAddress(props.shippingAddress));

const hasAdditionalInfo = computed(
  () =>
    !!(
      props.customerOrderNumber ||
      props.goodsLabel ||
      props.desiredDeliveryDate
    ),
);

// Slices the YYYY-MM-DD portion from the ISO date string rather than using
// toLocaleDateString, which would shift a pure calendar date under negative
// UTC offsets.
const deliveryDate = computed(() => {
  const raw = props.desiredDeliveryDate;
  if (!raw) return '';
  const match = /^\d{4}-\d{2}-\d{2}/.exec(raw);
  return match ? match[0] : raw;
});
</script>

<template>
  <div
    v-if="billingAddress || shippingAddress || hasAdditionalInfo"
    class="bg-muted space-y-4 rounded-lg p-6"
  >
    <AddressBlock
      v-if="billingAddress"
      bare
      label-style="header"
      company-muted
      data-testid="billing-address"
      :label="t('portal.orders.detail.billing_address')"
      :address="billingAddress"
    />
    <hr
      v-if="billingAddress && (shippingAddress || hasAdditionalInfo)"
      class="border-border"
    />
    <AddressBlock
      v-if="shippingAddress"
      bare
      label-style="header"
      company-muted
      data-testid="shipping-address"
      :label="t('portal.orders.detail.shipping_address')"
      :address="shippingAddress"
    />
    <hr v-if="shippingAddress && hasAdditionalInfo" class="border-border" />
    <div
      v-if="hasAdditionalInfo"
      data-testid="order-additional-info"
      class="space-y-1"
    >
      <p class="text-foreground text-sm font-semibold">
        {{ t('portal.orders.detail.additional_info.title') }}
      </p>
      <p
        v-if="customerOrderNumber"
        data-testid="additional-your-reference"
        class="text-muted-foreground text-sm"
      >
        {{ t('portal.orders.detail.additional_info.your_reference') }}:
        {{ customerOrderNumber }}
      </p>
      <p
        v-if="goodsLabel"
        data-testid="additional-goods-label"
        class="text-muted-foreground text-sm"
      >
        {{ t('portal.orders.detail.additional_info.goods_label') }}:
        {{ goodsLabel }}
      </p>
      <p
        v-if="deliveryDate"
        data-testid="additional-delivery-date"
        class="text-muted-foreground text-sm"
      >
        {{ t('portal.orders.detail.additional_info.desired_delivery_date') }}:
        {{ deliveryDate }}
      </p>
    </div>
  </div>
</template>
