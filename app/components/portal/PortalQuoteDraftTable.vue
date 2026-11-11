<script setup lang="ts">
/**
 * A request draft's lines, editable: the amount (typed or stepped) and remove.
 * A configured line shows its specification, and its choices are changed in
 * the product's configurator. A table from md up, with the summary rows in its
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
import { quoteLineHref } from '~/utils/configurator-quote';

const props = defineProps<{
  lines: QuoteLineItem[];
  totals: SummaryRow[];
  /** The draft's id; without it a configured line does not open. */
  quoteId?: string;
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
/** Item, article, amount, unit price, total, remove. */
const COLUMNS = 6;

const productLink = (line: QuoteLineItem) =>
  line.alias ? localePath(productPath(line.alias)) : undefined;
/**
 * A configured line's configurator, on the canonical path: the product page's
 * redirect to its canonical would drop the query, and with it the line.
 */
const configuratorLink = (line: QuoteLineItem) =>
  line.configuration && line.canonicalUrl && props.quoteId
    ? quoteLineHref(localePath(productPath(line.canonicalUrl)), {
        quoteId: props.quoteId,
        lineId: line.id,
      })
    : undefined;
/** A configured line's name opens it, as "Ändra konfiguration" does. */
const link = (line: QuoteLineItem) =>
  line.configuration ? configuratorLink(line) : productLink(line);
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
          <template v-for="line in lines" :key="line.id">
            <tr
              :class="{ 'border-b-0 align-top': line.configuration }"
              data-testid="quote-item-row"
            >
              <td class="px-4 py-2">
                <!-- On a configured line the image's height, as on an order
                     row, so its buttons sit right under the name. -->
                <div
                  class="flex items-center gap-3"
                  :class="{ 'min-h-20': !line.configuration }"
                >
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
              </td>
              <td class="text-muted-foreground px-4 py-2 whitespace-nowrap">
                {{ line.articleNumber }}
              </td>
              <td class="px-4 py-2 text-right">
                <div class="ml-auto w-28">
                  <PortalQuoteQuantityField
                    :model-value="line.quantity"
                    :label="quantityLabel(line)"
                    @update:model-value="onQuantity(line, $event)"
                  />
                </div>
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
              <td class="p-2">
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
            <!-- Under the image and name, as on an order row, but in a row of
               its own across every column: in the name cell the two buttons
               set the column's width and pushed the table past its card. -->
            <tr
              v-if="line.configuration"
              data-testid="quote-item-configuration-row"
            >
              <td :colspan="COLUMNS" class="px-4 pt-0 pb-2">
                <LineConfigurationActions
                  :id="`quote-line-spec-${line.id}`"
                  class="pl-13"
                  data-testid="quote-item-configuration-actions"
                  :product-name="line.name"
                  :quantity="line.quantity"
                  :configuration="line.configuration"
                  :unit-price="line.linePrices?.unit"
                  :total-price="line.linePrices?.total"
                  :edit-url="configuratorLink(line)"
                  edit-test-id="quote-item-edit-configuration"
                />
              </td>
            </tr>
          </template>
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
        class="flex flex-wrap gap-x-3 gap-y-2 py-4"
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
              <template v-if="line.configuration">
                <span v-if="line.articleNumber"> &bull; </span>
                <span data-testid="quote-item-configured">{{
                  t('cart.configured_product')
                }}</span>
              </template>
            </p>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="w-28">
              <PortalQuoteQuantityField
                :model-value="line.quantity"
                :label="quantityLabel(line)"
                @update:model-value="onQuantity(line, $event)"
              />
            </div>
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
        <!-- Under the whole card, as the cart puts it under the amount: the
             column beside the image is too narrow for the two side by side. -->
        <LineConfigurationActions
          v-if="line.configuration"
          :id="`quote-line-spec-m-${line.id}`"
          class="w-full"
          data-testid="quote-item-configuration-actions"
          :product-name="line.name"
          :quantity="line.quantity"
          :configuration="line.configuration"
          :unit-price="line.linePrices?.unit"
          :total-price="line.linePrices?.total"
          :edit-url="configuratorLink(line)"
          edit-test-id="quote-item-edit-configuration"
        />
      </li>
    </ul>
  </TooltipProvider>
</template>
