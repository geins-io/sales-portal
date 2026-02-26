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
  <div data-testid="plp-skeleton" class="space-y-6">
    <!-- Toolbar skeleton -->
    <div
      data-testid="plp-skeleton-toolbar"
      class="flex items-center justify-between gap-4"
    >
      <Skeleton class="h-9 w-24 rounded-md" />
      <div class="flex items-center gap-2">
        <Skeleton class="h-9 w-32 rounded-md" />
        <Skeleton class="h-9 w-9 rounded-md" />
        <Skeleton class="h-9 w-9 rounded-md" />
      </div>
    </div>

    <!-- Grid variant -->
    <div
      v-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <div
        v-for="i in count"
        :key="i"
        data-testid="plp-skeleton-card"
        class="flex flex-col gap-3 rounded-lg border p-0"
      >
        <Skeleton class="aspect-square w-full rounded-t-lg rounded-b-none" />
        <div class="flex flex-col gap-2 p-4 pt-0">
          <Skeleton class="h-3 w-1/3" />
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="mt-1 h-4 w-16" />
          <Skeleton class="mt-1 h-5 w-1/2" />
        </div>
      </div>
    </div>

    <!-- List variant -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="i in count"
        :key="i"
        data-testid="plp-skeleton-row"
        class="flex gap-4 rounded-lg border p-3"
      >
        <Skeleton class="h-20 w-20 shrink-0 rounded-md" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-3 w-1/4" />
          <Skeleton class="h-4 w-2/3" />
          <Skeleton class="h-4 w-16" />
          <Skeleton class="h-5 w-1/3" />
        </div>
      </div>
    </div>
  </div>
</template>
