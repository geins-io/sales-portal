<script setup lang="ts">
import type { ContentContainerType, ContentType } from '#shared/types/cms';

const props = defineProps<{
  container: ContentContainerType;
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
  switch (props.container.design) {
    case 'contained':
      return 'mx-auto max-w-7xl px-4';
    case 'narrow':
      return 'mx-auto max-w-3xl px-4';
    case 'full-width':
      return 'w-full';
    default:
      return 'mx-auto max-w-7xl px-4';
  }
});

const activeWidgets = computed<ContentType[]>(() => {
  if (!props.container.content) return [];
  return props.container.content
    .filter((w) => w.config?.active !== false)
    .sort((a, b) => (a.config?.sortOrder ?? 0) - (b.config?.sortOrder ?? 0));
});
</script>

<template>
  <section v-if="activeWidgets.length" :class="designClasses" class="py-4">
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
