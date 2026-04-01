<script setup lang="ts">
import { FileText } from 'lucide-vue-next';
import type { CheckoutPaymentTerms } from '#shared/types/commerce';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

const { t } = useI18n();

const props = defineProps<{
  poNumber: string;
  currency: string | null;
  paymentTerms: CheckoutPaymentTerms[] | null;
}>();

const emit = defineEmits<{
  'update:poNumber': [value: string];
}>();
</script>

<template>
  <Card data-testid="checkout-invoice-info">
    <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
      <FileText class="text-muted-foreground size-5" />
      <CardTitle class="text-lg">{{ t('checkout.invoice_info') }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4 px-6">
      <!-- PO Number -->
      <div class="space-y-2">
        <Label for="checkout-po-number">{{ t('checkout.po_number') }}</Label>
        <Input
          id="checkout-po-number"
          :model-value="props.poNumber"
          type="text"
          :placeholder="t('checkout.po_number_placeholder')"
          data-testid="checkout-po-number"
          @update:model-value="emit('update:poNumber', $event as string)"
        />
      </div>

      <!-- Payment Terms -->
      <div
        v-if="props.paymentTerms?.length"
        data-testid="checkout-payment-terms"
      >
        <Label>{{ t('checkout.payment_terms') }}</Label>
        <table class="mt-2 w-full text-sm">
          <thead>
            <tr class="border-border border-b">
              <th class="text-muted-foreground pb-2 text-left font-medium">
                {{ t('checkout.payment_terms') }}
              </th>
              <th class="text-muted-foreground pb-2 text-right font-medium">
                {{ t('checkout.payment_terms_days') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="term in props.paymentTerms"
              :key="term.name"
              class="border-border border-b last:border-0"
            >
              <td class="py-2">{{ term.name }}</td>
              <td class="py-2 text-right">{{ term.days ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Currency -->
      <div v-if="props.currency" data-testid="checkout-currency">
        <Label>{{ t('checkout.currency') }}</Label>
        <p class="text-muted-foreground mt-1 text-sm">{{ props.currency }}</p>
      </div>
    </CardContent>
  </Card>
</template>
