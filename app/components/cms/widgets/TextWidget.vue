<script setup lang="ts">
import type { TextWidgetData, ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: TextWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

/**
 * Heading tag from titleRenderMode.
 * ralph-ui reference: CaWidgetText.vue getHeadingTag()
 * 0=h1, 1=h2, 2=h3, 3=div
 */
const headingTag = computed(() => {
  const mode = props.data.titleRenderMode;
  if (mode === 0) return 'h1';
  if (mode === 1) return 'h2';
  if (mode === 2) return 'h3';
  return 'div';
});

/**
 * Text alignment from textAlignment.
 * ralph-ui reference: CaWidgetText.vue textAlignmentClass()
 * 1=left, 2=center, 3=right, 4=justify, 0/default=none
 */
const alignmentClass = computed(() => {
  switch (props.data.textAlignment) {
    case 1:
      return 'text-left';
    case 2:
      return 'text-center';
    case 3:
      return 'text-right';
    case 4:
      return 'text-justify';
    default:
      return '';
  }
});

/** ralph-ui uses configuration.title, not displayName */
const title = computed(
  () => props.data.title || props.config.displayName || '',
);
</script>

<template>
  <div :class="alignmentClass">
    <component :is="headingTag" v-if="title" class="mb-4 font-bold">
      {{ title }}
    </component>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="data.text" class="prose max-w-none" v-html="data.text" />
  </div>
</template>
