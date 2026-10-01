<script setup lang="ts">
import {
  ClipboardCheck,
  Copy,
  FileText,
  Loader2,
  RotateCcw,
} from 'lucide-vue-next';
import { useClipboard } from '@vueuse/core';
import { formatPrice, type PriceType } from '#shared/types/commerce';
import type { Configuration } from '#shared/types/configurator';
import {
  currencyCode,
  exVatAmount,
  incVatAmount,
  vatAmount,
  vatRatePercent,
} from '#shared/utils/configurator-price';
import type { ConfiguratorSessionStatus } from '~/composables/useConfiguratorSession';
import { Button } from '~/components/ui/button';
import { optionPricePrefix } from '~/utils/configurator-form';
import {
  groupSpecificationRows,
  specificationRows,
  specificationText,
  type SpecificationValue,
} from '~/utils/configurator-panel';

/**
 * The configuration as a specification rather than a receipt: what has been
 * chosen, grouped by the section it was chosen in, with the price built up
 * underneath. What is still missing is listed under the section rail.
 *
 * Flat props rather than the session composable's return object: the panel must
 * mount without a session for its tests, and a spread object hides which fields
 * it reads. The action and the countdown are siblings in the card, not blocks
 * here — the action is replaced wholesale in a later milestone.
 */
const { configuration, status, busy, productName, articleNumber } =
  defineProps<{
    configuration: Configuration | null;
    status: ConfiguratorSessionStatus;
    busy: boolean;
    productName: string;
    articleNumber: string;
  }>();

const emit = defineEmits<{ restart: [] }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();

const rows = computed(() =>
  configuration ? specificationRows(configuration) : [],
);
const grouped = computed(() => groupSpecificationRows(rows.value));

function money(net: number): string {
  return formatPrice(
    net,
    currencyCode(configuration?.unitPrice),
    formatLocale.value,
  );
}

/**
 * Net leads and VAT and the total support it, as the prototype. Every figure is
 * the unit price as sent, already net of any discount; none is derived from
 * another.
 */
const price = computed(() => money(exVatAmount(configuration?.unitPrice)));

const vatLabel = computed(() => {
  const rate = vatRatePercent(configuration?.unitPrice);
  return rate === null
    ? t('configurator.panel.vat_no_rate')
    : t('configurator.panel.vat', { rate });
});

const supportingRows = computed(() => [
  { label: vatLabel.value, amount: money(vatAmount(configuration?.unitPrice)) },
  {
    label: t('configurator.panel.inc_vat'),
    amount: money(incVatAmount(configuration?.unitPrice)),
  },
]);

/**
 * A number is written the way the field the buyer typed it in writes it, down
 * to the decimals the provider asked for: the specification is made to be
 * pasted into a mail, and two shapes of the same measurement is a question the
 * reader has to ask.
 */
