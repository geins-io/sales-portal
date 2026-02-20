<script setup lang="ts">
import type { ButtonsWidgetData, ContentConfigType } from '#shared/types/cms';

defineProps<{
  data: ButtonsWidgetData;
  config: ContentConfigType;
  layout: string;
}>();
</script>

<template>
  <div v-if="data.buttons?.length" class="flex flex-wrap gap-3">
    <NuxtLink
      v-for="(button, index) in data.buttons"
      :key="index"
      :to="button.href"
      class="bg-primary text-primary-foreground rounded px-6 py-2 font-medium transition-opacity hover:opacity-90"
    >
      {{ button.text }}
    </NuxtLink>
  </div>
</template>
