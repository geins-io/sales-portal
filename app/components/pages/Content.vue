<script setup lang="ts">
import type { ContentPageType } from '#shared/types/cms';
import type { PageRouteResolution } from '#shared/types/common';

const props = defineProps<{
  resolution: PageRouteResolution;
}>();

const {
  data: page,
  error,
  status,
} = useFetch<ContentPageType>(
  () => `/api/cms/page/${props.resolution.pageSlug}`,
  { dedupe: 'defer' },
);

const hasSidebar = computed(() => !!page.value?.pageArea?.name);
const sidebarMenuId = computed(() => page.value?.pageArea?.name ?? '');

useHead(
  computed(() => {
    if (!page.value?.meta) return {};
    return {
      title: page.value.meta.title,
      meta: [
        ...(page.value.meta.description
          ? [{ name: 'description', content: page.value.meta.description }]
          : []),
      ],
    };
  }),
);
</script>

<template>
  <div>
    <!-- Sidebar layout: page has a pageArea with navigation -->
    <div v-if="hasSidebar && page?.containers?.length" class="md:flex md:gap-8">
      <PageSidebarNav
        :menu-location-id="sidebarMenuId"
        class="mb-6 md:mb-0 md:w-64 md:shrink-0"
      />
      <div class="min-w-0 flex-1">
        <CmsWidgetArea :containers="page.containers" />
      </div>
    </div>
    <!-- Full-width layout: no sidebar -->
    <CmsWidgetArea
      v-else-if="page?.containers?.length"
      :containers="page.containers"
    />
    <div
      v-else-if="status === 'pending'"
      class="flex min-h-[50vh] items-center justify-center"
    >
      <div class="bg-muted size-8 animate-pulse rounded-full" />
    </div>
    <div
      v-else-if="error"
      class="text-muted-foreground flex min-h-[50vh] items-center justify-center"
    >
      <p>Unable to load page content.</p>
    </div>
  </div>
</template>
