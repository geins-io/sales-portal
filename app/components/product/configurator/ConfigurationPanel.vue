<script setup lang="ts">
import {
  ClipboardCheck,
  Copy,
  FileText,
  PanelRightOpen,
  Play,
  RotateCcw,
} from 'lucide-vue-next';
import { useClipboard } from '@vueuse/core';
import type { Configuration } from '#shared/types/configurator';
import { currencyCode, vatRatePercent } from '#shared/utils/configurator-price';
import type { ConfiguratorSessionStatus } from '~/composables/useConfiguratorSession';
import { Button } from '~/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import {
  panelTotals,
  specificationRows,
  specificationText,
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
const { showPrice } = usePriceVisibility();

const rows = computed(() =>
  configuration ? specificationRows(configuration) : [],
);

const currency = computed(() => currencyCode(configuration?.unitPrice));
const { money, valueText, priceText } = useSpecificationFormat(currency);

/**
 * Net leads and VAT and the total support it, as the prototype. Every figure is
 * for the whole quantity, from the unit price as sent, already net of any
 * discount; none is derived from another.
 */
const totals = computed(() => panelTotals(configuration));

const price = computed(() => money(totals.value?.net ?? 0));

const vatLabel = computed(() => {
  const rate = vatRatePercent(configuration?.unitPrice);
  return rate === null
    ? t('configurator.panel.vat_no_rate')
    : t('configurator.panel.vat', { rate });
});

const supportingRows = computed(() => [
  { label: vatLabel.value, amount: money(totals.value?.vat ?? 0) },
  {
    label: t('configurator.panel.inc_vat'),
    amount: money(totals.value?.incVat ?? 0),
  },
]);

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

const quantity = computed(() => configuration?.quantity ?? 1);
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
    <p class="text-sm">
      {{
        t(editing ? 'configurator.edit.expired' : 'configurator.panel.expired')
      }}
    </p>
    <Button variant="outline" size="sm" @click="emit('restart')">
      <template v-if="editing">
        <RotateCcw class="size-4" />
        {{ t('configurator.edit.start_over') }}
      </template>
      <template v-else>
        <Play class="size-4" />
        {{ t('configurator.panel.resume') }}
      </template>
    </Button>
  </div>

  <template v-else>
    <template v-if="configuration">
      <div
        v-if="showPrice"
        class="shrink-0 px-4 py-3"
        data-testid="configurator-panel-price"
      >
        <SpecificationPrice
          prefix="configurator-panel"
          size="summary"
          :quantity="quantity"
          :net="price"
          :rows="supportingRows"
          :dimmed="busy"
        />
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
          v-if="rows.length"
          class="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          data-testid="configurator-panel-rows"
        >
          <SpecificationRows :rows="rows" :large="false" :currency="currency" />
        </div>

        <div
          v-if="showPrice"
          class="border-border shrink-0 border-t px-4 py-3"
          data-testid="configurator-spec-price"
        >
          <SpecificationPrice
            prefix="configurator-spec"
            size="foot"
            :quantity="quantity"
            :net="price"
            :rows="supportingRows"
            :dimmed="busy"
          />
        </div>
      </template>
    </section>

    <!-- The whole specification larger, from the right at the sign-in
         sheet's width. -->
    <SpecificationSheet
      v-if="configuration"
      v-model:open="sheetOpen"
      :product-name="productName"
      test-id="configurator-spec-sheet"
    >
      <SpecificationRows :rows="rows" :large="true" :currency="currency" />
      <template v-if="showPrice" #footer>
        <SpecificationPrice
          prefix="configurator-sheet"
          size="sheet"
          :quantity="quantity"
          :net="price"
          :rows="supportingRows"
        />
      </template>
    </SpecificationSheet>
  </template>
</template>
