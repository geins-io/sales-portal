<script setup lang="ts">
import type { QuoteLineItem } from '#shared/types/quote';
import { productPath } from '#shared/utils/route-helpers';

defineProps<{ items: QuoteLineItem[] }>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();

// Every amount is the side of the buyer's VAT choice.
function unitPriceOf(item: QuoteLineItem): string {
  return showIncVat.value
    ? item.unitPriceFormatted
    : item.unitPriceExVatFormatted;
}

function totalPriceOf(item: QuoteLineItem): string {
  return showIncVat.value
    ? item.totalPriceFormatted
    : item.totalPriceExVatFormatted;
}
</script>

<template>
  <div>
    <div data-testid="line-items-desktop" class="hidden md:block">
      <table data-testid="line-items-table" class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="p-3 text-left font-medium whitespace-nowrap">
              {{ t('portal.quotations.col_item') }}
            </th>
            <th class="p-3 text-left font-medium whitespace-nowrap">
              {{ t('portal.quotations.col_article') }}
            </th>
            <th class="p-3 text-right font-medium whitespace-nowrap">
              {{ t('portal.quotations.quantity') }}
            </th>
            <th class="p-3 text-right font-medium whitespace-nowrap">
              {{ t('portal.quotations.col_unit_price') }}
            </th>
            <th class="p-3 text-right font-medium whitespace-nowrap">
              {{ t('portal.quotations.line_total') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-border border-border divide-y border-b">
          <!-- By position: two configurations of one SKU are two lines. -->
          <tr
            v-for="(item, index) in items"
            :key="index"
            :class="{ 'align-top': item.configuration }"
            data-testid="line-item-row"
          >
            <td class="p-3">
              <div class="flex items-center gap-3">
                <ProductThumbnail
                  :file-name="item.imageFileName"
                  :url="item.imageUrl"
                  :alt="item.name"
                />
                <div>
                  <NuxtLink
                    v-if="item.alias"
                    :to="localePath(productPath(item.alias))"
                    data-testid="line-item-name-link"
                    class="font-medium hover:underline"
                  >
                    {{ item.name }}
                  </NuxtLink>
                  <span
                    v-else
                    data-testid="line-item-name"
                    class="font-medium"
                    >{{ item.name }}</span
                  >
                  <p
                    v-if="item.configuration"
                    data-testid="line-item-configured"
                    class="text-muted-foreground text-xs"
                  >
                    {{ t('cart.configured_product') }}
                  </p>
                </div>
              </div>
              <div v-if="item.configuration" class="mt-2 pl-13">
                <LineSpecification
                  :id="`quote-item-configuration-${index}`"
                  :product-name="item.name"
                  :quantity="item.quantity"
                  :configuration="item.configuration"
                  :unit-price="item.linePrices?.unit"
                  :total-price="item.linePrices?.total"
                />
              </div>
            </td>
            <td class="text-muted-foreground p-3 whitespace-nowrap">
              {{ item.articleNumber }}
            </td>
            <td
              data-testid="line-item-quantity"
              class="p-3 text-right whitespace-nowrap tabular-nums"
            >
              {{ item.quantity }}
            </td>
            <td
              data-testid="line-item-unit-price"
              class="p-3 text-right whitespace-nowrap tabular-nums"
            >
              {{ unitPriceOf(item) }}
            </td>
            <td
              data-testid="line-item-total-price"
              class="p-3 text-right font-medium whitespace-nowrap tabular-nums"
            >
              {{ totalPriceOf(item) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul
      data-testid="line-item-cards"
      class="divide-border border-border divide-y border-b md:hidden"
    >
      <li
        v-for="(item, index) in items"
        :key="index"
        data-testid="line-item-card"
        class="flex gap-3 py-4"
      >
        <ProductThumbnail
          :file-name="item.imageFileName"
          :url="item.imageUrl"
          :alt="item.name"
          size="size-14"
        />
        <div class="min-w-0 flex-1 space-y-2">
          <div>
            <NuxtLink
              v-if="item.alias"
              :to="localePath(productPath(item.alias))"
              data-testid="line-item-name-link"
              class="text-sm font-medium hover:underline"
            >
              {{ item.name }}
            </NuxtLink>
            <span
              v-else
              data-testid="line-item-name"
              class="text-sm font-medium"
              >{{ item.name }}</span
            >
            <p
              v-if="item.configuration"
              data-testid="line-item-configured"
              class="text-muted-foreground text-xs"
            >
              {{ t('cart.configured_product') }}
            </p>
            <p v-if="item.articleNumber" class="text-muted-foreground text-xs">
              {{ item.articleNumber }}
            </p>
            <div v-if="item.configuration" class="mt-2">
              <LineSpecification
                :id="`quote-item-configuration-m-${index}`"
                :product-name="item.name"
                :quantity="item.quantity"
                :configuration="item.configuration"
                :unit-price="item.linePrices?.unit"
                :total-price="item.linePrices?.total"
              />
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground text-sm tabular-nums">
              <span data-testid="line-item-card-quantity">{{
                item.quantity
              }}</span>
              ×
              <span data-testid="line-item-card-unit-price">{{
                unitPriceOf(item)
              }}</span>
            </span>
            <span
              data-testid="line-item-card-total-price"
              class="text-sm font-medium tabular-nums"
              >{{ totalPriceOf(item) }}</span
            >
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
