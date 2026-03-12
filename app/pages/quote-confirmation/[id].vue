<script setup lang="ts">
import { NuxtLink } from '#components';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();

useHead({
  title: computed(() => t('quote.confirmation_title')),
});

const quoteNumber = computed(() => (route.query.quoteNumber as string) ?? '');
</script>

<template>
  <div
    class="mx-auto max-w-2xl px-4 py-16 text-center"
    data-testid="quote-confirmation-page"
  >
    <div class="mb-8 text-5xl">&#10003;</div>
    <h1 class="mb-4 text-2xl font-bold" data-testid="quote-confirmation-title">
      {{ t('quote.confirmation_title') }}
    </h1>
    <p
      class="text-muted-foreground mb-6"
      data-testid="quote-confirmation-message"
    >
      {{ t('quote.confirmation_message') }}
    </p>
    <p
      v-if="quoteNumber"
      class="mb-8 text-sm font-medium"
      data-testid="quote-confirmation-number"
    >
      {{ t('quote.quote_number') }}: {{ quoteNumber }}
    </p>
    <NuxtLink
      to="/portal/quotations"
      class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-6 py-3 text-sm font-medium transition-colors"
      data-testid="quote-confirmation-portal-link"
    >
      {{ t('quote.back_to_portal') }}
    </NuxtLink>
  </div>
</template>
