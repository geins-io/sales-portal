<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
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
const PageComponents = {
  product: defineAsyncComponent(
    () => import('~/components/pages/ProductDetails.vue'),
  ),
  category: defineAsyncComponent(
    () => import('~/components/pages/ProductList.vue'),
  ),
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
    <div v-if="pending">{{ $t('common.loading') }}</div>

    <div v-else-if="error">
      <!-- Keep this minimal; Nuxt error boundary will handle thrown errors -->
      <p>{{ $t('common.something_went_wrong') }}</p>
    </div>

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
