<script setup lang="ts">
import type { TabsListProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { provide } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { TabsList } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<
    TabsListProps & {
      class?: HTMLAttributes['class'];
      variant?: 'pill' | 'underline';
    }
  >(),
  { variant: 'pill' },
);

provide('tabs-variant', props.variant);

const delegatedProps = reactiveOmit(props, 'class', 'variant');

const pillClasses =
  'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]';
const underlineClasses =
  'text-muted-foreground inline-flex w-full items-center gap-4 border-b';
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :class="
      cn(
        props.variant === 'underline' ? underlineClasses : pillClasses,
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
