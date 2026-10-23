<script setup lang="ts">
import type { ButtonsWidgetData, ContentConfigType } from '#shared/types/cms';
import { normalizeMenuUrl } from '#shared/utils/menu';

const props = defineProps<{
  data: ButtonsWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const { localePath } = useLocaleMarket();
const currentHost = useRequestURL().host;

// normalizeMenuUrl gives '' for a missing url and for an unsafe scheme. Such a
// button would look clickable and lead nowhere, so it is left out.
const linkedButtons = computed(() =>
  (props.data.buttons ?? []).flatMap((button) => {
    const path = normalizeMenuUrl(button.url, currentHost);
    return path ? [{ text: button.buttonText, to: localePath(path) }] : [];
  }),
);
</script>

<template>
  <div v-if="linkedButtons.length" class="flex flex-wrap gap-3">
    <NuxtLink
      v-for="(button, index) in linkedButtons"
      :key="index"
      :to="button.to"
      class="bg-button-background text-button-text rounded px-6 py-2 font-medium transition-opacity hover:opacity-90"
    >
      {{ button.text }}
    </NuxtLink>
  </div>
</template>
