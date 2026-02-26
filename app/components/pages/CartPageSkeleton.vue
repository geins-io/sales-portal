<template>
  <div data-testid="cart-skeleton">
    <!-- Two-column layout: items + summary -->
    <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
      <!-- LEFT: Cart items -->
      <div class="min-w-0 flex-1">
        <div class="divide-border divide-y">
          <div
            v-for="i in 3"
            :key="i"
            data-testid="cart-skeleton-item"
            class="flex gap-4 py-4"
          >
            <Skeleton class="size-20 shrink-0 rounded-md" />
            <div class="flex flex-1 flex-col gap-2">
              <Skeleton class="h-4 w-2/3" />
              <Skeleton class="h-3 w-1/4" />
              <div class="mt-auto flex items-center gap-3">
                <Skeleton class="h-9 w-24 rounded-md" />
                <Skeleton class="h-4 w-16" />
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <Skeleton class="h-5 w-20" />
              <Skeleton class="mt-auto size-5 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Order Summary -->
      <div class="w-full lg:w-80 lg:shrink-0">
        <div class="bg-muted space-y-4 rounded-lg border p-6">
          <Skeleton class="h-6 w-36" />
          <div class="space-y-3">
            <div class="flex justify-between">
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-4 w-16" />
            </div>
            <div class="flex justify-between">
              <Skeleton class="h-4 w-16" />
              <Skeleton class="h-4 w-12" />
            </div>
            <div class="flex justify-between">
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-4 w-16" />
            </div>
          </div>
          <div class="border-border border-t" />
          <div class="flex justify-between">
            <Skeleton class="h-5 w-12" />
            <Skeleton class="h-5 w-20" />
          </div>
          <Skeleton class="h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  </div>
</template>
