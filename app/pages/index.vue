<script setup lang="ts">
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';

const { currentLocale, currentMarket } = useLocaleMarket();

// Resolve the frontpage CMS slot from tenant config. The slot is null
// when the tenant has not configured it; the empty-state branch below
// handles that case. See docs/patterns/cms-slots.md.
const frontpageSlot = useCmsSlot(CMS_SLOTS.FRONTPAGE_CONTENT);

const {
  data: area,
  error,
  status,
} = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    frontpageSlot.value
      ? {
          family: frontpageSlot.value.family,
          areaName: frontpageSlot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!frontpageSlot.value,
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
