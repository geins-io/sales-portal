<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';
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
</script>

<template>
  <Card data-testid="checkout-company-info">
    <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
      <Building2 class="text-muted-foreground size-5" />
      <CardTitle class="text-lg">{{
        t('checkout.company_and_billing_info')
      }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3 px-6">
      <div data-testid="company-name">
        <p
          class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          {{ t('checkout.company_name') }}
        </p>
        <p class="text-sm">{{ props.company.name ?? '' }}</p>
      </div>
      <div data-testid="company-vat">
        <p
          class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          {{ t('checkout.vat_number') }}
        </p>
        <p class="text-sm">{{ props.company.vatNumber ?? '' }}</p>
      </div>
      <div v-if="billingAddress" data-testid="company-billing-address">
        <p
          class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          {{ t('checkout.billing_address') }}
        </p>
        <div class="mt-1 space-y-0.5 text-sm">
          <p>
            {{
              [billingAddress.firstName, billingAddress.lastName]
                .filter(Boolean)
                .join(' ')
            }}
          </p>
          <p v-if="billingAddress.company">{{ billingAddress.company }}</p>
          <p v-if="billingAddress.addressLine1">
            {{ billingAddress.addressLine1 }}
          </p>
          <p v-if="billingAddress.zip || billingAddress.city">
            {{
              [billingAddress.zip, billingAddress.city]
                .filter(Boolean)
                .join(' ')
            }}
          </p>
          <p v-if="billingAddress.country">{{ billingAddress.country }}</p>
          <p v-if="billingAddress.phone">{{ billingAddress.phone }}</p>
          <p v-if="billingAddress.email">{{ billingAddress.email }}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
