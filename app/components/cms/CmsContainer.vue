<script setup lang="ts">
import type { CmsContentContainer, ContentType } from '#shared/types/cms';
import { cmsVisibilityClass } from '#shared/utils/cms-visibility';

const props = defineProps<{
  container: CmsContentContainer;
  // When true, the container renders without its own max-width and horizontal
  // padding so an outer wrapper controls the width. Used by the portal hero,
  // which is already wrapped to the page-content width and must align flush.
  flush?: boolean;
}>();

const layoutClasses = computed(() => {
  switch (props.container.layout) {
    case 'half':
      return 'grid md:grid-cols-2 gap-6';
    case 'third':
      return 'grid md:grid-cols-3 gap-6';
    case 'quarter':
      return 'grid sm:grid-cols-2 lg:grid-cols-4 gap-6';
    case 'full':
    default:
      return 'grid grid-cols-1 gap-6';
  }
});

const designClasses = computed(() => {
  if (props.flush) return '';
  switch (props.container.design) {
    case 'contained':
      return 'mx-auto max-w-7xl px-4 lg:px-6';
    case 'narrow':
      return 'mx-auto max-w-3xl px-4';
    case 'full-width':
      return 'w-full';
    default:
      return 'mx-auto max-w-7xl px-4 lg:px-6';
  }
});

// Per-container "Display settings", derived server-side from the two
// displaySetting fetches (see getContentArea) and applied as viewport-based
// Tailwind so visibility tracks the breakpoint (resize-aware), not the UA.
const visibilityClass = computed(() =>
  cmsVisibilityClass(props.container.visibility),
);

const activeWidgets = computed<ContentType[]>(() => {
  if (!props.container.content) return [];
  return props.container.content
    .filter((w) => w.config?.active !== false)
    .sort((a, b) => (a.config?.sortOrder ?? 0) - (b.config?.sortOrder ?? 0));
});
</script>

<template>
  <section
    v-if="activeWidgets.length"
    :class="[
      designClasses,
      visibilityClass,
      container.design !== 'full-width' && 'py-4',
    ]"
  >
    <div :class="layoutClasses">
      <CmsWidget
        v-for="(widget, index) in activeWidgets"
        :key="`${container.id}-${index}`"
        :widget="widget"
        :layout="container.layout"
      />
    </div>
  </section>
</template>
