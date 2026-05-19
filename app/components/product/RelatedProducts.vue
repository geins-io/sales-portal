<script setup lang="ts">
import type { ListProduct } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    products: ListProduct[];
    hideHeading?: boolean;
  }>(),
  { hideHeading: false },
);

const hasProducts = computed(() => props.products.length > 0);
</script>

<template>
  <section v-if="hasProducts" data-testid="related-products">
    <h2 v-if="!hideHeading" class="mb-4 text-lg font-semibold">
      {{ $t('product.related') }}
    </h2>
    <ul class="flex flex-col gap-3">
      <li v-for="product in products" :key="product.productId">
        <ProductCard :product="product" variant="list" />
      </li>
    </ul>
  </section>
</template>
