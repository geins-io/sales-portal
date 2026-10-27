<script setup lang="ts">
import type { ContentType } from '#shared/types/cms';

const props = defineProps<{
  widget: ContentType;
  layout: string;
  // "Mobile behavior = Collapse" on the parent container. Forwarded to the
  // widget; only the cards widgets (JsonWidget) act on it. Absent/false for
  // every Stack container, so non-collapse rendering is unchanged.
  collapse?: boolean;
  // Set on a page's first widget. Forwarded; only the image widgets act on it.
  priority?: boolean;
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

// Only these widgets declare `images`; on any other it would fall through as
// an attribute on the widget's root element.
const IMAGE_WIDGET_TYPES = new Set(['ImagePageWidget', 'BannerPageWidget']);
const images = computed(() =>
  IMAGE_WIDGET_TYPES.has(props.widget.config?.type ?? '')
    ? props.widget.images
    : undefined,
);

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
    :collapse="collapse"
    :priority="priority || undefined"
    :images="images"
  />
  <div
    v-else-if="unknownType && isDev"
    data-testid="cms-widget-unknown"
    class="border-warning/20 bg-warning/10 text-warning rounded border px-3 py-2 text-xs"
  >
    Unknown widget: {{ unknownType }}
  </div>
</template>
