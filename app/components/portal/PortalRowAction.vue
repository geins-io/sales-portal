<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';

defineProps<{
  to: string;
  label: string;
  ariaLabel?: string;
  testid?: string;
}>();
</script>

<template>
  <NuxtLink
    :to="to"
    class="border-border hover:bg-muted/40 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
    :aria-label="ariaLabel ?? label"
    :data-testid="testid"
  >
    {{ label }}
    <ChevronRight class="size-4" />
  </NuxtLink>
</template>
