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
  'Rich textPageWidget': defineAsyncComponent(
    () => import('./widgets/TextWidget.vue'),
  ),
  'Product listPageWidget': defineAsyncComponent(
    () => import('./widgets/ProductListWidget.vue'),
  ),
  VideoPageWidget: defineAsyncComponent(
    () => import('./widgets/VideoWidget.vue'),
  ),
};

const resolvedComponent = computed(() => {
  const type = props.widget.config?.type;
  if (!type) return null;
  return widgetRegistry[type] ?? null;
});

const isDev = import.meta.env.DEV;

const unknownType = computed(() => {
  const type = props.widget.config?.type;
  return !resolvedComponent.value && type ? type : null;
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
  <div
    v-else-if="unknownType && isDev"
    data-testid="cms-widget-unknown"
    class="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
  >
    Unknown widget: {{ unknownType }}
  </div>
</template>
