<script setup lang="ts">
/** Where an add to a quote request landed, with the way to the draft. */
import { CircleCheck } from 'lucide-vue-next';

const props = defineProps<{
  quoteId: string;
  name: string;
  /** The buyer made a new draft for it rather than picking one. */
  created?: boolean;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();

const draftLink = computed(() =>
  localePath(`/portal/quotations/${encodeURIComponent(props.quoteId)}`),
);
</script>

<template>
  <div
    role="status"
    data-testid="add-to-quote-confirmation"
    class="bg-muted/40 border-border rounded-md border px-3 py-2.5 text-sm"
  >
    <p class="flex items-start gap-2">
      <CircleCheck class="text-primary mt-0.5 size-4 shrink-0" />
      <span>
        {{
          created
            ? t('product.quote_menu.added_new')
            : t('product.quote_menu.added')
        }}
        <strong class="font-medium">{{ name }}</strong>
      </span>
    </p>
    <p class="mt-1.5 pl-6">
      <NuxtLink
        :to="draftLink"
        class="text-primary text-sm font-medium hover:underline"
        data-testid="add-to-quote-view"
      >
        {{ t('product.quote_menu.view') }}
      </NuxtLink>
    </p>
  </div>
</template>
