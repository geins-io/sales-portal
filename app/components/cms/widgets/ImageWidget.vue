<script setup lang="ts">
import { NuxtLink } from '#components';
import type { ContentImageType } from '@geins/types';
import type { ImageWidgetData, ContentConfigType } from '#shared/types/cms';
import { resolveImageFileName } from '#shared/types/cms';
import { widgetImageUrl } from '#shared/utils/cms-image';
import { stripGeinsPrefix } from '#shared/utils/menu';

const props = defineProps<{
  data: ImageWidgetData;
  config: ContentConfigType;
  layout: string;
  /** The page's first widget: its image is the largest candidate. */
  priority?: boolean;
  /** The widget's images as the API lists them, with their library URLs. */
  images?: ContentImageType[];
}>();

const imageFileName = computed(() => resolveImageFileName(props.data.image));
const imageUrl = computed(() =>
  widgetImageUrl(props.images, imageFileName.value),
);
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
      :url="imageUrl"
      :path="data.image?.path"
      type="pagewidget"
      :priority="priority"
      :alt="data.image?.altText || config.displayName || ''"
    />
  </component>
</template>
