<script setup lang="ts">
withDefaults(
  defineProps<{
    viewMode?: 'grid' | 'list';
    count?: number;
  }>(),
  { viewMode: 'grid', count: 8 },
);
</script>

<template>
  <div data-testid="plp-skeleton">
    <!-- Grid variant -->
    <div
      v-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <div
        v-for="i in count"
        :key="i"
        data-testid="plp-skeleton-card"
        class="flex flex-col rounded-md border p-0"
      >
        <Skeleton class="aspect-square w-full rounded-t-md rounded-b-none" />
        <div class="flex flex-1 flex-col gap-2 p-4 pt-2">
          <!-- Art number + wishlist icon row -->
          <div class="flex items-center justify-between">
            <Skeleton class="h-3 w-1/3" />
            <Skeleton class="size-5 rounded-full" />
          </div>
          <!-- Title -->
          <Skeleton class="h-4 w-3/4" />
          <!-- Stock badge -->
          <Skeleton class="h-5 w-16 rounded-full" />
          <!-- Price -->
          <Skeleton class="mt-1 h-5 w-1/2" />
          <!-- Quantity + add-to-cart row -->
          <div class="mt-auto flex items-center gap-2 pt-2">
            <Skeleton class="h-9 w-20 rounded-md" />
            <Skeleton class="h-9 flex-1 rounded-md" />
          </div>
        </div>
      </div>
    </div>

    <!-- List variant -->
    <div v-else class="flex flex-col gap-0">
      <div
        v-for="i in count"
        :key="i"
        data-testid="plp-skeleton-row"
        class="flex gap-4 rounded-md border p-3"
      >
        <Skeleton class="h-32 w-32 shrink-0 rounded-md" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-3 w-1/4" />
          <Skeleton class="h-4 w-2/3" />
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
        <!-- Right column: price + quantity + add-to-cart -->
        <div class="flex shrink-0 items-center gap-3 pr-4">
          <Skeleton class="h-5 w-20" />
          <Skeleton class="h-9 w-20 rounded-md" />
          <Skeleton class="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>

    <!-- Pagination skeleton -->
    <div
      data-testid="plp-skeleton-pagination"
      class="mt-8 flex items-center justify-between"
    >
      <Skeleton class="h-4 w-32" />
      <div class="flex items-center gap-2">
        <Skeleton class="h-9 w-9 rounded-md" />
        <Skeleton class="h-9 w-9 rounded-md" />
        <Skeleton class="h-9 w-9 rounded-md" />
        <Skeleton class="h-9 w-9 rounded-md" />
        <Skeleton class="h-9 w-9 rounded-md" />
      </div>
    </div>
  </div>
</template>
