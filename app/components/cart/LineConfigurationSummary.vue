<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import type { CartLineConfigurationRow } from '#shared/types/commerce';

/**
 * What a configured line was committed with, collapsed under the line. A line
 * committed with the defaults only has no rows and says so when opened.
 */
const { summary, id } = defineProps<{
  summary: CartLineConfigurationRow[];
  /** The block's id, which the toggle controls. Unique on the page. */
  id: string;
}>();

const { t } = useI18n();
const expanded = ref(false);
</script>

<template>
  <button
    type="button"
    class="text-primary flex items-center gap-1 text-xs font-medium"
    :aria-expanded="expanded"
    :aria-controls="id"
    data-testid="cart-item-configuration-toggle"
    @click="expanded = !expanded"
  >
    <ChevronDown
      class="size-3.5 transition-transform"
      :class="{ '-rotate-90': !expanded }"
    />
    {{ expanded ? t('cart.hide_configuration') : t('cart.show_configuration') }}
  </button>
  <div
    v-show="expanded"
    :id="id"
    class="bg-muted/40 mt-2 rounded-md p-3 text-xs"
    data-testid="cart-item-configuration"
  >
    <dl v-if="summary.length" class="space-y-1">
      <div
        v-for="(row, index) in summary"
        :key="index"
        class="flex justify-between gap-3"
        data-testid="cart-item-configuration-row"
      >
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="text-foreground text-right">{{ row.value }}</dd>
      </div>
    </dl>
    <p
      v-else
      class="text-muted-foreground"
      data-testid="cart-item-configuration-default"
    >
      {{ t('cart.default_configuration') }}
    </p>
  </div>
</template>
