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
  const raw = route.params.alias;
  const segments = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '');
});
</script>

<template>
  <ProductDetails :alias="productAlias" />
</template>
