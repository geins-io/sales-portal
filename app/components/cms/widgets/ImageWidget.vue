<script setup lang="ts">
import type { ImageWidgetData, ContentConfigType } from '#shared/types/cms';
import { resolveImageFileName } from '#shared/types/cms';

const props = defineProps<{
  data: ImageWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const imageFileName = computed(() => resolveImageFileName(props.data.image));
const hasLink = computed(() => !!props.data.image?.href);
</script>

<template>
  <component
    :is="hasLink ? resolveComponent('NuxtLink') : 'div'"
    :to="hasLink ? data.image.href : undefined"
  >
    <GeinsImage
      v-if="imageFileName"
      :file-name="imageFileName"
      type="cms"
      :alt="data.image?.altText || config.displayName || ''"
    />
  </component>
</template>
