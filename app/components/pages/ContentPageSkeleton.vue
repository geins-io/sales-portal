<script setup lang="ts">
withDefaults(
  defineProps<{
    sidebar?: boolean;
  }>(),
  { sidebar: false },
);
</script>

<template>
  <div data-testid="content-skeleton" class="min-h-[50vh]">
    <!-- Sidebar variant -->
    <div v-if="sidebar" class="md:flex md:gap-8">
      <!-- Sidebar skeleton -->
      <div
        data-testid="content-skeleton-sidebar"
        class="mb-6 space-y-2 md:mb-0 md:w-64 md:shrink-0"
      >
        <Skeleton class="h-5 w-3/4" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-5/6" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-4 w-full" />
      </div>

      <!-- Content body -->
      <div data-testid="content-skeleton-body" class="min-w-0 flex-1 space-y-4">
        <Skeleton class="h-8 w-1/3" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-5/6" />
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="mt-6 h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-3/4" />
      </div>
    </div>

    <!-- Full-width variant -->
    <div v-else data-testid="content-skeleton-body" class="space-y-4">
      <Skeleton class="h-8 w-1/3" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-5/6" />
      <Skeleton class="h-4 w-2/3" />
      <Skeleton class="mt-6 h-4 w-full" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-3/4" />
    </div>
  </div>
</template>
