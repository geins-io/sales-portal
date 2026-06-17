<script setup lang="ts">
/**
 * Search landing page.
 *
 * With a `?q=` term it redirects to the canonical /s/{query} URL (kept for
 * backward compatibility with old bookmarks and external links). Without a
 * term it renders a focused search field so the page is a usable entry
 * point on its own. This is where the mobile header search icon lands.
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
  <div class="mx-auto max-w-2xl px-4 py-12 lg:px-6">
    <h1 class="mb-4 text-2xl font-bold">{{ $t('search.title') }}</h1>
    <SearchBar autofocus />
    <p class="text-muted-foreground mt-3 text-sm">
      {{ $t('search.enter_search_term') }}
    </p>
  </div>
</template>
