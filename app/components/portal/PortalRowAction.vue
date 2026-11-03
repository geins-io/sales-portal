<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';

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
    class="focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm underline-offset-4 transition-colors outline-none hover:underline focus-visible:ring-[3px]"
    :aria-label="ariaLabel ?? label"
    :data-testid="testid"
  >
    {{ label }}
    <ArrowRight class="size-4" aria-hidden="true" />
  </NuxtLink>
</template>
