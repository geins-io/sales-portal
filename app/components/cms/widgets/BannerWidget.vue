<script setup lang="ts">
import type { BannerWidgetData, ContentConfigType } from '#shared/types/cms';
import { resolveImageFileName } from '#shared/types/cms';

const props = defineProps<{
  data: BannerWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const imageFileName = computed(() => resolveImageFileName(props.data.image));
const hasLink = computed(() => !!props.data.image?.href);
const hasOverlay = computed(
  () => props.data.text1 || props.data.text2 || props.data.buttonText,
);

/** Whether the banner is full-width (determined by config.size or classNames) */
const fullWidth = computed(
  () =>
    props.config.size === 'full' ||
    props.data.classNames === 'full' ||
    props.layout === 'full',
);

/**
 * Text & button placement — depends on fullWidth.
 * ralph-ui reference: CaWidgetBanner.vue
 *
 * Uses textAndButtonPlacementFullWidth when full-width,
 * textAndButtonPlacement when not full-width.
 *
 * Full-width: 0=left, 1=middle/center, 2=right
 * Not full-width: 0=below-image, 1=on-image
 */
const placement = computed(() => {
  return fullWidth.value
    ? (props.data.textAndButtonPlacementFullWidth ?? 0)
    : (props.data.textAndButtonPlacement ?? 0);
});

/** Whether text is overlaid on image vs below it */
const isOverlay = computed(() => {
  if (fullWidth.value) {
    // Full-width: always overlaid (left/middle/right are positions on the image)
    return true;
  }
  // Not full-width: 0=below-image, 1=on-image
  return placement.value === 1;
});

/**
 * Text alignment for the overlay.
 * Full-width: 0=left, 1=center, 2=right
 */
const overlayAlignment = computed(() => {
  if (!fullWidth.value) return 'items-center text-center';
  switch (placement.value) {
    case 0:
      return 'items-start text-left';
    case 2:
      return 'items-end text-right';
    case 1:
    default:
      return 'items-center text-center';
  }
});

/**
 * Text color — ralph-ui maps 0=primary, 1=secondary.
 * We use foreground (dark) for primary (0) and white for secondary (1).
 * ralph-ui reference: CaWidgetBanner.vue textColor()
 */
const textColorClass = computed(() => {
  return props.data.textColor === 0 ? 'text-foreground' : 'text-white';
});
</script>

<template>
  <component
    :is="hasLink ? resolveComponent('NuxtLink') : 'div'"
    :to="hasLink ? data.image.href : undefined"
    class="relative block overflow-hidden"
  >
    <GeinsImage
      v-if="imageFileName"
      :file-name="imageFileName"
      type="cms"
      :alt="data.image?.altText || config.displayName || ''"
      loading="eager"
    />

    <!-- Overlay mode: text on top of image -->
    <div
      v-if="hasOverlay && isOverlay"
      class="absolute inset-0 flex flex-col justify-center p-6 md:p-12"
      :class="[overlayAlignment, textColorClass]"
    >
      <div class="max-w-2xl">
        <p v-if="data.text1" class="text-2xl font-bold md:text-4xl lg:text-5xl">
          {{ data.text1 }}
        </p>
        <p
          v-if="data.text2"
          class="mt-2 text-base opacity-90 md:text-lg lg:text-xl"
        >
          {{ data.text2 }}
        </p>
        <span
          v-if="data.buttonText"
          class="bg-primary text-primary-foreground mt-4 inline-block rounded-md px-6 py-2.5 font-medium"
        >
          {{ data.buttonText }}
        </span>
      </div>
    </div>

    <!-- Below-image mode: text under the image -->
    <div
      v-if="hasOverlay && !isOverlay"
      class="flex flex-col gap-2 p-6"
      :class="textColorClass"
    >
      <p v-if="data.text1" class="text-xl font-bold md:text-2xl">
        {{ data.text1 }}
      </p>
      <p v-if="data.text2" class="text-muted-foreground text-sm md:text-base">
        {{ data.text2 }}
      </p>
      <span
        v-if="data.buttonText"
        class="bg-primary text-primary-foreground mt-2 inline-block self-start rounded-md px-6 py-2 font-medium"
      >
        {{ data.buttonText }}
      </span>
    </div>
  </component>
</template>
