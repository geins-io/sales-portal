<script setup lang="ts">
import { Package } from 'lucide-vue-next';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from '~/components/checkout/CheckoutCardHeader.vue';
import type { QuoteLineItem } from '#shared/types/quote';

defineProps<{ items: QuoteLineItem[] }>();

defineSlots<{
  /** In place of the table when there are no lines. */
  empty?: () => unknown;
}>();

const { t } = useI18n();
</script>

<template>
  <Card class="gap-0" data-testid="quote-articles">
    <CheckoutCardHeader
      :icon="Package"
      :title="t('portal.quotations.items_heading')"
    />
    <CardContent class="px-6 pt-4">
      <PortalQuoteItems v-if="items.length" :items="items" />
      <slot v-else name="empty" />
    </CardContent>
  </Card>
</template>
