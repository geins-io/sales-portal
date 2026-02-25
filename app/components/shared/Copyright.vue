<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

const { brandName } = useTenant();
const year = new Date().getFullYear();
</script>

<template>
  <span
    data-slot="copyright"
    :class="cn('text-xs text-neutral-400', props.class)"
  >
    &copy; {{ year }} {{ brandName }}. All rights reserved.
  </span>
</template>
