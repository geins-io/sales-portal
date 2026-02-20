<script setup lang="ts">
import type { ContentContainerType } from '#shared/types/cms';

defineProps<{
  containers: ContentContainerType[];
}>();
</script>

<template>
  <div class="cms-widget-area space-y-8">
    <CmsContainer
      v-for="container in containers"
      :key="container.id"
      :container="container"
    />
  </div>
</template>
