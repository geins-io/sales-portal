<script setup lang="ts">
import type { ContentContainerType } from '#shared/types/cms';

defineProps<{
  containers: ContentContainerType[];
  // Forwarded to each CmsContainer. When true, containers render without their
  // own max-width/horizontal padding so an outer wrapper controls the width.
  flush?: boolean;
}>();
</script>

<template>
  <div class="cms-widget-area space-y-8">
    <CmsContainer
      v-for="container in containers"
      :key="container.id"
      :container="container"
      :flush="flush"
    />
  </div>
</template>
