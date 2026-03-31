<script setup lang="ts">
import type { ContentAreaType } from '#shared/types/cms';

const { currentLocale, currentMarket } = useLocaleMarket();

const {
  data: area,
  error,
  status,
} = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() => ({
    family: 'Frontpage',
    areaName: 'Content',
    ...(currentLocale.value ? { locale: currentLocale.value } : {}),
    ...(currentMarket.value ? { market: currentMarket.value } : {}),
  })),
  dedupe: 'defer',
});
</script>

<template>
  <div>
    <CmsWidgetArea
      v-if="area?.containers?.length"
      :containers="area.containers"
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
