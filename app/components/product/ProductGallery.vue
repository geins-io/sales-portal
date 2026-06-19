<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { ProductImageType } from '#shared/types/commerce';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';

const props = defineProps<{
  images: ProductImageType[];
  productName: string;
}>();

const { buildProductImageAlt } = useProductImageAlt();

const selectedIndex = ref(0);
const lightboxOpen = ref(false);

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
const hasMultiple = computed(() => props.images.length > 1);

/**
 * Accessible alt text for the currently displayed image.
 *
 * Delegates to useProductImageAlt, which is the single canonical source of
 * truth for PDP image alt text. The native Geins altText field is passed as
 * manualAlt; when absent or empty the composable falls through to the
 * generated name plus positional counter so a real product image is never
 * left blank.
 */
const currentAlt = computed(() =>
  buildProductImageAlt({
    name: props.productName,
    index: selectedIndex.value,
    total: props.images.length,
    manualAlt: props.images[selectedIndex.value]?.altText,
  }),
);
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="product-gallery">
    <!-- Main image with overlay arrows.
         Arrows fade to a low base opacity so they don't compete with the
         product photo, and lift to full opacity on hover anywhere on the
         image area. `group` + `group-hover` on the wrapper keeps the
         lift behaviour without requiring hover on the buttons themselves. -->
    <div
      class="bg-muted group relative aspect-square overflow-hidden rounded-lg"
    >
      <Button
        v-if="currentImage"
        variant="ghost"
        class="size-full cursor-pointer p-0"
        @click="openLightbox"
      >
        <GeinsImage
          :file-name="currentImage.fileName ?? ''"
          type="product"
          :alt="currentAlt"
          loading="eager"
          class="size-full object-contain"
        />
      </Button>

      <Button
        v-if="hasMultiple"
        variant="ghost"
        size="icon"
        class="bg-background/80 hover:bg-background absolute top-1/2 left-2 -translate-y-1/2 rounded-full opacity-40 shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="$t('product.gallery_previous')"
        data-testid="gallery-prev"
        @click="prev"
      >
        <ChevronLeft class="size-5" />
      </Button>
      <Button
        v-if="hasMultiple"
        variant="ghost"
        size="icon"
        class="bg-background/80 hover:bg-background absolute top-1/2 right-2 -translate-y-1/2 rounded-full opacity-40 shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="$t('product.gallery_next')"
        data-testid="gallery-next"
        @click="next"
      >
        <ChevronRight class="size-5" />
      </Button>
    </div>

    <!-- Image counter -->
    <p
      v-if="hasMultiple"
      class="text-muted-foreground text-center text-xs"
      data-testid="image-counter"
    >
      {{
        $t('product.image_counter', {
          current: selectedIndex + 1,
          total: images.length,
        })
      }}
    </p>

    <!-- Lightbox -->
    <Dialog v-model:open="lightboxOpen">
      <DialogContent class="max-w-4xl p-0" @keydown="onKeydown">
        <div class="relative flex items-center justify-center">
          <GeinsImage
            v-if="currentImage"
            :file-name="currentImage.fileName ?? ''"
            type="product"
            :alt="currentAlt"
            loading="eager"
            class="max-h-[80vh] w-full object-contain"
          />

          <Button
            v-if="hasMultiple"
            variant="ghost"
            size="icon"
            class="bg-background/80 hover:bg-background absolute left-2 rounded-full shadow-md"
            :aria-label="$t('product.gallery_previous')"
            @click="prev"
          >
            <ChevronLeft class="size-5" />
          </Button>
          <Button
            v-if="hasMultiple"
            variant="ghost"
            size="icon"
            class="bg-background/80 hover:bg-background absolute right-2 rounded-full shadow-md"
            :aria-label="$t('product.gallery_next')"
            @click="next"
          >
            <ChevronRight class="size-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
