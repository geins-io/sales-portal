<script setup lang="ts">
import {
  ClipboardCheck,
  Copy,
  FileText,
  PanelRightOpen,
  RotateCcw,
} from 'lucide-vue-next';
import { createReusableTemplate, useClipboard } from '@vueuse/core';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
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
 * The price leads and the specification follows, scrolling inside its own
 * block, as the prototype; the default slot is where the page puts the action
 * and the session, between the two. The page owns them because the action is
 * replaced wholesale in a later milestone.
 *
 * Flat props rather than the session composable's return object: the panel must
 * mount without a session for its tests, and a spread object hides which fields
 * it reads.
 */
const {
  configuration,
  status,
  busy,
  productName,
  articleNumber,
  editing = false,
} = defineProps<{
  configuration: Configuration | null;
  status: ConfiguratorSessionStatus;
  busy: boolean;
  productName: string;
  articleNumber: string;
  /** A cart line is being edited, which an expired session leaves unchanged. */
  editing?: boolean;
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

const copyLabel = computed(() =>
  copied.value ? t('configurator.panel.copied') : t('configurator.panel.copy'),
);

const sheetOpen = ref(false);

/**
 * The rows and the price, each written once and used at two sizes: the column
 * and the expanded sheet, as the prototype's two copies of the same markup.
 */
const [DefineRows, ReuseRows] = createReusableTemplate<{ large: boolean }>();
const [DefinePrice, ReusePrice] = createReusableTemplate<{
  prefix: string;
  size: 'summary' | 'foot' | 'sheet';
}>();

const netClass = {
  summary: 'text-xl',
  foot: 'text-base',
  sheet: 'text-xl',
} as const;
</script>

<template>
  <DefineRows v-slot="{ large }">
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
  </DefineRows>

  <DefinePrice v-slot="{ prefix, size }">
    <div
      class="flex items-baseline justify-between gap-3"
      :data-testid="`${prefix}-price-row`"
    >
      <span class="text-muted-foreground text-xs">
        {{ t('configurator.panel.net_price') }}
        <template v-if="configuration && configuration.quantity > 1">
          ·
          {{
            t('configurator.panel.quantity_suffix', {
              count: configuration.quantity,
            })
          }}
        </template>
      </span>
      <span
        class="font-semibold tabular-nums transition-opacity"
        :class="[netClass[size], busy && size !== 'sheet' ? 'opacity-40' : '']"
        :data-testid="`${prefix}-net`"
      >
        {{ price }}
      </span>
    </div>
    <div
      v-for="(row, index) in supportingRows"
      :key="index"
      class="text-muted-foreground flex justify-between gap-3"
      :class="[
        size === 'sheet' ? 'text-xs' : 'text-[11px]',
        index === 0 ? 'mt-1' : '',
      ]"
      :data-testid="`${prefix}-price-row`"
    >
      <span>{{ row.label }}</span>
      <span class="tabular-nums">{{ row.amount }}</span>
    </div>
  </DefinePrice>

  <!--
    An expired session is a state, not a failure: it says so and offers the way
    back, with no specification and no price left to report.
  -->
  <div
    v-if="status === 'expired'"
    class="bg-muted flex flex-wrap items-center justify-between gap-3 px-4 py-3"
    data-testid="configurator-panel-expired"
  >
    <p class="text-sm">
      {{
        t(editing ? 'configurator.edit.expired' : 'configurator.panel.expired')
      }}
    </p>
    <Button variant="outline" size="sm" @click="emit('restart')">
      <RotateCcw class="size-4" />
      {{ t('configurator.panel.start_over') }}
    </Button>
  </div>

  <template v-else>
    <template v-if="configuration">
      <div
        v-if="showPrice"
        class="shrink-0 px-4 py-3"
        data-testid="configurator-panel-price"
      >
        <ReusePrice prefix="configurator-panel" size="summary" />
      </div>
    </template>

    <!-- While the session starts, the space the price, the action and the
         session will take (each block carries the divider under it), so the
         specification header is already where it will stay. -->
    <div
      v-if="!configuration"
      :class="showPrice ? 'h-[212px]' : 'h-[122px]'"
      class="shrink-0"
      data-testid="configurator-card-top-empty"
    />

    <slot />

    <!-- The specification takes the height left in the box and scrolls inside
         it, so the price and the action above never leave the screen. -->
    <section
      class="flex min-h-0 flex-col lg:flex-1"
      data-testid="configurator-panel-spec"
    >
      <!-- The header stands before the document does, so the card is in place
           while the session starts; everything under it waits for the
           document. -->
      <header
        class="border-border shrink-0 border-b px-4 py-3"
        data-testid="configurator-panel-header"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="flex items-center gap-2 text-sm font-semibold">
            <FileText class="size-4" />
            {{ t('configurator.panel.title') }}
          </h3>
          <TooltipProvider v-if="configuration" :delay-duration="150">
            <div class="flex shrink-0 items-center gap-3">
              <Tooltip v-if="canCopy">
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    :aria-label="copyLabel"
                    data-testid="configurator-panel-copy"
                    @click="copy()"
                  >
                    <ClipboardCheck v-if="copied" class="text-success size-4" />
                    <Copy v-else class="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{{ copyLabel }}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    :aria-label="t('configurator.panel.expand')"
                    data-testid="configurator-panel-expand"
                    @click="sheetOpen = true"
                  >
                    <PanelRightOpen class="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ t('configurator.panel.expand') }}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </header>

      <!-- Under the header an empty body as tall as the loaded rows and price
           (Bookcase, 1440 wide: 265 and 85), so nothing moves when the
           document arrives. From lg it is held inside the box's cap: 192
           offset, 16 air, the card's borders, the top space, the header. -->
      <div
        v-if="!configuration"
        :class="
          showPrice
            ? 'min-h-[350px] lg:min-h-[min(350px,calc(100vh-467px))]'
            : 'min-h-[265px] lg:min-h-[min(265px,calc(100vh-377px))]'
        "
        data-testid="configurator-card-empty"
      />

      <template v-else>
        <!-- The value is the content and the price is an annotation, so the
             value leads and a price appears only where there is one. -->
        <div
          v-if="grouped.length"
          class="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          data-testid="configurator-panel-rows"
        >
          <ReuseRows :large="false" />
        </div>

        <div
          v-if="showPrice"
          class="border-border shrink-0 border-t px-4 py-3"
          data-testid="configurator-spec-price"
        >
          <ReusePrice prefix="configurator-spec" size="foot" />
        </div>
      </template>
    </section>

    <!-- The whole specification larger, from the right at the sign-in
         sheet's width. -->
    <Sheet v-if="configuration" v-model:open="sheetOpen">
      <SheetContent
        side="right"
        class="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        data-testid="configurator-spec-sheet"
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle class="text-2xl font-semibold tracking-tight">
            {{ t('configurator.panel.title') }}
          </SheetTitle>
          <SheetDescription>{{ productName }}</SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto">
          <ReuseRows :large="true" />
        </div>

        <div v-if="showPrice" class="border-border border-t px-6 py-4">
          <ReusePrice prefix="configurator-sheet" size="sheet" />
        </div>
      </SheetContent>
    </Sheet>
  </template>
</template>
