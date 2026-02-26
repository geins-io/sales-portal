<script setup lang="ts">
defineProps<{
  viewMode?: 'grid' | 'list';
}>();
</script>

<template>
  <div data-testid="search-skeleton" class="space-y-6">
    <!-- Search header skeleton -->
    <div data-testid="search-skeleton-header" class="space-y-2">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-4 w-24" />
    </div>

    <!-- Reuse ProductListSkeleton for the results grid -->
    <ProductListSkeleton :view-mode="viewMode ?? 'grid'" />
  </div>
</template>
