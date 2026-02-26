<script setup lang="ts">
import type { ContentPageType } from '#shared/types/cms';
import type { PageRouteResolution } from '#shared/types/common';
import {
  FileText as FileTextIcon,
  FileWarning as FileWarningIcon,
} from 'lucide-vue-next';

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
    <!-- Loading skeleton -->
    <ContentPageSkeleton
      v-if="status === 'pending'"
      data-testid="content-loading"
    />

    <!-- Error state -->
    <EmptyState
      v-else-if="error"
      :icon="FileWarningIcon"
      :title="$t('common.something_went_wrong')"
      :description="$t('content.failed_to_load')"
      action-label="Home"
      action-to="/"
      data-testid="content-error"
    />

    <!-- Sidebar layout: page has a pageArea with navigation -->
    <div
      v-else-if="hasSidebar && page?.containers?.length"
      class="md:flex md:gap-8"
    >
      <ErrorBoundary section="sidebar-nav">
        <PageSidebarNav
          :menu-location-id="sidebarMenuId"
          class="mb-6 md:mb-0 md:w-64 md:shrink-0"
        />
      </ErrorBoundary>
      <div class="min-w-0 flex-1">
        <ErrorBoundary section="cms-content">
          <CmsWidgetArea :containers="page.containers" />
        </ErrorBoundary>
      </div>
    </div>

    <!-- Full-width layout: no sidebar -->
    <ErrorBoundary v-else-if="page?.containers?.length" section="cms-content">
      <CmsWidgetArea :containers="page.containers" />
    </ErrorBoundary>

    <!-- Empty content -->
    <EmptyState
      v-else
      :icon="FileTextIcon"
      :title="$t('content.no_content')"
      action-label="Home"
      action-to="/"
      data-testid="content-empty"
    />
  </div>
</template>
