<script setup lang="ts">
import type { NumberFieldDecrementProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { Minus } from 'lucide-vue-next';
import { NumberFieldDecrement, useForwardProps } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<
  NumberFieldDecrementProps & { class?: HTMLAttributes['class'] }
>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <NumberFieldDecrement
    data-slot="decrement"
    v-bind="forwarded"
    :class="
      cn(
        'hover:bg-muted flex items-center justify-center px-2 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-20',
        props.class,
      )
    "
  >
    <slot>
      <Minus class="h-4 w-4" />
    </slot>
  </NumberFieldDecrement>
</template>
