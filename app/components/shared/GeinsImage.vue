<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';
import type { GeinsImageType } from '#shared/constants/image';
import type { CoverSources } from '#shared/utils/image';
import {
  buildCoverSources,
  buildImageSources,
  parseAspectRatio,
} from '#shared/utils/image';

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
    /**
     * The box's ratio, e.g. `1` or `16/9`. Shapes the box, and a `cover`
     * image is asked of the CDN in that shape, so the crop is never upscaled.
     */
    aspectRatio?: string;
    /**
     * Height in css px of a `cover` box whose width follows the viewport;
     * the image is asked for per viewport range to cover it.
     */
    coverHeight?: number;
    loading?: 'lazy' | 'eager';
    /**
     * The page's largest image: fetched eagerly at high priority, decoded at
     * once, preloaded from the head, and its CDN origin preconnected.
     */
    priority?: boolean;
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
    coverHeight: undefined,
    loading: 'lazy',
    priority: false,
    sizes: '100vw',
    widths: undefined,
    src: undefined,
    fit: 'cover',
  },
);

const { imageBaseUrl, assetBaseUrl } = useTenant();

const ratio = computed(() => parseAspectRatio(props.aspectRatio));

const sources = computed<CoverSources>(() => {
  if (props.src)
    return { src: props.src, srcset: null, origin: null, sources: [] };
  const input = {
    url: props.url,
    path: props.path,
    assetBaseUrl: assetBaseUrl.value,
    fileName: props.fileName,
    type: props.type,
    imageBaseUrl: imageBaseUrl.value,
  };
  if (props.fit === 'cover' && props.coverHeight)
    return buildCoverSources({ ...input, height: props.coverHeight });
  return {
    ...buildImageSources({
      ...input,
      widths: props.widths,
      ratio: props.fit === 'cover' ? ratio.value : undefined,
    }),
    sources: [],
  };
});

// The preload carries the img's own candidates and sizes, so both resolve to
// one URL and the browser fetches it once. A <picture> gets one preload per
// source, each limited to its source's viewport range.
if (props.priority) {
  const preload = (
    key: string,
    href: string,
    candidates: { media?: string; imagesrcset?: string; imagesizes?: string },
  ) =>
    ({
      key,
      rel: 'preload',
      as: 'image',
      href,
      ...candidates,
      fetchpriority: 'high',
    }) as const;
  useHead({
    link: computed(() => {
      const { src, srcset, origin, sources: ranges } = sources.value;
      if (!src) return [];
      return [
        ...(origin
          ? [{ key: 'image-cdn-preconnect', rel: 'preconnect', href: origin }]
          : []),
        ...(ranges.length
          ? ranges.map((range, i) =>
              preload(`image-preload-${src}-${i}`, src, {
                media: range.media,
                imagesrcset: range.srcset,
              }),
            )
          : [
              preload(`image-preload-${src}`, src, {
                imagesrcset: srcset ?? undefined,
                imagesizes: srcset ? props.sizes : undefined,
              }),
            ]),
      ];
    }),
  });
}

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
    v-bind="ratio ? { style: { aspectRatio: ratio } } : {}"
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

    <picture v-if="sources.src && !errored && sources.sources.length">
      <source
        v-for="range in sources.sources"
        :key="range.media"
        :media="range.media"
        :srcset="range.srcset"
      />
      <img
        ref="img"
        :src="sources.src"
        :srcset="sources.srcset ?? undefined"
        :alt="alt"
        :loading="priority ? 'eager' : loading"
        :fetchpriority="priority ? 'high' : undefined"
        :decoding="priority ? undefined : 'async'"
        class="relative size-full object-cover"
        @load="onLoad"
        @error="onError"
      />
    </picture>
    <img
      v-else-if="sources.src && !errored"
      ref="img"
      :src="sources.src"
      :srcset="sources.srcset ?? undefined"
      :sizes="sources.srcset ? sizes : undefined"
      :alt="alt"
      :loading="priority ? 'eager' : loading"
      :fetchpriority="priority ? 'high' : undefined"
      :decoding="priority ? undefined : 'async'"
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
