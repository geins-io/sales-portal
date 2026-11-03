<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';
import type {
  Company,
  CompanyAddress,
  CompanyBuyer,
} from '#shared/types/company';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import CheckoutCardHeader from './CheckoutCardHeader.vue';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    company: Company;
    buyerEmail?: string;
    customerOrderNumber: string;
    disabled?: boolean;
    /** Read-only display: an empty reference is hidden, a filled one disabled. */
    locked?: boolean;
    referenceMaxLength?: number;
    /** Under the reference field; none by default. */
    referenceHelp?: string;
  }>(),
  { referenceMaxLength: 200 },
);

const emit = defineEmits<{
  'update:customerOrderNumber': [value: string];
}>();

const billingAddress = computed<CompanyAddress | null>(() => {
  const addresses = props.company.addresses ?? [];
  return (
    addresses.find((a) => a.addressType?.toLowerCase().includes('billing')) ??
    addresses[0] ??
    null
  );
});

// Resolve the buyer to display by matching the authenticated user's email
// against the buyers list. Geins stores each buyer's email as `id` (the same
// join server/services/orders.ts uses to resolve placed-by names). Picking
// buyers[0] would show whichever buyer the company happens to list first
// (often the primary contact), not the person actually checking out.
const activeBuyer = computed<CompanyBuyer | null>(() => {
  const email = props.buyerEmail?.trim().toLowerCase();
  if (!email) return null;
  return (
    props.company.buyers?.find((b) => b.id?.trim().toLowerCase() === email) ??
    null
  );
});

const buyerName = computed(() =>
  [activeBuyer.value?.firstName, activeBuyer.value?.lastName]
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
    <CardContent class="space-y-6 px-6">
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

      <!-- PO number / reference (optional) -->
      <div v-if="!props.locked || props.customerOrderNumber" class="space-y-2">
        <Label for="checkout-customer-order-number">
          {{ t('checkout.customer_order_number') }}
        </Label>
        <Input
          id="checkout-customer-order-number"
          :model-value="props.customerOrderNumber"
          type="text"
          :placeholder="t('checkout.po_number_placeholder')"
          :disabled="props.disabled || props.locked"
          :maxlength="props.referenceMaxLength"
          data-testid="checkout-customer-order-number"
          @update:model-value="
            emit('update:customerOrderNumber', $event as string)
          "
        />
        <p
          v-if="props.referenceHelp"
          class="text-muted-foreground text-xs"
          data-testid="checkout-customer-order-number-help"
        >
          {{ props.referenceHelp }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>
