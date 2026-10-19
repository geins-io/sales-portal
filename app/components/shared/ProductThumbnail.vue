<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';
import { THUMBNAIL_WIDTHS } from '#shared/utils/image';

withDefaults(
  defineProps<{
    fileName?: string | null;
    /** Asset library URL; the legacy file name is the fallback. */
    url?: string | null;
    alt?: string;
    size?: string;
    radius?: string;
    iconSize?: string;
    /** The width the image is shown at, so the browser picks a sharp file. */
    sizes?: string;
  }>(),
  {
    fileName: '',
    url: null,
    alt: '',
    size: 'size-10',
    radius: 'rounded',
    iconSize: 'size-4',
    sizes: '48px',
  },
);
</script>

<template>
  <div :class="['shrink-0 overflow-hidden', size, radius]">
    <GeinsImage
      v-if="fileName || url"
      :file-name="fileName"
      :url="url"
      type="product"
      :alt="alt ?? ''"
      aspect-ratio="1"
      :sizes="sizes"
      :widths="THUMBNAIL_WIDTHS"
    />
    <div v-else class="bg-muted flex size-full items-center justify-center">
      <ImageOff :class="['text-muted-foreground', iconSize]" />
    </div>
  </div>
</template>
