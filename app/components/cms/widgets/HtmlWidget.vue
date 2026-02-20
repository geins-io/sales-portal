<script setup lang="ts">
import type { HtmlWidgetData, ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: HtmlWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

useHead(
  computed(() => {
    if (!props.data.css) return {};
    return {
      style: [{ innerHTML: props.data.css }],
    };
  }),
);
</script>

<template>
  <div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="data.html" class="prose max-w-none" v-html="data.html" />
  </div>
</template>
