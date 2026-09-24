<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  Loader2,
  RotateCcw,
} from 'lucide-vue-next';
import { useClipboard } from '@vueuse/core';
import { formatPrice } from '#shared/types/commerce';
import type { Configuration, Money } from '#shared/types/configurator';
import type { ConfiguratorSessionStatus } from '~/composables/useConfiguratorSession';
import { Button } from '~/components/ui/button';
import { optionPricePrefix } from '~/utils/configurator-form';
import {
  collectBlockingNames,
  groupSpecificationRows,
  specificationRows,
  specificationText,
  unnamedBlockingMessages,
  type SpecificationValue,
} from '~/utils/configurator-panel';

/**
 * The configuration as a specification rather than a receipt: what has been
 * chosen, grouped by the section it was chosen in, with the price built up
 * underneath and whether the whole thing is complete.
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

/** What is missing, by name, and whatever the names do not cover. */
const blockingNames = computed(() =>
  configuration ? collectBlockingNames(configuration) : [],
);
const blockingMessages = computed(() =>
  configuration ? unnamedBlockingMessages(configuration) : [],
);

function money(net: number): string {
  return formatPrice(
    net,
    configuration?.unitPrice.currency,
    formatLocale.value,
  );
}

/**
 * `unitPrice` arrives with the discount already taken off, so the percentage is
 * information beside it and never arithmetic on it.
 */
const discountPercent = computed(() => configuration?.discountPercent ?? 0);
const price = computed(() => money(configuration?.unitPrice.net ?? 0));

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
  const written = value.boolValue
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
function priceText(price: Money): string | null {
  if (!showPrice.value) return null;
  const prefix = optionPricePrefix(price.net);
  if (prefix === null) return null;
  return `${prefix}${money(price.net)}`;
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
            label: t('configurator.panel.net_price'),
            amount: price.value,
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

  <template v-else-if="configuration">
    <header class="px-4 py-3" data-testid="configurator-panel-header">
      <h3 class="flex items-center gap-2 text-sm font-semibold">
        <FileText class="size-4" />
        {{ t('configurator.panel.title') }}
      </h3>
    </header>

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
      <div class="flex items-baseline justify-between gap-3">
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
          class="flex items-baseline gap-2 text-xl font-semibold tabular-nums transition-opacity"
          :class="busy ? 'opacity-40' : ''"
        >
          {{ price }}
          <span
            v-if="discountPercent > 0"
            class="bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-medium"
          >
            −{{ discountPercent }}%
          </span>
        </span>
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

    <!-- Complete, or incomplete with what is missing. The action is never dead
         without a reason beside it. -->
    <div class="px-4 py-3">
      <div
        class="flex items-start gap-2 rounded-md px-3 py-2 text-sm"
        :class="
          configuration.isValid
            ? 'bg-success/10 text-success'
            : 'bg-warning/10 text-warning'
        "
        data-testid="configurator-panel-validity"
      >
        <CheckCircle2
          v-if="configuration.isValid"
          class="mt-0.5 size-4 shrink-0"
        />
        <AlertCircle v-else class="mt-0.5 size-4 shrink-0" />
        <p v-if="configuration.isValid">{{ t('configurator.panel.valid') }}</p>
        <div v-else class="space-y-1">
          <p v-if="blockingNames.length">
            {{
              t('configurator.panel.invalid', {
                items: blockingNames.join(', '),
              })
            }}
          </p>
          <p v-else-if="!blockingMessages.length">
            {{ t('configurator.panel.invalid_unspecified') }}
          </p>
          <!-- A message no name stands for is a whole sentence of its own, so
               these are listed rather than folded into the one above. -->
          <ul v-if="blockingMessages.length" class="list-inside list-disc">
            <li v-for="text in blockingMessages" :key="text">{{ text }}</li>
          </ul>
        </div>
      </div>
    </div>
  </template>
</template>
