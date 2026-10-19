<script setup lang="ts">
import type {
  ButtonItem,
  ButtonsWidgetData,
  ContentConfigType,
} from '#shared/types/cms';
import { stripGeinsPrefix } from '#shared/utils/menu';

const props = defineProps<{
  data: ButtonsWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const { localePath } = useLocaleMarket();

// A button without a link would look clickable and lead nowhere, so it is left out.
const linkedButtons = computed(() =>
  (props.data.buttons ?? []).filter(
    (button): button is ButtonItem & { url: string } => !!button.url,
  ),
);
</script>

<template>
  <div v-if="linkedButtons.length" class="flex flex-wrap gap-3">
    <NuxtLink
      v-for="(button, index) in linkedButtons"
      :key="index"
      :to="localePath(stripGeinsPrefix(button.url))"
      class="bg-button-background text-primary-foreground rounded px-6 py-2 font-medium transition-opacity hover:opacity-90"
    >
      {{ button.buttonText }}
    </NuxtLink>
  </div>
</template>
