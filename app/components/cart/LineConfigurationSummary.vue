<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import type { CartLineConfigurationRow } from '#shared/types/commerce';

/**
 * What a configured line was committed with, collapsed under the line. The
 * default slot sits at the foot of the rows, for what only one place offers:
 * the cart fills it with the way to edit the line.
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
  <template v-if="summary.length">
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
      {{
        expanded ? t('cart.hide_configuration') : t('cart.show_configuration')
      }}
    </button>
    <dl
      v-show="expanded"
      :id="id"
      class="bg-muted/40 mt-2 space-y-1 rounded-md p-3 text-xs"
      data-testid="cart-item-configuration"
    >
      <div
        v-for="(row, index) in summary"
        :key="index"
        class="flex justify-between gap-3"
        data-testid="cart-item-configuration-row"
      >
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="text-foreground text-right">{{ row.value }}</dd>
      </div>
      <!-- A <dl> holds only groups of <dt> and <dd>, so the slot gets a
           <div> of its own. -->
      <div v-if="$slots.default" data-testid="cart-item-configuration-foot">
        <slot />
      </div>
    </dl>
  </template>
</template>
