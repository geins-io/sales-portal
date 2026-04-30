<script setup lang="ts">
defineProps<{
  icon: string;
  count: number;
  label: string;
  subtitle?: string;
  showDot?: boolean;
}>();
</script>

<template>
  <div
    class="border-border flex flex-col rounded-lg border p-6"
    data-testid="portal-stat-card"
  >
    <!-- Top row: label (left) + small icon (top-right) per Figma -->
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-medium">{{ label }}</p>
      <div class="relative shrink-0">
        <Icon :name="icon" class="text-muted-foreground size-4" />
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

    <!-- Big number at bottom -->
    <p class="mt-6 text-3xl leading-none font-bold">{{ count }}</p>
  </div>
</template>
