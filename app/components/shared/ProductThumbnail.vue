<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    fileName?: string | null;
    alt?: string;
    size?: string;
    radius?: string;
    iconSize?: string;
    /** The width the image is shown at, so the browser picks a sharp file. */
    sizes?: string;
  }>(),
  {
    fileName: '',
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
      v-if="fileName"
      :file-name="fileName"
      type="product"
      :alt="alt ?? ''"
      aspect-ratio="1"
      :sizes="sizes"
    />
    <div v-else class="bg-muted flex size-full items-center justify-center">
      <ImageOff :class="['text-muted-foreground', iconSize]" />
    </div>
  </div>
</template>
