<template>
  <div
    data-testid="pdp-skeleton"
    class="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8"
  >
    <!-- Breadcrumb skeleton -->
    <div class="flex items-center gap-2">
      <Skeleton class="h-4 w-12" />
      <Skeleton class="h-4 w-4" />
      <Skeleton class="h-4 w-20" />
      <Skeleton class="h-4 w-4" />
      <Skeleton class="h-4 w-32" />
    </div>

    <!-- Main content: two columns -->
    <div class="grid gap-8 md:grid-cols-2">
      <!-- Left: Gallery -->
      <div data-testid="pdp-skeleton-gallery" class="space-y-3">
        <Skeleton class="aspect-square w-full rounded-lg" />
        <div class="flex gap-2">
          <Skeleton
            v-for="i in 4"
            :key="i"
            data-testid="pdp-skeleton-thumbnail"
            class="size-16 shrink-0 rounded-md"
          />
        </div>
      </div>

      <!-- Right: Product info -->
      <div data-testid="pdp-skeleton-info" class="flex flex-col gap-4">
        <!-- Title + add to cart row -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <Skeleton class="h-7 w-3/4" />
            <Skeleton class="h-3 w-24" />
          </div>
          <Skeleton class="h-10 w-32 shrink-0 rounded-md" />
        </div>

        <!-- Price -->
        <Skeleton class="h-6 w-28" />

        <!-- Brand -->
        <Skeleton class="h-3 w-20" />

        <!-- Short description -->
        <div class="space-y-2">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-5/6" />
          <Skeleton class="h-4 w-2/3" />
        </div>

        <!-- Stock badge -->
        <Skeleton class="h-6 w-20 rounded-full" />

        <!-- Variant selector -->
        <div class="space-y-2">
          <Skeleton class="h-4 w-16" />
          <div class="flex gap-2">
            <Skeleton class="h-10 w-20 rounded-md" />
            <Skeleton class="h-10 w-20 rounded-md" />
            <Skeleton class="h-10 w-20 rounded-md" />
          </div>
        </div>

        <!-- Quantity -->
        <Skeleton class="h-10 w-32 rounded-md" />

        <!-- Links -->
        <div class="flex flex-col gap-2 pt-2">
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-4 w-44" />
        </div>
      </div>
    </div>

    <!-- Tabs skeleton -->
    <div data-testid="pdp-skeleton-tabs" class="space-y-4">
      <div class="flex gap-4 border-b pb-2">
        <Skeleton class="h-8 w-24" />
        <Skeleton class="h-8 w-28" />
        <Skeleton class="h-8 w-20" />
      </div>
      <div class="space-y-2">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-5/6" />
        <Skeleton class="h-4 w-2/3" />
      </div>
    </div>
  </div>
</template>
