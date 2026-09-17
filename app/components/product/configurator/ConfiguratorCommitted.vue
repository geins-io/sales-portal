<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next';
import { formatPrice } from '#shared/types/commerce';
import type { CommittedConfiguration } from '#shared/types/configurator';

/**
 * What the buyer ends with: the committed configuration, read-only.
 *
 * A configured result has no article number of its own, so the summary lines
 * are the whole description of what was built. Where this leads — a configured
 * cart line — is a later milestone; nothing here offers it.
 */
const { committed } = defineProps<{ committed: CommittedConfiguration }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();

function money(net: number, currency: string): string {
  return formatPrice(net, currency, formatLocale.value);
}

const unitPrice = computed(() =>
  money(committed.unitPrice.net, committed.unitPrice.currency),
);
</script>

<template>
  <div class="space-y-4" data-testid="configurator-committed">
    <div class="flex items-center gap-2">
      <CheckCircle2 class="size-5 shrink-0" />
      <h2 class="text-lg font-semibold">
        {{ t('configurator.committed.heading') }}
      </h2>
    </div>

    <dl class="divide-border divide-y" data-testid="configurator-summary">
      <div
        v-for="(line, index) in committed.summary"
        :key="index"
        class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
      >
        <dt class="text-muted-foreground text-sm">{{ line.label }}</dt>
        <dd class="flex items-baseline gap-3 text-sm">
          <span>{{ line.value }}</span>
          <span v-if="showPrice && line.price" class="tabular-nums">
            {{ money(line.price.net, line.price.currency) }}
          </span>
        </dd>
      </div>
    </dl>

    <div
      v-if="showPrice"
      class="flex items-baseline justify-between gap-4 border-t pt-3"
      data-testid="configurator-committed-price"
    >
      <span class="text-sm">{{ t('configurator.committed.unit_price') }}</span>
      <span class="text-xl font-semibold tabular-nums">{{ unitPrice }}</span>
    </div>
  </div>
</template>
