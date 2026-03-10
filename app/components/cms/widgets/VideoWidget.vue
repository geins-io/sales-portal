<script setup lang="ts">
import type { VideoWidgetData, ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: VideoWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

/**
 * Video provider — 0=youtube, 1=vimeo.
 * ralph-ui reference: CaWidgetVideo.vue videoProvider
 */
const provider = computed(() =>
  props.data.videoProvider === 1 ? 'vimeo' : 'youtube',
);

/** Embed URL for the iframe */
const embedUrl = computed(() => {
  if (!props.data.videoId) return '';
  return provider.value === 'vimeo'
    ? `https://player.vimeo.com/video/${props.data.videoId}`
    : `https://www.youtube.com/embed/${props.data.videoId}`;
});
</script>

<template>
  <div v-if="embedUrl" data-testid="cms-widget" class="w-full">
    <iframe
      :src="embedUrl"
      class="aspect-video w-full"
      frameborder="0"
      allowfullscreen
      allow="autoplay; encrypted-media"
      :title="config.displayName || 'Video'"
    />
  </div>
</template>
