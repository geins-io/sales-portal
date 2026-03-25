<script setup lang="ts">
defineProps<{
  viewMode?: 'grid' | 'list';
}>();
</script>

<template>
  <div data-testid="search-skeleton">
    <!-- Grid only — header and toolbar are rendered separately in search.vue -->
    <div
      v-if="(viewMode ?? 'grid') === 'grid'"
      class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        data-testid="search-skeleton-card"
        class="flex flex-col rounded-md border p-0"
      >
        <Skeleton class="aspect-square w-full rounded-t-md rounded-b-none" />
        <div class="flex flex-1 flex-col gap-2 p-4 pt-2">
          <div class="flex items-center justify-between">
            <Skeleton class="h-3 w-1/3" />
            <Skeleton class="size-5 rounded-full" />
          </div>
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-5 w-16 rounded-full" />
          <Skeleton class="mt-1 h-5 w-1/2" />
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
        v-for="i in 8"
        :key="i"
        data-testid="search-skeleton-row"
        class="flex gap-4 rounded-md border p-3"
      >
        <Skeleton class="h-32 w-32 shrink-0 rounded-md" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-3 w-1/4" />
          <Skeleton class="h-4 w-2/3" />
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
        <div class="flex shrink-0 items-center gap-3 pr-4">
          <Skeleton class="h-5 w-20" />
          <Skeleton class="h-9 w-20 rounded-md" />
          <Skeleton class="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  </div>
</template>
