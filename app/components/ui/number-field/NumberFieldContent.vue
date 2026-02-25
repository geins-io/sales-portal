<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div
    :class="
      cn(
        'border-input inline-flex items-stretch rounded-md border',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
