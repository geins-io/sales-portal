<script setup lang="ts">
import type { FunctionalComponent } from 'vue';

defineProps<{
  icon: FunctionalComponent;
  count: number;
  label: string;
  subtitle?: string;
  showDot?: boolean;
  /** When set, the large number links to the corresponding portal view. */
  to?: string;
}>();
</script>

<template>
  <div
    class="border-border bg-card flex flex-col rounded-lg border p-6"
    data-testid="portal-stat-card"
  >
    <!-- Top row: label (left) + small icon (top-right) per Figma -->
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-medium">{{ label }}</p>
      <div class="relative shrink-0">
        <component :is="icon" class="text-muted-foreground size-4" />
        <span
          v-if="showDot"
          data-testid="stat-card-dot"
          class="bg-destructive absolute -top-1 -right-1 size-2 rounded-full"
        />
      </div>
    </div>

    <!-- Optional subtitle (small muted line) — only when data is provided -->
    <p
      v-if="subtitle"
      class="text-muted-foreground mt-1 text-xs"
      data-testid="stat-card-subtitle"
    >
      {{ subtitle }}
    </p>

    <!-- Big number at bottom. When `to` is set it links to the matching
         portal view, on both mobile and desktop. -->
    <NuxtLink
      v-if="to"
      :to="to"
      data-testid="stat-card-count"
      class="mt-6 inline-block text-3xl leading-none font-bold hover:underline"
    >
      {{ count }}
    </NuxtLink>
    <p
      v-else
      data-testid="stat-card-count"
      class="mt-6 text-3xl leading-none font-bold"
    >
      {{ count }}
    </p>
  </div>
</template>
