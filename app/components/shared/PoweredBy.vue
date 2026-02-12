<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { PoweredByVariants } from '@/lib/powered-by';
import { cn } from '@/lib/utils';
import { poweredByVariants } from '@/lib/powered-by';

const props = withDefaults(
  defineProps<{
    variant?: PoweredByVariants['variant'] | 'none';
    label?: string;
    href?: string;
    class?: HTMLAttributes['class'];
  }>(),
  {
    label: 'Powered by Litium',
    href: 'https://www.litium.com',
  },
);

const { watermark } = useTenant();

const effectiveVariant = computed(() => props.variant ?? watermark.value);
</script>

<template>
  <a
    v-if="effectiveVariant !== 'none'"
    data-slot="powered-by"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :class="cn(poweredByVariants({ variant: effectiveVariant }), props.class)"
  >
    <LitiumLogo variant="symbol" />
    <span v-if="effectiveVariant === 'full'">{{ label }}</span>
  </a>
</template>
