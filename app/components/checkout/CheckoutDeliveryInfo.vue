<script setup lang="ts">
import { MapPin } from 'lucide-vue-next';
import type { Company, CompanyAddress } from '#shared/types/company';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import CheckoutCardHeader from './CheckoutCardHeader.vue';

const { t } = useI18n();

const props = defineProps<{
  company: Company;
  desiredDeliveryDate: string;
  goodsLabel: string;
  disabled?: boolean;
  todayIso: string;
}>();

const emit = defineEmits<{
  'update:desiredDeliveryDate': [value: string];
  'update:goodsLabel': [value: string];
}>();

const billingAddress = computed<CompanyAddress | null>(() => {
  const addresses = props.company.addresses ?? [];
  return (
    addresses.find((a) => a.addressType?.toLowerCase().includes('billing')) ??
    addresses[0] ??
    null
  );
});

const deliveryAddress = computed<CompanyAddress | null>(() => {
  const addresses = props.company.addresses ?? [];
  return (
    addresses.find(
      (a) =>
        a.addressType?.toLowerCase().includes('delivery') ||
        a.addressType?.toLowerCase().includes('shipping'),
    ) ?? billingAddress.value
  );
});
</script>

<template>
  <Card data-testid="checkout-delivery-info">
    <CheckoutCardHeader :icon="MapPin" :title="t('checkout.delivery_info')" />
    <CardContent class="space-y-4 px-6">
      <div v-if="deliveryAddress" data-testid="delivery-address">
        <p
          class="text-foreground mb-1 text-xs font-medium tracking-wide uppercase"
          data-testid="delivery-address-label"
        >
          {{ t('checkout.delivery_address') }}
        </p>
        <div class="text-muted-foreground space-y-0.5 text-sm">
          <p v-if="deliveryAddress.addressLine1">
            {{ deliveryAddress.addressLine1 }}
          </p>
          <p v-if="deliveryAddress.zip || deliveryAddress.city">
            {{
              [deliveryAddress.zip, deliveryAddress.city]
                .filter(Boolean)
                .join(' ')
            }}
          </p>
          <p v-if="deliveryAddress.country">{{ deliveryAddress.country }}</p>
        </div>
      </div>

      <!-- Desired delivery date + goods label sit side by side (50%) on
           desktop and stack on mobile. A styled calendar picker can replace
           the native date input in a future iteration; the hard requirement
           is past disabled and all future dates selectable, which :min
           satisfies with a native input. -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- Desired delivery date (optional) -->
        <div class="space-y-2">
          <Label for="checkout-desired-delivery-date">{{
            t('checkout.desired_delivery_date')
          }}</Label>
          <Input
            id="checkout-desired-delivery-date"
            type="date"
            :model-value="props.desiredDeliveryDate"
            :min="props.todayIso"
            :disabled="props.disabled"
            data-testid="checkout-desired-delivery-date"
            @update:model-value="
              emit('update:desiredDeliveryDate', $event as string)
            "
          />
          <p class="text-muted-foreground text-xs">
            {{ t('checkout.desired_delivery_date_helper') }}
          </p>
        </div>

        <!-- Goods label (optional) -->
        <div class="space-y-2">
          <Label for="checkout-goods-label">{{
            t('checkout.goods_label')
          }}</Label>
          <Input
            id="checkout-goods-label"
            :model-value="props.goodsLabel"
            type="text"
            :placeholder="t('checkout.goods_label_placeholder')"
            :disabled="props.disabled"
            maxlength="500"
            data-testid="checkout-goods-label"
            @update:model-value="emit('update:goodsLabel', $event as string)"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
