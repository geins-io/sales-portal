<script setup lang="ts">
import type { ListProduct } from '#shared/types/commerce';

/** The related tab's body, shared by every product page's tab row. */
defineProps<{ products: ListProduct[] }>();
</script>

<template>
  <h3 class="font-heading mb-4 text-2xl font-bold">
    {{ $t('product.related') }}
  </h3>
  <RelatedProducts :products="products" :hide-heading="true" />
</template>
