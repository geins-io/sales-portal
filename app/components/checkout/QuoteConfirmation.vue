<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next';

/**
 * The top card of the thank-you pages in the quotation flow, in the order
 * confirmation's look: after a quote request was sent (`request`) and after an
 * order was placed from a quotation (`order`). What it contains renders in the
 * default slot, below the card.
 */
const props = defineProps<{
  kind: 'request' | 'order';
  /** The request's quotation number, or the order's number. */
  number: string;
  /** The quotation an order came from, by its number. */
  quoteNumber?: string;
  /** The quotation's own page in the portal. */
  quotationPath: string;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();

const isRequest = computed(() => props.kind === 'request');
const key = (name: string) => `portal.quotations.confirm.${name}`;
</script>

<template>
  <div data-testid="quote-thanks" :data-kind="kind">
    <article
      class="border-border bg-card mx-auto max-w-3xl rounded-xl border px-8 py-10 sm:p-12"
    >
      <header class="flex flex-col items-center gap-3 text-center">
        <CircleCheck class="text-primary size-12" aria-hidden="true" />
        <h1 class="text-2xl font-bold sm:text-3xl">
          {{ t(key(isRequest ? 'request_title' : 'order_title')) }}
        </h1>
        <p class="text-muted-foreground max-w-md text-sm">
          {{ t(key(isRequest ? 'request_body' : 'order_body')) }}
        </p>
        <div
          class="bg-muted mt-2 inline-flex items-center gap-2 rounded-md px-4 py-2"
          data-testid="quote-thanks-number"
        >
          <span
            class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          >
            {{ t(key(isRequest ? 'request_number' : 'order_number')) }}:
          </span>
          <span class="text-sm font-semibold">{{ number }}</span>
        </div>
        <p
          v-if="!isRequest && quoteNumber"
          class="text-muted-foreground text-xs"
          data-testid="quote-thanks-from"
        >
          {{ t(key('from_quotation'), { number: quoteNumber }) }}
        </p>
      </header>

      <ol
        v-if="isRequest"
        class="text-muted-foreground mx-auto mt-8 max-w-md list-decimal space-y-1.5 pl-5 text-sm"
        data-testid="quote-thanks-next"
      >
        <li>{{ t(key('next_1')) }}</li>
        <li>{{ t(key('next_2')) }}</li>
        <li>{{ t(key('next_3')) }}</li>
      </ol>

      <div class="mt-8 space-y-3 text-center">
        <NuxtLink
          :to="quotationPath"
          class="bg-button-background text-button-text hover:bg-button-background/90 flex w-full items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-colors"
          data-testid="quote-thanks-portal"
        >
          {{ t(key(isRequest ? 'view_request' : 'view_quotation')) }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/products')"
          class="text-primary inline-block text-sm font-medium hover:underline"
          data-testid="quote-thanks-continue"
        >
          {{ t(key('continue_shopping')) }}
        </NuxtLink>
      </div>
    </article>

    <slot />
  </div>
</template>
