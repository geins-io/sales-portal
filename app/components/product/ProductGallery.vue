<script setup lang="ts">
import type { ProductImageType } from '#shared/types/commerce';
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
  <div class="flex flex-col gap-3">
    <!-- Main image -->
    <button
      v-if="currentImage"
      type="button"
      class="bg-muted aspect-square w-full cursor-pointer overflow-hidden rounded-lg"
      @click="openLightbox"
    >
      <GeinsImage
        :file-name="currentImage.fileName ?? ''"
        type="product"
        :alt="productName"
        loading="eager"
        class="size-full object-cover"
      />
    </button>

    <!-- Thumbnails -->
    <div
      v-if="showThumbnails"
      class="flex gap-2 overflow-x-auto"
      data-testid="thumbnails"
    >
      <button
        v-for="(image, index) in images"
        :key="index"
        type="button"
        class="bg-muted size-16 shrink-0 overflow-hidden rounded-md transition-all"
        :class="
          index === selectedIndex
            ? 'ring-primary ring-2 ring-offset-2'
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
      </button>
    </div>

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
          <button
            v-if="images.length > 1"
            type="button"
            class="bg-background/80 hover:bg-background absolute left-2 rounded-full p-2 shadow-md"
            aria-label="Previous image"
            @click="prev"
          >
            <Icon name="lucide:chevron-left" class="size-5" />
          </button>
          <button
            v-if="images.length > 1"
            type="button"
            class="bg-background/80 hover:bg-background absolute right-2 rounded-full p-2 shadow-md"
            aria-label="Next image"
            @click="next"
          >
            <Icon name="lucide:chevron-right" class="size-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
