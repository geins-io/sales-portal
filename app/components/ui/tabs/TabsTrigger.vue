<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { inject } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { TabsTrigger, useForwardProps } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<
  TabsTriggerProps & { class?: HTMLAttributes['class'] }
>();

const variant = inject<'pill' | 'underline'>('tabs-variant', 'pill');

const delegatedProps = reactiveOmit(props, 'class');

const forwardedProps = useForwardProps(delegatedProps);

const pillClasses =
  "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const underlineClasses =
  "text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary inline-flex items-center justify-center gap-1.5 border-b-2 border-transparent px-1 pb-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
</script>

<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    :class="
      cn(variant === 'underline' ? underlineClasses : pillClasses, props.class)
    "
    v-bind="forwardedProps"
  >
    <slot />
  </TabsTrigger>
</template>
