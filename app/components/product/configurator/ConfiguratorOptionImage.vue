<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';

/**
 * The image box of a row in a group with an image column: the option's image,
 * or a placeholder of the same size, so every row of the group has one shape.
 */
const { fileName, alt } = defineProps<{
  fileName: string | undefined;
  alt: string;
}>();
</script>

<template>
  <span
    data-testid="configurator-option-image"
    class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md"
    :class="fileName ? 'bg-background' : 'bg-muted'"
  >
    <GeinsImage
      v-if="fileName"
      :file-name="fileName"
      type="product"
      :alt="alt"
      class="size-full"
    />
    <ImageOff
      v-else
      data-testid="configurator-option-image-placeholder"
      class="text-muted-foreground/40 size-4"
      aria-hidden="true"
    />
  </span>
</template>
