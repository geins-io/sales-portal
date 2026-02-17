<script setup lang="ts">
const router = useRouter();

function onSearch(query: string) {
  router.push({ path: '/search', query: { q: query } });
}
</script>

<template>
  <div class="bg-background border-b">
    <div
      class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8"
    >
      <!-- Logo -->
      <BrandLogo class="shrink-0" />

      <!-- Search (desktop only) -->
      <div class="hidden flex-1 justify-center lg:flex">
        <SearchBar class="w-full max-w-lg" @search="onSearch" />
      </div>

      <!-- Action buttons -->
      <LayoutHeaderActionButtons />
    </div>
  </div>
</template>
