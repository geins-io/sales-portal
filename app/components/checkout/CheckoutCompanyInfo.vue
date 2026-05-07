<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';
import type {
  Company,
  CompanyAddress,
  CompanyBuyer,
} from '#shared/types/company';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';

const { t } = useI18n();

const props = defineProps<{
  company: Company;
}>();

const emit = defineEmits<{
  changeCompanyDetails: [];
}>();

const billingAddress = computed<CompanyAddress | null>(() => {
  const addresses = props.company.addresses ?? [];
  return (
    addresses.find((a) => a.addressType?.toLowerCase().includes('billing')) ??
    addresses[0] ??
    null
  );
});

const primaryBuyer = computed<CompanyBuyer | null>(
  () => props.company.buyers?.[0] ?? null,
);

const buyerName = computed(() =>
  [primaryBuyer.value?.firstName, primaryBuyer.value?.lastName]
    .filter(Boolean)
    .join(' '),
);
</script>

<template>
  <Card data-testid="checkout-company-info">
    <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
      <Building2 class="text-muted-foreground size-5 shrink-0" />
      <CardTitle class="text-lg">{{
        t('checkout.company_and_billing_info')
      }}</CardTitle>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground ml-auto text-xs underline-offset-2 hover:underline"
        data-testid="change-company-details"
        @click="emit('changeCompanyDetails')"
      >
        {{ t('checkout.change_company_details') }}
      </button>
    </CardHeader>
    <CardContent class="px-6">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <!-- Left: company identifiers -->
        <div class="space-y-3">
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
        </div>

        <!-- Right: billing address + buyer -->
        <div class="space-y-3">
          <div v-if="billingAddress" data-testid="company-billing-address">
            <p
              class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              {{ t('checkout.billing_address') }}
            </p>
            <div class="mt-1 space-y-0.5 text-sm">
              <p v-if="billingAddress.company">{{ billingAddress.company }}</p>
              <p>
                {{
                  [billingAddress.firstName, billingAddress.lastName]
                    .filter(Boolean)
                    .join(' ')
                }}
              </p>
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
            </div>
          </div>
          <div
            v-if="buyerName || billingAddress?.email"
            data-testid="company-buyer"
          >
            <p
              class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              {{ t('checkout.buyer') }}
            </p>
            <div class="mt-1 space-y-0.5 text-sm">
              <p v-if="buyerName">{{ buyerName }}</p>
              <p
                v-if="billingAddress?.email"
                class="text-muted-foreground text-xs"
              >
                {{ billingAddress.email }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
