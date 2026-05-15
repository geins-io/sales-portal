<script setup lang="ts">
import type { PurchasedProduct } from '#shared/types/commerce';

const { t } = useI18n();
const { localePath } = useLocaleMarket();

defineProps<{
  products: PurchasedProduct[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
}>();

const emit = defineEmits<{
  sort: [column: string];
}>();

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
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

function getOrderLink(product: PurchasedProduct): string {
  return localePath(`/portal/orders/${product.latestOrderId}`);
}

function getProductLink(product: PurchasedProduct): string | null {
  return product.alias ? localePath(`/p/${product.alias}`) : null;
}

function getDateWithOrderId(product: PurchasedProduct): string {
  const date = formatDate(product.latestOrderDate);
  if (!product.latestOrderId) return date;
  return `${date} (${product.latestOrderId})`;
}

function handleSortProduct() {
  emit('sort', 'name');
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
                :to="getOrderLink(product)"
                class="text-primary text-right text-sm"
                data-testid="order-link"
              >
                {{ getDateWithOrderId(product) }}
              </NuxtLink>
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
              class="cursor-pointer py-3 pr-4 font-medium select-none"
              data-testid="sort-product"
              @click="handleSortProduct"
            >
              {{ t('portal.purchased_products.columns.product') }}
              <span v-if="sortDirection === 'asc'" class="ml-1">&#9650;</span>
              <span v-else-if="sortDirection === 'desc'" class="ml-1"
                >&#9660;</span
              >
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.purchased_products.columns.article_number') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.purchased_products.columns.price_ex_vat') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.purchased_products.columns.total_ordered') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.purchased_products.columns.latest_order') }}
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
            class="border-border hover:bg-muted/50 border-b transition-colors"
          >
            <td class="py-3 pr-4">
              <ProductThumbnail
                :file-name="product.imageFileName"
                :alt="product.name"
                size="size-12"
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
                :to="getOrderLink(product)"
                class="text-primary hover:text-primary/80 text-sm font-medium"
                data-testid="order-link"
              >
                {{ getDateWithOrderId(product) }}
              </NuxtLink>
            </td>
            <td class="py-3">{{ product.latestBuyerName }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
