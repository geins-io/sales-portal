<script setup lang="ts">
/**
 * Legacy search page — redirects to /s/{query} (type-prefixed URL).
 *
 * Preserved for backward compatibility with bookmarks and external links
 * using the old /search?q=... format.
 */
const route = useRoute();
const { localePath } = useLocaleMarket();

const searchTerm = computed(() => {
  const q = route.query.q;
  return typeof q === 'string' ? q : '';
});

// Redirect to the new /s/{query} URL if there's a search term
if (searchTerm.value) {
  await navigateTo(localePath(`/s/${encodeURIComponent(searchTerm.value)}`), {
    redirectCode: 301,
  });
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <p class="text-muted-foreground">{{ $t('search.enter_search_term') }}</p>
  </div>
</template>
