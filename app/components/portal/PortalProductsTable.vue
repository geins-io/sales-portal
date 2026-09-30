<script setup lang="ts">
import type {
  PurchasedProduct,
  PurchasedProductSortColumn,
} from '#shared/types/commerce';
import { productPath } from '#shared/utils/route-helpers';

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const { localePath } = useLocaleMarket();

const props = defineProps<{
  products: PurchasedProduct[];
  sortColumn: PurchasedProductSortColumn;
  sortDirection: 'asc' | 'desc';
}>();

const emit = defineEmits<{
  sort: [column: PurchasedProductSortColumn];
}>();

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(formatLocale.value, {
      ...(timezone.value ? { timeZone: timezone.value } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getPrice(product: PurchasedProduct): string {
  return product.priceExVatFormatted ?? String(product.priceExVat ?? '-');
}

function getOrderLink(product: PurchasedProduct): string | null {
  const identifier = product.latestOrderPublicId ?? product.latestOrderId;
  if (!identifier) return null;
  return localePath(`/portal/orders/${identifier}`);
}

function getProductLink(product: PurchasedProduct): string | null {
  return product.alias ? localePath(productPath(product.alias)) : null;
}

function getDateWithOrderId(product: PurchasedProduct): string {
  const date = formatDate(product.latestOrderDate);
  if (!product.latestOrderId) return date;
  return `${date} (${product.latestOrderId})`;
}

function ariaSort(column: PurchasedProductSortColumn) {
  if (props.sortColumn !== column) return 'none';
  return props.sortDirection === 'asc' ? 'ascending' : 'descending';
}
</script>

<template>
  <div data-testid="portal-products-table" class="overflow-x-auto">
    <!-- Empty state -->
    <div
      v-if="!products.length"
      data-testid="products-table-empty"
      class="text-muted-foreground py-8 text-center text-sm"
    >
      {{ t('portal.purchased_products.no_products') }}
    </div>

    <template v-else>
      <!-- Mobile card view -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="product in products"
          :key="product.articleNumber"
          data-testid="product-row"
          :data-article-number="product.articleNumber"
          class="border-border flex gap-3 rounded-lg border p-4"
        >
          <ProductThumbnail
            :file-name="product.imageFileName"
            :alt="product.name"
            size="size-16"
          />
          <div class="min-w-0 flex-1">
            <NuxtLink
              v-if="getProductLink(product)"
              :to="getProductLink(product)!"
              data-testid="product-name-link"
              class="hover:text-primary mb-1 block font-medium"
            >
              {{ product.name }}
            </NuxtLink>
            <div v-else class="mb-1 font-medium">{{ product.name }}</div>
            <div class="text-muted-foreground mb-2 text-xs">
              {{ product.articleNumber }}
            </div>
            <div class="text-muted-foreground grid grid-cols-2 gap-1 text-sm">
              <span>{{
                t('portal.purchased_products.columns.price_ex_vat')
              }}</span>
              <span class="text-foreground text-right">{{
                getPrice(product)
              }}</span>
              <span>{{
                t('portal.purchased_products.columns.total_ordered')
              }}</span>
              <span class="text-foreground text-right">{{
                product.totalQuantity
              }}</span>
              <span>{{
                t('portal.purchased_products.columns.latest_order')
              }}</span>
              <NuxtLink
                v-if="getOrderLink(product)"
                :to="getOrderLink(product)!"
                class="text-primary text-right text-sm"
                data-testid="order-link"
              >
                {{ getDateWithOrderId(product) }}
              </NuxtLink>
              <span v-else class="text-right text-sm">{{
                getDateWithOrderId(product)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop table -->
      <table class="hidden w-full text-sm md:table">
        <thead>
          <tr class="border-border border-b text-left">
            <th class="py-3 pr-4 font-medium" />
            <th
              class="py-3 pr-4 font-medium"
              data-testid="sort-product"
              :aria-sort="ariaSort('name')"
            >
              <button
                type="button"
                class="focus-visible:ring-ring inline-flex cursor-pointer items-center rounded-sm font-medium select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                @click="emit('sort', 'name')"
              >
                {{ t('portal.purchased_products.columns.product') }}
                <span v-if="sortColumn === 'name'" class="ml-1">{{
                  sortDirection === 'asc' ? '▲' : '▼'
                }}</span>
              </button>
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.purchased_products.columns.article_number') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.purchased_products.columns.price_ex_vat') }}
            </th>
            <th
              class="py-3 pr-4 font-medium"
              data-testid="sort-total-ordered"
              :aria-sort="ariaSort('totalQuantity')"
            >
              <button
                type="button"
                class="focus-visible:ring-ring inline-flex cursor-pointer items-center rounded-sm font-medium select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                @click="emit('sort', 'totalQuantity')"
              >
                {{ t('portal.purchased_products.columns.total_ordered') }}
                <span v-if="sortColumn === 'totalQuantity'" class="ml-1">{{
                  sortDirection === 'asc' ? '▲' : '▼'
                }}</span>
              </button>
            </th>
            <th
              class="py-3 pr-4 font-medium"
              data-testid="sort-latest-order"
              :aria-sort="ariaSort('latestOrderDate')"
            >
              <button
                type="button"
                class="focus-visible:ring-ring inline-flex cursor-pointer items-center rounded-sm font-medium select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                @click="emit('sort', 'latestOrderDate')"
              >
                {{ t('portal.purchased_products.columns.latest_order') }}
                <span v-if="sortColumn === 'latestOrderDate'" class="ml-1">{{
                  sortDirection === 'asc' ? '▲' : '▼'
                }}</span>
              </button>
            </th>
            <th class="py-3 font-medium">
              {{ t('portal.purchased_products.columns.latest_buyer') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in products"
            :key="product.articleNumber"
            data-testid="product-row"
            :data-article-number="product.articleNumber"
            class="border-border hover:bg-muted/50 border-b transition-colors"
          >
            <td class="py-3 pr-4">
              <ProductThumbnail
                :file-name="product.imageFileName"
                :alt="product.name"
                size="size-10"
              />
            </td>
            <td class="py-3 pr-4">
              <NuxtLink
                v-if="getProductLink(product)"
                :to="getProductLink(product)!"
                data-testid="product-name-link"
                class="hover:text-primary font-medium"
              >
                {{ product.name }}
              </NuxtLink>
              <span v-else>{{ product.name }}</span>
            </td>
            <td class="py-3 pr-4">{{ product.articleNumber }}</td>
            <td class="py-3 pr-4">{{ getPrice(product) }}</td>
            <td class="py-3 pr-4">{{ product.totalQuantity }}</td>
            <td class="py-3 pr-4">
              <NuxtLink
                v-if="getOrderLink(product)"
                :to="getOrderLink(product)!"
                class="text-primary hover:text-primary/80 text-sm font-medium"
                data-testid="order-link"
              >
                {{ getDateWithOrderId(product) }}
              </NuxtLink>
              <span v-else class="text-sm">{{
                getDateWithOrderId(product)
              }}</span>
            </td>
            <td class="py-3">{{ product.latestBuyerName }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
