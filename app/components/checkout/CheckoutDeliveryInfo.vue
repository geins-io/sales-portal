<script setup lang="ts">
import { MapPin } from 'lucide-vue-next';
import type { Company, CompanyAddress } from '#shared/types/company';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';

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
    <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
      <MapPin class="text-muted-foreground size-5" />
      <CardTitle class="text-lg">{{ t('checkout.delivery_info') }}</CardTitle>
    </CardHeader>
    <CardContent class="px-6">
      <div v-if="deliveryAddress" data-testid="delivery-address">
        <div class="space-y-0.5 text-sm">
          <p>
            {{
              [deliveryAddress.firstName, deliveryAddress.lastName]
                .filter(Boolean)
                .join(' ')
            }}
          </p>
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
          <p v-if="deliveryAddress.phone">{{ deliveryAddress.phone }}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
