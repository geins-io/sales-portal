<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';
import type {
  Company,
  CompanyAddress,
  CompanyBuyer,
} from '#shared/types/company';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from './CheckoutCardHeader.vue';

const { t } = useI18n();

const props = defineProps<{
  company: Company;
  buyerEmail?: string;
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
    <CheckoutCardHeader
      :icon="Building2"
      :title="t('checkout.company_and_billing_info')"
    />
    <CardContent class="px-6">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <!-- Left: company identifiers -->
        <div class="space-y-3">
          <div data-testid="company-name">
            <p
              class="text-foreground text-xs font-medium tracking-wide uppercase"
            >
              {{ t('checkout.company_name') }}
            </p>
            <p class="text-muted-foreground text-sm">
              {{ props.company.name ?? '' }}
            </p>
          </div>
          <div data-testid="company-vat">
            <p
              class="text-foreground text-xs font-medium tracking-wide uppercase"
            >
              {{ t('checkout.vat_number') }}
            </p>
            <p class="text-muted-foreground text-sm">
              {{ props.company.vatNumber ?? '' }}
            </p>
          </div>
        </div>

        <!-- Right: billing address + buyer -->
        <div class="space-y-3">
          <div v-if="billingAddress" data-testid="company-billing-address">
            <p
              class="text-foreground text-xs font-medium tracking-wide uppercase"
            >
              {{ t('checkout.billing_address') }}
            </p>
            <p class="text-muted-foreground mt-1 text-sm">
              {{
                [
                  billingAddress.addressLine1,
                  [billingAddress.zip, billingAddress.city]
                    .filter(Boolean)
                    .join(' '),
                  billingAddress.country,
                ]
                  .filter(Boolean)
                  .join(', ')
              }}
            </p>
          </div>
          <div v-if="buyerName || props.buyerEmail" data-testid="company-buyer">
            <p
              class="text-foreground text-xs font-medium tracking-wide uppercase"
            >
              {{ t('checkout.buyer') }}
            </p>
            <div class="mt-1 space-y-0.5">
              <p v-if="buyerName" class="text-muted-foreground text-sm">
                {{ buyerName }}
              </p>
              <p v-if="props.buyerEmail" class="text-muted-foreground text-sm">
                {{ props.buyerEmail }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
