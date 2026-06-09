<script setup lang="ts">
import type { TextWidgetData, ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: TextWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

/**
 * Heading tag from titleRenderMode.
 * Geins CMS heading tag from titleRenderMode.
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
 * Geins CMS text alignment from textAlignment field.
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

/**
 * Heading text for the widget. Only an explicitly authored title renders.
 * We deliberately do NOT fall back to config.displayName: Geins fills that
 * with the widget TYPE name (e.g. "Rich text"), which would leak onto the
 * page as a stray bold heading above the content.
 */
const title = computed(() => props.data.title || '');

/**
 * Geins admin can save either rich-text HTML (with p/br/etc.) or plain
 * multi-line text. For the plain-text shape, convert newline characters to
 * <br /> so the line breaks survive v-html rendering.
 */
const BLOCK_TAG_PATTERN = /<(p|div|br|ul|ol|h[1-6])/i;

const renderedText = computed(() => {
  const raw = props.data.text ?? '';
  if (!raw) return '';
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (BLOCK_TAG_PATTERN.test(normalized)) return normalized;
  return normalized.replace(/\n/g, '<br />');
});
</script>

<template>
  <div :class="alignmentClass" data-testid="cms-widget">
    <component :is="headingTag" v-if="title" class="mb-4 font-bold">
      {{ title }}
    </component>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="renderedText" class="rich-text max-w-none" v-html="renderedText" />
  </div>
</template>
