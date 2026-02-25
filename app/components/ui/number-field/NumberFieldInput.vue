<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { NumberFieldInput } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <NumberFieldInput
    data-slot="input"
    :class="
      cn(
        'border-input placeholder:text-muted-foreground focus-visible:ring-ring w-8 border-x bg-transparent py-1.5 text-center text-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
