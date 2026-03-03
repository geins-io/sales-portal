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
    class="border-border flex items-start gap-4 rounded-lg border p-4"
    data-testid="portal-stat-card"
  >
    <div class="relative">
      <div
        class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full"
      >
        <Icon :name="icon" class="size-5" />
      </div>
      <span
        v-if="showDot"
        data-testid="stat-card-dot"
        class="bg-destructive absolute -top-0.5 -right-0.5 size-2.5 rounded-full"
      />
    </div>
    <div>
      <p class="text-2xl leading-none font-bold">{{ count }}</p>
      <p class="text-sm font-medium">{{ label }}</p>
      <p v-if="subtitle" class="text-muted-foreground text-xs">
        {{ subtitle }}
      </p>
    </div>
  </div>
</template>
