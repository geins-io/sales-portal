<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next';
import {
  normalizeSlugToPath,
  useRouteResolution,
} from '~/composables/useRouteResolution';

const route = useRoute();

const normalizedPath = computed(() =>
  normalizeSlugToPath(route.params.slug as string | string[] | undefined),
);

const {
  data: resolution,
  pending,
  error,
} = await useRouteResolution(normalizedPath);

// Handle resolution side effects (404, canonical)
watch(
  () => resolution.value,
  (res) => {
    if (res?.type === 'not-found') {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    }
    if (res && 'canonical' in res && res.canonical) {
      useHead({
        link: [{ rel: 'canonical', href: res.canonical }],
      });
    }
  },
  { immediate: true },
);

// Cache async component definitions to avoid recreating on each render
const ProductListComponent = defineAsyncComponent(
  () => import('~/components/pages/ProductList.vue'),
);

const PageComponents = {
  product: defineAsyncComponent(
    () => import('~/components/pages/ProductDetails.vue'),
  ),
  category: ProductListComponent,
  brand: ProductListComponent,
  page: defineAsyncComponent(() => import('~/components/pages/Content.vue')),
} as const;

const ResolvedComponent = computed(() => {
  const type = resolution.value?.type;
  if (type && type in PageComponents) {
    return PageComponents[type as keyof typeof PageComponents];
  }
  return null;
});
</script>

<template>
  <div>
    <div
      v-if="pending"
      class="mx-auto max-w-7xl px-4 py-8 lg:px-8"
      data-testid="route-loading"
    >
      <div class="flex flex-col gap-4">
        <Skeleton class="h-8 w-1/3" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-5/6" />
        <Skeleton class="h-4 w-2/3" />
      </div>
    </div>

    <EmptyState
      v-else-if="error"
      :icon="AlertTriangleIcon"
      :title="$t('common.something_went_wrong')"
      :description="$t('common.unable_to_resolve_route')"
      action-label="Home"
      action-to="/"
      data-testid="route-error"
    />

    <component
      :is="ResolvedComponent"
      v-else-if="ResolvedComponent && resolution"
      :key="resolution.type"
      :resolution="resolution as any"
    />

    <div v-else>
      <!-- Fallback for unexpected states -->
      <p>{{ $t('common.unable_to_resolve_route') }}</p>
    </div>
  </div>
</template>
