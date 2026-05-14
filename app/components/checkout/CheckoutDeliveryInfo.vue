<script setup lang="ts">
import { MapPin } from 'lucide-vue-next';
import type { Company, CompanyAddress } from '#shared/types/company';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from './CheckoutCardHeader.vue';

const { t } = useI18n();

const props = defineProps<{
  company: Company;
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
    <CardContent class="px-6">
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
    </CardContent>
  </Card>
</template>
