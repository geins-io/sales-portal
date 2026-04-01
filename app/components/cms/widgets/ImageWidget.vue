<script setup lang="ts">
import { NuxtLink } from '#components';
import type { ImageWidgetData, ContentConfigType } from '#shared/types/cms';
import { resolveImageFileName } from '#shared/types/cms';
import { stripGeinsPrefix } from '#shared/utils/menu';

const props = defineProps<{
  data: ImageWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const imageFileName = computed(() => resolveImageFileName(props.data.image));
const hasLink = computed(() => !!props.data.image?.href);
const { localePath } = useLocaleMarket();
</script>

<template>
  <component
    :is="hasLink ? NuxtLink : 'div'"
    :to="hasLink ? localePath(stripGeinsPrefix(data.image.href!)) : undefined"
    data-testid="cms-widget"
  >
    <GeinsImage
      v-if="imageFileName"
      :file-name="imageFileName"
      type="pagewidget"
      :alt="data.image?.altText || config.displayName || ''"
    />
  </component>
</template>
