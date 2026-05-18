<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';
import type { GeinsImageType } from '#shared/constants/image';
import { buildGeinsRawUrl } from '#shared/utils/image';

const props = withDefaults(
  defineProps<{
    fileName: string;
    type: GeinsImageType;
    alt: string;
    aspectRatio?: string;
    loading?: 'lazy' | 'eager';
    sizes?: string;
    /** Override src entirely (skips CDN URL building) */
    src?: string;
    /**
     * Sizing mode for the inner img.
     *
     * - `cover` (default): img fills the container; container controls ratio.
     * - `contain`: img fits inside the container with letterboxing; container controls ratio.
     * - `natural`: img keeps its intrinsic aspect ratio; container hugs the image.
     */
    fit?: 'cover' | 'contain' | 'natural';
  }>(),
  {
    aspectRatio: undefined,
    loading: 'lazy',
    sizes: undefined,
    src: undefined,
    fit: 'cover',
  },
);

const { imageBaseUrl } = useTenant();

const imgSrc = computed(() => {
  if (props.src) return props.src;
  if (!imageBaseUrl.value || !props.fileName) return '';
  return buildGeinsRawUrl(imageBaseUrl.value, props.type, props.fileName);
});

const loaded = ref(false);
const errored = ref(false);

function onLoad() {
  loaded.value = true;
}

function onError() {
  errored.value = true;
  loaded.value = true;
}

// Reset state when fileName changes
watch(
  () => props.fileName,
  () => {
    loaded.value = false;
    errored.value = false;
  },
);
</script>

<template>
  <div
    class="relative overflow-hidden"
    :class="aspectRatio ? `aspect-[${aspectRatio}]` : ''"
  >
    <!-- Skeleton placeholder -->
    <div
      v-if="!loaded"
      class="bg-muted absolute inset-0 animate-pulse"
      aria-hidden="true"
    />

    <!-- Error fallback -->
    <div
      v-if="errored"
      class="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center"
    >
      <ImageOff class="size-8" />
    </div>

    <!-- Image -->
    <NuxtImg
      v-if="imgSrc && !errored"
      :src="imgSrc"
      :alt="alt"
      :loading="loading"
      :sizes="sizes"
      :class="
        fit === 'natural'
          ? 'block h-auto w-full'
          : ['size-full', fit === 'contain' ? 'object-contain' : 'object-cover']
      "
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>
