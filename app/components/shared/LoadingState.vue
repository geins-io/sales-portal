<script setup lang="ts">
withDefaults(
  defineProps<{
    variant: 'card-grid' | 'card-list' | 'detail' | 'text';
    count?: number;
  }>(),
  { count: 6 },
);
</script>

<template>
  <!-- Card Grid -->
  <div
    v-if="variant === 'card-grid'"
    class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
  >
    <div
      v-for="i in count"
      :key="i"
      data-testid="skeleton-card"
      class="flex flex-col gap-3 rounded-lg border p-0"
    >
      <Skeleton class="aspect-square w-full rounded-t-lg rounded-b-none" />
      <div class="flex flex-col gap-2 p-4 pt-0">
        <Skeleton class="h-3 w-1/3" />
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="mt-2 h-5 w-1/2" />
      </div>
    </div>
  </div>

  <!-- Card List -->
  <div v-else-if="variant === 'card-list'" class="flex flex-col gap-3">
    <div
      v-for="i in count"
      :key="i"
      data-testid="skeleton-row"
      class="flex gap-4 rounded-lg border p-3"
    >
      <Skeleton class="h-20 w-20 shrink-0 rounded-md" />
      <div class="flex flex-1 flex-col gap-2">
        <Skeleton class="h-3 w-1/4" />
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-5 w-1/3" />
      </div>
    </div>
  </div>

  <!-- Detail (PDP-style) -->
  <div
    v-else-if="variant === 'detail'"
    data-testid="skeleton-detail"
    class="grid gap-8 md:grid-cols-2"
  >
    <Skeleton class="aspect-square w-full rounded-lg" />
    <div class="flex flex-col gap-4">
      <Skeleton class="h-4 w-1/3" />
      <Skeleton class="h-8 w-3/4" />
      <Skeleton class="h-6 w-1/4" />
      <Skeleton class="mt-4 h-4 w-full" />
      <Skeleton class="h-4 w-5/6" />
      <Skeleton class="h-4 w-2/3" />
      <Skeleton class="mt-6 h-12 w-1/2 rounded-md" />
    </div>
  </div>

  <!-- Text -->
  <div
    v-else-if="variant === 'text'"
    data-testid="skeleton-text"
    class="flex flex-col gap-3"
  >
    <Skeleton class="h-6 w-1/3" />
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-5/6" />
    <Skeleton class="h-4 w-2/3" />
  </div>
</template>
