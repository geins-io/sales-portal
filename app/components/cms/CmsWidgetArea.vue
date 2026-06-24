<script setup lang="ts">
import type { CmsContentContainer } from '#shared/types/cms';

defineProps<{
  containers: CmsContentContainer[];
  // Forwarded to each CmsContainer. When true, containers render without their
  // own max-width/horizontal padding so an outer wrapper controls the width.
  flush?: boolean;
}>();
</script>

<template>
  <div class="cms-widget-area space-y-8">
    <!--
      Each container renders inside its own error boundary so a widget that
      throws on a transient or partial upstream payload (for example a product
      list whose products are fetched client-side) degrades to nothing and the
      rest of the area still renders, instead of blanking the whole section.
      The boundary stops propagation, so the page-level boundary never trips.
    -->
    <ErrorBoundary
      v-for="container in containers"
      :key="container.id"
      :section="`cms-container-${container.id}`"
      silent
    >
      <CmsContainer :container="container" :flush="flush" />
    </ErrorBoundary>
  </div>
</template>
