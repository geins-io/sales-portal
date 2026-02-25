<script setup lang="ts">
import type { ListPageInfo } from '#shared/types/commerce';
import type { BreadcrumbItem } from '#shared/types/common';

defineProps<{
  pageInfo: ListPageInfo | null;
  breadcrumbs: BreadcrumbItem[];
}>();
</script>

<template>
  <div v-if="pageInfo" class="space-y-4">
    <AppBreadcrumbs :items="breadcrumbs" />

    <div>
      <h1
        v-if="!pageInfo.hideTitle"
        class="font-heading text-2xl font-bold tracking-tight"
      >
        {{ pageInfo.name }}
      </h1>
      <p
        v-if="!pageInfo.hideDescription && pageInfo.primaryDescription"
        class="text-muted-foreground mt-2 text-sm"
      >
        {{ pageInfo.primaryDescription }}
      </p>
    </div>

    <!-- Sub-category chips -->
    <div v-if="pageInfo.subCategories?.length" class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="sub in pageInfo.subCategories"
        :key="sub.alias"
        :to="sub.canonicalUrl || `/${sub.alias}`"
        class="bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-sm transition-colors"
      >
        {{ sub.name }}
      </NuxtLink>
    </div>
  </div>
</template>
