<script setup lang="ts">
withDefaults(defineProps<{ navVariant?: 'grey' | 'white' }>(), {
  navVariant: 'grey',
});

const router = useRouter();
const { localePath } = useLocaleMarket();

function onSearch(query: string) {
  router.push(localePath(`/s/${encodeURIComponent(query)}`));
}
</script>

<template>
  <!--
    Mobile (base) always gets a border-b: the desktop nav row that normally
    separates this main row from page content is hidden below lg, so without
    this the header would bleed into the page. On desktop the separator is
    variant-driven: white pairs two same-coloured sections so it keeps the
    border; grey flows seamlessly into the grey nav, so the border is dropped.
  -->
  <div
    class="bg-background"
    :class="navVariant === 'white' ? 'border-b' : 'border-b lg:border-b-0'"
  >
    <div
      class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:h-20 lg:px-6"
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