function numberText(value: number, decimals: number | undefined): string {
  return new Intl.NumberFormat(formatLocale.value, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(value);
}

/** A value reads the same on screen and in the copied text. */
function valueText(value: SpecificationValue): string {
  const written = value.none
    ? t('configurator.none_option')
    : value.boolValue
      ? t('configurator.yes')
      : value.number !== undefined
        ? numberText(value.number, value.decimals)
        : (value.text ?? '');
  const text = value.unit ? `${written} ${value.unit}` : written;
  if (!value.quantity || value.quantity <= 1) return text;
  return `${text} · ${t('configurator.panel.quantity_suffix', { count: value.quantity })}`;
}

/**
 * A price, or nothing. The rule is the option row's: a choice the provider
 * charges nothing for says nothing, rather than a column of zeroes.
 */
function priceText(price: PriceType): string | null {
  if (!showPrice.value) return null;
  const net = exVatAmount(price);
  const prefix = optionPricePrefix(net);
  if (prefix === null) return null;
  return `${prefix}${money(net)}`;
}

function valuePrice(value: SpecificationValue): string | null {
  return value.price ? priceText(value.price) : null;
}

const asText = computed(() =>
  specificationText({
    productName,
    articleNumber,
    quantityLine: t('configurator.panel.copy_quantity', {
      count: configuration?.quantity ?? 1,
    }),
    rows: rows.value,
    formatValue: valueText,
    formatPrice: priceText,
    ...(showPrice.value
      ? {
          price: {
            lines: [
              { label: t('configurator.panel.net_price'), amount: price.value },
              ...supportingRows.value,
            ],
            note: t('configurator.panel.indicative'),
          },
        }
      : {}),
  }),
);

const { copy, copied, isSupported } = useClipboard({
  source: asText,
  copiedDuring: 2000,
});

// `isSupported` differs between the server (false) and the client (true), which
// is a hydration mismatch. The button appears after mounting, so the server and
// the first client render agree.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
const canCopy = computed(() => mounted.value && isSupported.value);
</script>

<template>
  <!--
    An expired session is a state, not a failure: it says so and offers the way
    back, with no specification and no price left to report.
  -->
  <div
    v-if="status === 'expired'"
    class="bg-muted flex flex-wrap items-center justify-between gap-3 px-4 py-3"
    data-testid="configurator-panel-expired"
  >
    <p class="text-sm">{{ t('configurator.panel.expired') }}</p>
    <Button variant="outline" size="sm" @click="emit('restart')">
      <RotateCcw class="size-4" />
      {{ t('configurator.panel.start_over') }}
    </Button>
  </div>

  <!-- The header stands before the document does, so the card is in place
       while the session starts; everything under it waits for the document. -->
  <header v-else class="px-4 py-3" data-testid="configurator-panel-header">
    <h3 class="flex items-center gap-2 text-sm font-semibold">
      <FileText class="size-4" />
      {{ t('configurator.panel.title') }}
    </h3>
  </header>

  <!-- While the session starts the card is its header over an empty body, as
       tall as a loaded card's sections (Bookcase, 1440 wide: rows from 96, price
       90, validity 173, action 65, session 56), so it grows little when the
       document arrives. One block, so the card draws no dividers inside it. -->
  <div
    v-if="status !== 'expired' && !configuration"
    :class="showPrice ? 'min-h-[480px]' : 'min-h-[390px]'"
    data-testid="configurator-card-empty"
  />

  <template v-if="status !== 'expired' && configuration">
    <!-- The specification itself. The value is the content and the price is an
         annotation, so the value leads and a price appears only where there is
         one. -->
    <div
      v-if="grouped.length"
      class="px-4 py-3"
      data-testid="configurator-panel-rows"
    >
      <div
        v-for="[group, groupRows] in grouped"
        :key="group"
        class="mb-3 last:mb-0"
      >
        <h4
          class="text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase"
        >
          {{ group }}
        </h4>
        <dl class="divide-border/60 divide-y">
          <div v-for="row in groupRows" :key="row.id" class="py-1.5">
            <dt class="text-muted-foreground text-[11px]">{{ row.label }}</dt>
            <dd
              v-for="(value, index) in row.values"
              :key="index"
              class="flex items-baseline justify-between gap-3"
            >
              <!-- Provider part names are long compounds that do not break on
                   their own, and an unbreakable word would spill out of the
                   column. -->
              <span class="text-[13px] leading-snug break-words hyphens-auto">
                {{ valueText(value) }}
              </span>
              <span
                v-if="valuePrice(value)"
                class="text-muted-foreground shrink-0 text-[11px] tabular-nums"
              >
                {{ valuePrice(value) }}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div
      v-if="showPrice"
      class="px-4 py-3"
      data-testid="configurator-panel-price"
    >
      <div
        class="flex items-baseline justify-between gap-3"
        data-testid="configurator-panel-price-row"
      >
        <span class="text-muted-foreground text-xs">
          {{ t('configurator.panel.net_price') }}
          <template v-if="configuration.quantity > 1">
            ·
            {{
              t('configurator.panel.quantity_suffix', {
                count: configuration.quantity,
              })
            }}
          </template>
        </span>
        <span
          class="text-xl font-semibold tabular-nums transition-opacity"
          :class="busy ? 'opacity-40' : ''"
          data-testid="configurator-panel-net"
        >
          {{ price }}
        </span>
      </div>
      <div
        v-for="(row, index) in supportingRows"
        :key="index"
        class="text-muted-foreground flex justify-between gap-3 text-[11px]"
        :class="index === 0 ? 'mt-1' : ''"
        data-testid="configurator-panel-price-row"
      >
        <span>{{ row.label }}</span>
        <span class="tabular-nums">{{ row.amount }}</span>
      </div>
    </div>

    <div v-if="canCopy" class="px-4 py-2">
      <button
        type="button"
        class="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium"
        data-testid="configurator-panel-copy"
        @click="copy()"
      >
        <ClipboardCheck v-if="copied" class="text-success size-3.5" />
        <Copy v-else class="size-3.5" />
        {{
          copied ? t('configurator.panel.copied') : t('configurator.panel.copy')
        }}
      </button>
    </div>

    <p
      v-if="busy"
      class="text-muted-foreground flex items-center gap-2 px-4 py-2 text-sm"
      data-testid="configurator-panel-busy"
    >
      <Loader2 class="size-4 animate-spin" />
      {{ t('configurator.panel.recomputing') }}
    </p>
  </template>
</template>
