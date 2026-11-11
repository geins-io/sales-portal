<script setup lang="ts">
/**
 * A request draft's lines, editable: the amount (typed or stepped) and remove.
 * A configured line shows its specification and keeps its amount, which is
 * set in the configurator. A table from md up, with the summary rows in its
 * footer; below md one card per line. Every line can be removed: what removing
 * the last one means is the page's to say.
 */
import { Trash2 } from 'lucide-vue-next';
import type { SummaryRow } from '#shared/types/portal-rows';
import type { QuoteLineItem } from '#shared/types/quote';
import { QUOTE_LINE_MAX_QUANTITY } from '#shared/constants/quote';
import { productPath } from '#shared/utils/route-helpers';
import { Button } from '~/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { footerOf, footerRowAttrs } from '~/utils/summary-footer';

defineProps<{
  lines: QuoteLineItem[];
  totals: SummaryRow[];
}>();

const emit = defineEmits<{
  quantity: [line: QuoteLineItem, quantity: number];
  remove: [line: QuoteLineItem];
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();

const unitPrice = (line: QuoteLineItem) =>
  showIncVat.value ? line.unitPriceFormatted : line.unitPriceExVatFormatted;
const totalPrice = (line: QuoteLineItem) =>
  showIncVat.value ? line.totalPriceFormatted : line.totalPriceExVatFormatted;
const link = (line: QuoteLineItem) =>
  line.alias ? localePath(productPath(line.alias)) : undefined;
const removeLabel = (line: QuoteLineItem) =>
  `${t('portal.quotations.draft.remove')}: ${line.name}`;
const quantityLabel = (line: QuoteLineItem) =>
  `${t('portal.quotations.quantity')}, ${line.name}`;

function onQuantity(line: QuoteLineItem, value: number) {
  if (!Number.isFinite(value)) return;
  const quantity = Math.min(
    Math.max(Math.round(value), 1),
    QUOTE_LINE_MAX_QUANTITY,
  );
  if (quantity !== line.quantity) emit('quantity', line, quantity);
}
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <!-- md and up -->
    <div class="border-border hidden rounded-lg border md:block">
      <table data-testid="quote-items-table" class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-4 py-3 text-left font-medium">
              {{ t('portal.quotations.col_item') }}
            </th>
            <th class="px-4 py-3 text-left font-medium">
              {{ t('portal.quotations.col_article') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.quotations.quantity') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.quotations.col_unit_price') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.quotations.line_total') }}
            </th>
            <th class="w-px px-2 py-3">
              <span class="sr-only">{{
                t('portal.quotations.draft.remove')
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-border divide-y">
          <tr
            v-for="line in lines"
            :key="line.id"
            :class="{ 'align-top': line.configuration }"
            data-testid="quote-item-row"
          >
            <td class="px-4 py-2">
              <div class="flex min-h-20 items-center gap-3">
                <ProductThumbnail
                  :file-name="line.imageFileName ?? null"
                  :url="line.imageUrl ?? null"
                  :alt="line.name"
                />
                <div>
                  <NuxtLink
                    v-if="link(line)"
                    :to="link(line)"
                    data-testid="quote-item-name"
                    class="font-medium hover:underline"
                  >
                    {{ line.name }}
                  </NuxtLink>
                  <span
                    v-else
                    data-testid="quote-item-name"
                    class="font-medium"
                    >{{ line.name }}</span
                  >
                  <p
                    v-if="line.configuration"
                    class="text-muted-foreground text-xs"
                  >
                    {{ t('cart.configured_product') }}
                  </p>
                </div>
              </div>
              <div v-if="line.configuration" class="mt-2 pl-13">
                <LineSpecification
                  :id="`quote-line-spec-${line.id}`"
                  :product-name="line.name"
                  :quantity="line.quantity"
                  :configuration="line.configuration"
                  :unit-price="line.linePrices?.unit"
                  :total-price="line.linePrices?.total"
                />
              </div>
            </td>
            <td class="text-muted-foreground px-4 py-2 whitespace-nowrap">
              {{ line.articleNumber }}
            </td>
            <td class="px-4 py-2 text-right">
              <div v-if="!line.configuration" class="ml-auto w-28">
                <PortalQuoteQuantityField
                  :model-value="line.quantity"
                  :label="quantityLabel(line)"
                  @update:model-value="onQuantity(line, $event)"
                />
              </div>
              <span
                v-else
                data-testid="quote-item-quantity-locked"
                class="tabular-nums"
                :title="t('portal.quotations.draft.configured_quantity')"
                >{{ line.quantity }}</span
              >
            </td>
            <td class="px-4 py-2 text-right whitespace-nowrap tabular-nums">
              {{ unitPrice(line) }}
            </td>
            <td
              data-testid="quote-item-total"
              class="px-4 py-2 text-right font-medium whitespace-nowrap tabular-nums"
            >
              {{ totalPrice(line) }}
            </td>
            <td class="px-2 py-2">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-muted-foreground hover:text-destructive"
                    data-testid="quote-item-remove"
                    :aria-label="removeLabel(line)"
                    @click="emit('remove', line)"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{
                  t('portal.quotations.draft.remove')
                }}</TooltipContent>
              </Tooltip>
            </td>
          </tr>
        </tbody>
        <tfoot data-testid="quote-items-footer" class="border-border border-t">
          <tr
            v-for="row in totals"
            :key="row.key"
            v-bind="footerRowAttrs(row.key)"
          >
            <td colspan="4" :class="footerOf(row.key).label">
              {{ row.label }}
            </td>
            <td
              :data-testid="
                footerOf(row.key).testId
                  ? `quote-items-footer-${row.key}`
                  : undefined
              "
              :class="footerOf(row.key).value"
            >
              {{ row.value }}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Below md -->
    <ul
      data-testid="quote-items-cards"
      class="divide-border border-border divide-y border-y md:hidden"
    >
      <li
        v-for="line in lines"
        :key="line.id"
        data-testid="quote-item-card"
        class="flex gap-3 py-4"
      >
        <ProductThumbnail
          :file-name="line.imageFileName ?? null"
          :url="line.imageUrl ?? null"
          :alt="line.name"
          size="size-14"
        />
        <div class="min-w-0 flex-1 space-y-2">
          <div>
            <NuxtLink
              v-if="link(line)"
              :to="link(line)"
              class="text-sm font-medium hover:underline"
            >
              {{ line.name }}
            </NuxtLink>
            <span v-else class="text-sm font-medium">{{ line.name }}</span>
            <p class="text-muted-foreground text-xs">
              {{ line.articleNumber }}
            </p>
            <div v-if="line.configuration" class="mt-1.5">
              <LineSpecification
                :id="`quote-line-spec-m-${line.id}`"
                :product-name="line.name"
                :quantity="line.quantity"
                :configuration="line.configuration"
                :unit-price="line.linePrices?.unit"
                :total-price="line.linePrices?.total"
              />
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div v-if="!line.configuration" class="w-28">
              <PortalQuoteQuantityField
                :model-value="line.quantity"
                :label="quantityLabel(line)"
                @update:model-value="onQuantity(line, $event)"
              />
            </div>
            <span
              v-else
              class="text-muted-foreground text-sm tabular-nums"
              :title="t('portal.quotations.draft.configured_quantity')"
            >
              {{ line.quantity }} × {{ unitPrice(line) }}
            </span>
            <span class="text-sm font-medium tabular-nums">{{
              totalPrice(line)
            }}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-destructive"
            data-testid="quote-item-remove-mobile"
            :aria-label="removeLabel(line)"
            @click="emit('remove', line)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </li>
    </ul>
  </TooltipProvider>
</template>
