<script setup lang="ts">
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';

const { t } = useI18n();
const { currentLocale, currentMarket } = useLocaleMarket();
const { hasFeature } = useTenant();

if (!hasFeature('applyForAccount')) {
  throw createError({ statusCode: 404, fatal: true });
}

const applySlot = useCmsSlot(CMS_SLOTS.APPLY_FOR_ACCOUNT);

const { data: applyCmsArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    applySlot.value
      ? {
          family: applySlot.value.family,
          areaName: applySlot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!applySlot.value,
  dedupe: 'defer',
  lazy: true,
});

useHead({
  title: computed(() => t('apply.title')),
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pt-8 pb-12 lg:px-6">
    <div class="border-border rounded-lg border p-6 md:p-8">
      <CmsWidgetArea
        v-if="applyCmsArea?.containers?.length"
        :containers="applyCmsArea.containers"
      />
      <ApplyForAccountForm />
    </div>
  </div>
</template>
