<script setup lang="ts">
/**
 * Product Details Page (PDP)
 *
 * Matches: /{market}/{locale}/p/{...alias}
 * The last segment of the catch-all is the product alias.
 * Earlier segments are the category path (used for breadcrumbs/SEO).
 *
 * No resolve-route API call needed — the /p/ prefix tells us it's a product.
 */
const route = useRoute();

const productAlias = computed(() => {
  const segments = route.params.alias as string[];
  return decodeURIComponent(segments[segments.length - 1] ?? '');
});
</script>

<template>
  <ProductDetails :alias="productAlias" />
</template>
