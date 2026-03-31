<script setup lang="ts">
/**
 * Category Product List Page (PLP)
 *
 * Matches: /{market}/{locale}/c/{...category}
 * The last segment of the catch-all is the category alias.
 * Earlier segments are parent categories (used for breadcrumbs/SEO).
 *
 * No resolve-route API call needed — the /c/ prefix tells us it's a category.
 */
const route = useRoute();

const categoryAlias = computed(() => {
  const segments = route.params.category as string[];
  return decodeURIComponent(segments[segments.length - 1] ?? '');
});
</script>

<template>
  <ProductList :key="categoryAlias" :type="'category'" :alias="categoryAlias" />
</template>
