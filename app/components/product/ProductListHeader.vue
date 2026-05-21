<script setup lang="ts">
import type { ListPageInfo } from '#shared/types/commerce';
import type { BreadcrumbItem } from '#shared/types/common';
import { categoryPath } from '#shared/utils/route-helpers';

const props = defineProps<{
  pageInfo: ListPageInfo | null;
  breadcrumbs: BreadcrumbItem[];
  resultCount?: number;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();

// CMS authors sometimes return primaryDescription wrapped in `<p>` tags
// (or other inline markup). Strip tags so we render plain text without
// the literal markup leaking into the page.
const description = computed(() => {
  const raw = props.pageInfo?.primaryDescription;
  if (!raw) return '';
  return raw.replace(/<[^>]*>/g, '').trim();
});
</script>

<template>
  <div v-if="pageInfo" class="space-y-6">
    <AppBreadcrumbs :items="breadcrumbs" />

    <!-- Figma: title 60/700 desktop, 48/700 mobile; description 18/400 -->
    <div class="space-y-6 py-4">
      <h1
        v-if="!pageInfo.hideTitle"
        class="font-heading text-5xl font-bold tracking-tight md:text-6xl"
      >
        {{ pageInfo.name }}
      </h1>
      <p
        v-if="!pageInfo.hideDescription && description"
        class="text-muted-foreground max-w-xl text-lg leading-relaxed"
      >
        {{ description }}
      </p>
      <p
        v-if="resultCount && resultCount > 0"
        class="text-muted-foreground text-sm"
        data-testid="result-count"
      >
        {{ t('product.result_count', { count: resultCount }) }}
      </p>
    </div>

    <!-- Sub-category chips -->
    <div v-if="pageInfo.subCategories?.length" class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="sub in pageInfo.subCategories"
        :key="sub.alias"
        :to="
          sub.canonicalUrl
            ? localePath(categoryPath(sub.canonicalUrl))
            : localePath(`/c/${sub.alias}`)
        "
        class="bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-sm transition-colors"
      >
        {{ sub.name }}
      </NuxtLink>
    </div>
  </div>
</template>
