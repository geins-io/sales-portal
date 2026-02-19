<script setup lang="ts">
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
  }>(),
  {
    aspectRatio: undefined,
    loading: 'lazy',
    sizes: undefined,
    src: undefined,
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
    :style="aspectRatio ? { aspectRatio } : undefined"
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
      <Icon name="lucide:image-off" class="size-8" />
    </div>

    <!-- Image -->
    <NuxtImg
      v-if="imgSrc && !errored"
      :src="imgSrc"
      :alt="alt"
      :loading="loading"
      :sizes="sizes"
      class="size-full object-cover"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>
