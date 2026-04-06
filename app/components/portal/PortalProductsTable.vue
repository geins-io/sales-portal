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

function handleSortProduct() {
  emit('sort', 'name');
}
</script>

<template>
  <div data-testid="portal-products-table">
    <!-- Empty state -->
    <div
      v-if="!products.length"
      data-testid="products-table-empty"
      class="text-muted-foreground py-8 text-center text-sm"
    >
      {{ t('portal.purchased_products.no_products') }}
    </div>

    <!-- Products table -->
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-border border-b text-left">
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
          class="border-border border-b"
        >
          <td class="py-3 pr-4">{{ product.name }}</td>
          <td class="py-3 pr-4">{{ product.articleNumber }}</td>
          <td class="py-3 pr-4">{{ getPrice(product) }}</td>
          <td class="py-3 pr-4">{{ product.totalQuantity }}</td>
          <td class="py-3 pr-4">
            <NuxtLink
              :to="getOrderLink(product)"
              class="text-primary hover:text-primary/80 text-sm font-medium"
              data-testid="order-link"
            >
              {{ formatDate(product.latestOrderDate) }}
            </NuxtLink>
          </td>
          <td class="py-3">{{ product.latestBuyerName }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
