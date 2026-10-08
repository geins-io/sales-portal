<script setup lang="ts">
import { FileText } from 'lucide-vue-next';
import type {
  LineConfigurationSummary,
  PriceType,
} from '#shared/types/commerce';
import { currencyCode } from '#shared/utils/configurator-price';
import { Button } from '~/components/ui/button';
import {
  committedSpecificationRows,
  lineSpecificationTotals,
} from '~/utils/configurator-panel';

/**
 * "Visa konfiguration" on a configured line, and the specification it opens:
 * the PDP's sheet, on top of the cart where the line sits in the drawer. A
 * line committed before its structure was recorded shows its summary instead.
 */
const { productName, quantity, configuration, unitPrice, totalPrice } =
  defineProps<{
    /** The trigger's id, unique on the page. */
    id: string;
    productName: string;
    quantity: number;
    configuration: LineConfigurationSummary;
    unitPrice?: PriceType;
    totalPrice?: PriceType;
  }>();

const { t } = useI18n();
const { showPrice } = usePriceVisibility();

const open = ref(false);

const rows = computed(() =>
  committedSpecificationRows(configuration.sections ?? []),
);

const currency = computed(() => currencyCode(totalPrice ?? unitPrice));
const { money } = useSpecificationFormat(currency);

const totals = computed(() => lineSpecificationTotals(unitPrice, totalPrice));

const supportingRows = computed(() =>
  totals.value
    ? [
        {
          label:
            totals.value.ratePercent === null
              ? t('configurator.panel.vat_no_rate')
              : t('configurator.panel.vat', {
                  rate: totals.value.ratePercent,
                }),
          amount: money(totals.value.vat),
        },
        {
          label: t('configurator.panel.inc_vat'),
          amount: money(totals.value.incVat),
        },
      ]
    : [],
);
</script>

<template>
  <Button
    :id="id"
    type="button"
    variant="outline"
    size="sm"
    class="h-6 gap-1 px-2 text-[11px]"
    data-testid="line-specification-open"
    @click="open = true"
  >
    <FileText class="size-3" />
    {{ t('cart.show_configuration') }}
  </Button>

  <SpecificationSheet
    v-model:open="open"
    :product-name="productName"
    test-id="line-specification-sheet"
  >
    <SpecificationRows
      v-if="rows.length"
      :rows="rows"
      :large="true"
      :currency="currency"
    />
    <dl
      v-else-if="configuration.summary.length"
      class="divide-border/60 divide-y px-6 pb-2"
      data-testid="line-specification-summary"
    >
      <div
        v-for="(row, index) in configuration.summary"
        :key="index"
        class="space-y-1.5 py-3"
        data-testid="line-specification-summary-row"
      >
        <dt class="text-muted-foreground text-sm">{{ row.label }}</dt>
        <dd class="text-sm leading-snug break-words hyphens-auto">
          {{ row.value }}
        </dd>
      </div>
    </dl>
    <p
      v-else
      class="text-muted-foreground px-6 py-3 text-sm"
      data-testid="line-specification-default"
    >
      {{ t('cart.default_configuration') }}
    </p>

    <template v-if="showPrice && totals" #footer>
      <SpecificationPrice
        prefix="line-specification"
        size="sheet"
        :quantity="quantity"
        :net="money(totals.net)"
        :rows="supportingRows"
      />
    </template>
  </SpecificationSheet>
</template>
