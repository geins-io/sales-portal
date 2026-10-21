<script setup lang="ts">
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { cmsAreaRendersH1 } from '#shared/utils/cms-heading';
import { resolveDefaultTitle } from '#shared/utils/seo-title';

const { t } = useI18n();
const { tenant, brandName } = useTenant();
const { currentLocale, currentMarket } = useLocaleMarket();

// Resolve the frontpage CMS slot from tenant config. The slot is null
// when the tenant has not configured it; the empty-state branch below
// handles that case. See docs/patterns/cms-slots.md.
const frontpageSlot = useCmsSlot(CMS_SLOTS.FRONTPAGE_CONTENT);

// Note: `error` is intentionally not destructured. The FrontpageFallback
// v-else handles both the unconfigured-slot case and the fetch-error
// case uniformly — we don't branch on error state separately.
const { data: area, status } = useFetch<ContentAreaType>('/api/cms/area', {
  retry: 0,
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

// The fallback brings its own h1, and so can a CMS text or HTML widget; the
// page adds one only when neither does, so it never adds a second.
const showPageHeading = computed(() =>
  area.value?.containers?.length
    ? !cmsAreaRendersH1(area.value.containers)
    : status.value === 'pending',
);
const pageHeading = computed(
  () =>
    resolveDefaultTitle(tenant.value?.seo, brandName.value) ||
    t('frontpage.fallback.welcome'),
);

// SEO: canonical + hreflang tags. The locale root needs no per-locale slug
// overrides — /{market}/{locale}/ is the real path in every locale.
useSeoLinks('/');
</script>

<template>
  <div>
    <h1 v-if="showPageHeading" class="sr-only">{{ pageHeading }}</h1>
    <CmsWidgetArea
      v-if="area?.containers?.length"
      :containers="area.containers"
      priority
    />
    <div
      v-else-if="status === 'pending'"
      class="flex min-h-[50vh] items-center justify-center"
    >
      <div class="bg-muted size-8 animate-pulse rounded-full" />
    </div>
    <!--
      Fallback is rendered when:
        - the tenant has no FRONTPAGE_CONTENT slot configured, OR
        - the slot resolves but the area has no containers, OR
        - the /api/cms/area fetch errors out.
      A blank `<div>` on the storefront landing page is a blocker for
      tenants that haven't wired CMS yet — never ship empty here.
    -->
    <FrontpageFallback v-else />
  </div>
</template>
