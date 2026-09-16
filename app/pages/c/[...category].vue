<script setup lang="ts">
/**
 * Category Product List Page (PLP)
 *
 * Matches: /{market}/{locale}/c/{...category}
 * The last segment of the catch-all is the category alias. Earlier segments are
 * parent categories and are deliberately NOT read: the route can be
 * non-canonical (this page only 301s server-side, so a client-side navigation
 * leaves a short /c/<alias> path in the bar). Breadcrumbs come from the page's
 * own canonicalUrl instead, resolved in /api/product-lists/category/[alias].
 *
 * No resolve-route API call needed — the /c/ prefix tells us it's a category.
 */
const route = useRoute();

const categoryAlias = computed(() => {
  const raw = route.params.category;
  const segments = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '');
});
</script>

<template>
  <ProductList :type="'category'" :alias="categoryAlias" />
</template>
