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
    :class="cn('text-footer-text/70 text-xs', props.class)"
  >
    {{ $t('footer.copyright', { year, brand: brandName }) }}
  </span>
</template>
