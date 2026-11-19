<script setup lang="ts">
import type { TabsListProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import {
  computed,
  onMounted,
  provide,
  ref,
  shallowRef,
  useTemplateRef,
} from 'vue';
import {
  reactiveOmit,
  unrefElement,
  useEventListener,
  useMutationObserver,
  useResizeObserver,
} from '@vueuse/core';
import { TabsList } from 'reka-ui';
import { cn } from '@/lib/utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    TabsListProps & {
      class?: HTMLAttributes['class'];
      variant?: 'pill' | 'underline';
      /** What an underline row sits on, so its scroll fade matches it. */
      surface?: 'page' | 'card';
    }
  >(),
  { variant: 'pill', surface: 'page' },
);

provide('tabs-variant', props.variant);

const delegatedProps = reactiveOmit(props, 'class', 'variant', 'surface');

const pillClasses =
  'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]';
// Scrolls inside itself, as the portal's page row does: the labels stay on one
// line, so a row wider than a phone would otherwise widen the page.
const underlineClasses =
  'text-muted-foreground inline-flex w-full scrollbar-none items-center gap-4 overflow-x-auto border-b';

const list = useTemplateRef('list');
const listEl = computed(
  () => unrefElement(list.value ?? undefined) as HTMLElement | undefined,
);
const items = shallowRef<HTMLElement[]>([]);

// Starts false and is measured, so a row that fits never shows the fade, not
// even before hydration.
const moreToTheRight = ref(false);

// +1 absorbs the sub-pixel scroll width.
function measure() {
  const el = listEl.value;
  moreToTheRight.value =
    !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function collectItems() {
  items.value = Array.from(listEl.value?.children ?? []).filter(
    (item) => item instanceof HTMLElement,
  );
  measure();
}

useEventListener(listEl, 'scroll', measure, { passive: true });
// The row's box follows the viewport; each tab's follows its label, the web
// font, and a count that arrives after the first render.
useResizeObserver(() => [listEl.value, ...items.value], measure);
useMutationObserver(listEl, collectItems, { childList: true });

onMounted(collectItems);
</script>

<template>
  <div v-if="props.variant === 'underline'" class="relative">
    <TabsList
      ref="list"
      data-slot="tabs-list"
      v-bind="{ ...delegatedProps, ...$attrs }"
      :class="cn(underlineClasses, props.class)"
    >
      <slot />
    </TabsList>
    <!-- The portal row's scroll hint, shown only while there is more row to
         the right. Off in forced colours, where it would render as a block. -->
    <div
      v-if="moreToTheRight"
      aria-hidden="true"
      data-slot="tabs-list-fade"
      class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l to-transparent md:hidden forced-colors:hidden"
      :class="props.surface === 'card' ? 'from-card' : 'from-site-background'"
    />
  </div>
  <TabsList
    v-else
    data-slot="tabs-list"
    v-bind="{ ...delegatedProps, ...$attrs }"
    :class="cn(pillClasses, props.class)"
  >
    <slot />
  </TabsList>
</template>
