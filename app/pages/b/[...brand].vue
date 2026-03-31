<script setup lang="ts">
/**
 * Brand Product List Page (PLP)
 *
 * Matches: /{market}/{locale}/b/{...brand}
 * The last segment of the catch-all is the brand alias.
 *
 * No resolve-route API call needed — the /b/ prefix tells us it's a brand.
 */
const route = useRoute();

const brandAlias = computed(() => {
  const raw = route.params.brand;
  const segments = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '');
});
</script>

<template>
  <ProductList :type="'brand'" :alias="brandAlias" />
</template>
