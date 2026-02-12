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
    :class="cn('text-muted-foreground text-xs', props.class)"
  >
    &copy; {{ year }} {{ brandName }}. All rights reserved.
  </span>
</template>
