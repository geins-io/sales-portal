<script setup lang="ts">
import {
  groupSpecificationRows,
  type SpecificationRow,
} from '~/utils/configurator-panel';

/**
 * The chosen values by section, at two sizes: the PDP's column, and the larger
 * sheet the PDP's panel and a configured line both open. The value is the
 * content and the price an annotation, so the value leads and a price appears
 * only where there is one.
 */
const { rows, large, currency } = defineProps<{
  rows: SpecificationRow[];
  large: boolean;
  /** The currency the option prices are written in. */
  currency: string | undefined;
}>();

const { valueText, valuePrice } = useSpecificationFormat(() => currency);

const grouped = computed(() => groupSpecificationRows(rows));
</script>

<template>
  <div
    v-for="[group, groupRows] in grouped"
    :key="group"
    :class="large ? '' : 'mb-3 last:mb-0'"
  >
    <h4
      :class="
        large
          ? 'bg-muted text-foreground px-6 py-2.5 text-sm font-medium'
          : 'text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase'
      "
    >
      {{ group }}
    </h4>
    <dl class="divide-border/60 divide-y" :class="large ? 'px-6 pb-2' : ''">
      <div
        v-for="row in groupRows"
        :key="row.id"
        :class="large ? 'space-y-1.5 py-3' : 'py-1.5'"
      >
        <dt
          class="text-muted-foreground"
          :class="large ? 'text-sm' : 'text-[11px]'"
        >
          {{ row.label }}
        </dt>
        <dd
          v-for="(value, index) in row.values"
          :key="index"
          class="flex items-baseline justify-between gap-3"
        >
          <!-- Provider part names are long compounds that do not break on
               their own, and an unbreakable word would spill out of the
               column. -->
          <span
            class="leading-snug break-words hyphens-auto"
            :class="large ? 'text-sm' : 'text-[13px]'"
          >
            {{ valueText(value) }}
          </span>
          <span
            v-if="valuePrice(value)"
            class="text-muted-foreground shrink-0 tabular-nums"
            :class="large ? 'text-xs' : 'text-[11px]'"
          >
            {{ valuePrice(value) }}
          </span>
        </dd>
      </div>
    </dl>
  </div>
</template>
