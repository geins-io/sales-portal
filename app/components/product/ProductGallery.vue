<script setup lang="ts">
import type { ProductImageType } from '#shared/types/commerce';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';

const props = defineProps<{
  images: ProductImageType[];
  productName: string;
}>();

const selectedIndex = ref(0);
const lightboxOpen = ref(false);

function selectImage(index: number) {
  selectedIndex.value = index;
}

function openLightbox() {
  lightboxOpen.value = true;
}

function prev() {
  selectedIndex.value =
    (selectedIndex.value - 1 + props.images.length) % props.images.length;
}

function next() {
  selectedIndex.value = (selectedIndex.value + 1) % props.images.length;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  }
}

const currentImage = computed(() => props.images[selectedIndex.value]);
const showThumbnails = computed(() => props.images.length > 1);
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="product-gallery">
    <!-- Gallery: thumbnails left + main image right -->
    <div class="flex gap-3">
      <!-- Vertical thumbnail strip -->
      <div
        v-if="showThumbnails"
        class="flex flex-col gap-2 overflow-y-auto p-0.5"
        data-testid="thumbnails"
      >
        <Button
          v-for="(image, index) in images"
          :key="index"
          variant="ghost"
          class="bg-muted size-16 shrink-0 overflow-hidden rounded-md p-0 transition-all"
          :class="
            index === selectedIndex
              ? 'ring-primary ring-2 ring-offset-1'
              : 'opacity-70 hover:opacity-100'
          "
          @click="selectImage(index)"
        >
          <GeinsImage
            :file-name="image.fileName ?? ''"
            type="product"
            :alt="`${productName} thumbnail ${index + 1}`"
            loading="lazy"
            class="size-full object-cover"
          />
        </Button>
      </div>

      <!-- Main image -->
      <Button
        v-if="currentImage"
        variant="ghost"
        class="bg-muted h-auto flex-1 cursor-pointer overflow-hidden rounded-lg p-0"
        @click="openLightbox"
      >
        <GeinsImage
          :file-name="currentImage.fileName ?? ''"
          type="product"
          :alt="productName"
          loading="eager"
          class="max-h-[500px] w-full object-contain"
        />
      </Button>
    </div>

    <!-- Image counter -->
    <p
      v-if="showThumbnails"
      class="text-muted-foreground text-xs"
      data-testid="image-counter"
    >
      Image {{ selectedIndex + 1 }} of {{ images.length }}
    </p>

    <!-- Lightbox -->
    <Dialog v-model:open="lightboxOpen">
      <DialogContent class="max-w-4xl p-0" @keydown="onKeydown">
        <div class="relative flex items-center justify-center">
          <GeinsImage
            v-if="currentImage"
            :file-name="currentImage.fileName ?? ''"
            type="product"
            :alt="productName"
            loading="eager"
            class="max-h-[80vh] w-full object-contain"
          />

          <!-- Navigation arrows -->
          <Button
            v-if="images.length > 1"
            variant="ghost"
            size="icon"
            class="bg-background/80 hover:bg-background absolute left-2 rounded-full shadow-md"
            aria-label="Previous image"
            @click="prev"
          >
            <Icon name="lucide:chevron-left" class="size-5" />
          </Button>
          <Button
            v-if="images.length > 1"
            variant="ghost"
            size="icon"
            class="bg-background/80 hover:bg-background absolute right-2 rounded-full shadow-md"
            aria-label="Next image"
            @click="next"
          >
            <Icon name="lucide:chevron-right" class="size-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
