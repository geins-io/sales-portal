<script setup lang="ts">
import type { ContentType } from '#shared/types/cms';

const props = defineProps<{
  widget: ContentType;
  layout: string;
}>();

const widgetRegistry: Record<
  string,
  ReturnType<typeof defineAsyncComponent>
> = {
  TextPageWidget: defineAsyncComponent(
    () => import('./widgets/TextWidget.vue'),
  ),
  HTMLPageWidget: defineAsyncComponent(
    () => import('./widgets/HtmlWidget.vue'),
  ),
  ImagePageWidget: defineAsyncComponent(
    () => import('./widgets/ImageWidget.vue'),
  ),
  BannerPageWidget: defineAsyncComponent(
    () => import('./widgets/BannerWidget.vue'),
  ),
  ButtonsPageWidget: defineAsyncComponent(
    () => import('./widgets/ButtonsWidget.vue'),
  ),
  JSONPageWidget: defineAsyncComponent(
    () => import('./widgets/JsonWidget.vue'),
  ),
  'Product listPageWidget': defineAsyncComponent(
    () => import('./widgets/ProductListWidget.vue'),
  ),
};

const resolvedComponent = computed(() => {
  const type = props.widget.config?.type;
  if (!type) return null;
  return widgetRegistry[type] ?? null;
});
</script>

<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    :data="widget.data"
    :config="widget.config"
    :layout="layout"
  />
</template>
