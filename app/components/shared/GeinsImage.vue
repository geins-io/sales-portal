<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';
import type { GeinsImageType } from '#shared/constants/image';
import { buildImageSources } from '#shared/utils/image';

const props = withDefaults(
  defineProps<{
    /** Legacy file name, served raw when there is no library source. */
    fileName?: string | null;
    /** Asset library URL from the API. */
    url?: string | null;
    /** Asset library path from CMS configuration, e.g. `content/banner.jpg`. */
    path?: string | null;
    type: GeinsImageType;
    alt: string;
    aspectRatio?: string;
    loading?: 'lazy' | 'eager';
    /** Rendered width per breakpoint; picks a candidate from the ladder. */
    sizes?: string;
    /** Width ladder for a library image; the default suits full-size images. */
    widths?: number[];
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
    fileName: undefined,
    url: undefined,
    path: undefined,
    aspectRatio: undefined,
    loading: 'lazy',
    sizes: '100vw',
    widths: undefined,
    src: undefined,
    fit: 'cover',
  },
);

const { imageBaseUrl, assetBaseUrl } = useTenant();

const sources = computed(() =>
  props.src
    ? { src: props.src, srcset: null, origin: null }
    : buildImageSources({
        url: props.url,
        path: props.path,
        assetBaseUrl: assetBaseUrl.value,
        fileName: props.fileName,
        type: props.type,
        imageBaseUrl: imageBaseUrl.value,
        widths: props.widths,
      }),
);

const img = useTemplateRef<HTMLImageElement>('img');
const loaded = ref(false);
const errored = ref(false);

function onLoad() {
  loaded.value = true;
}

function onError() {
  errored.value = true;
  loaded.value = true;
}

// A server-rendered image can finish before hydration attaches the listeners.
// decode() rather than naturalWidth: an SVG without intrinsic size reports 0.
onMounted(() => {
  if (img.value?.complete) img.value.decode().then(onLoad, onError);
});

watch(
  () => sources.value.src,
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
    <!-- Skeleton placeholder, painted under the image -->
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

    <img
      v-if="sources.src && !errored"
      ref="img"
      :src="sources.src"
      :srcset="sources.srcset ?? undefined"
      :sizes="sources.srcset ? sizes : undefined"
      :alt="alt"
      :loading="loading"
      decoding="async"
      class="relative"
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
