<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next';

/**
 * The confirmation's own top part. The order itself renders in the default
 * slot, below the card, with the portal order page's components.
 */
const props = defineProps<{
  /**
   * Human-friendly numeric order id forwarded from the checkout page in the
   * URL, so the badge renders before the order is readable.
   */
  orderNumber?: string;
  /**
   * The order's public id, which is the key the portal's order endpoints take.
   * Distinct from `orderNumber`, which is the numeric id shown to the buyer.
   */
  publicOrderId?: string;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();

/**
 * Where "view order in the portal" goes: the order's own page.
 *
 * A freshly placed order is not readable for several seconds, so the page
 * could otherwise answer 404. `awaiting` tells it to wait for this order
 * instead. The list only when there is no order id at all.
 */
const viewOrderLink = computed(() => {
  if (!props.publicOrderId) return localePath('/portal/orders');
  const id = encodeURIComponent(props.publicOrderId);
  return `${localePath(`/portal/orders/${id}`)}?awaiting=${id}`;
});
</script>

<template>
  <div data-testid="order-confirmation">
    <article
      class="border-border bg-card mx-auto max-w-3xl rounded-xl border px-8 py-10 sm:px-12 sm:py-12"
    >
      <!-- Header: icon + heading + subtitle + badge -->
      <header class="flex flex-col items-center gap-3 text-center">
        <CircleCheck class="text-primary size-12" data-testid="confirm-icon" />
        <h1 class="text-2xl font-bold sm:text-3xl">
          {{ t('order_confirmation.thank_you') }}
        </h1>
        <p class="text-muted-foreground max-w-md text-sm">
          {{ t('order_confirmation.confirmation_subtitle') }}
        </p>
        <div
          v-if="orderNumber"
          class="bg-muted mt-2 inline-flex items-center gap-2 rounded-md px-4 py-2"
          data-testid="order-number"
        >
          <span
            class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          >
            {{ t('order_confirmation.order_number') }}:
          </span>
          <span class="text-sm font-semibold">{{ orderNumber }}</span>
        </div>
      </header>

      <!-- Full-width CTA -->
      <NuxtLink
        :to="viewOrderLink"
        class="bg-button-background text-primary-foreground hover:bg-button-background/90 mt-8 flex w-full items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-colors"
        data-testid="view-order-cta"
      >
        {{ t('order_confirmation.view_order_in_portal') }}
      </NuxtLink>
    </article>

    <slot />

    <!-- Back to store link below the card -->
    <div class="mt-6 text-center">
      <NuxtLink
        :to="localePath('/')"
        class="text-primary text-sm font-medium hover:opacity-80"
        data-testid="back-to-store"
      >
        &larr; {{ t('order_confirmation.back_to_store') }}
      </NuxtLink>
    </div>
  </div>
</template>
