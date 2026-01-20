<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { RouteResolution } from '#shared/types';

const route = useRoute();

const normalizedPath = computed(() => {
  const param = route.params.slug as string | string[] | undefined;
  const parts = Array.isArray(param) ? param : param ? [param] : [];
  const clean = parts.filter((p) => typeof p === 'string' && p.length > 0);

  // "/" should not happen for a catch-all unless you have custom routing, but keep it robust.
  if (clean.length === 0) return '/';

  // Ensure leading slash and no trailing slash
  return `/${clean.join('/')}`;
});

const {
  data: resolution,
  pending,
  error,
} = await useAsyncData<RouteResolution>(
  () => `route-resolution:${normalizedPath.value}`,
  () => $fetch('/api/resolve-route', { query: { path: normalizedPath.value } }),
  { watch: [normalizedPath] },
);

// Throw SSR 404 if resolver says not-found
watchEffect(() => {
  if (resolution.value?.type === 'not-found') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
});

// Optional canonical support if your resolver returns it
watchEffect(() => {
  const canonical =
    resolution.value && 'canonical' in resolution.value
      ? resolution.value.canonical
      : undefined;
  if (canonical) {
    useHead({
      link: [{ rel: 'canonical', href: canonical }],
    });
  }
});

const ResolvedComponent = computed(() => {
  switch (resolution.value?.type) {
    case 'product':
      return defineAsyncComponent(
        () => import('~/components/pages/ProductDetails.vue'),
      );
    case 'category':
      return defineAsyncComponent(
        () => import('~/components/pages/ProductList.vue'),
      );
    case 'page':
      return defineAsyncComponent(
        () => import('~/components/pages/Content.vue'),
      );
    default:
      return null;
  }
});
</script>

<template>
  <div>
    <div v-if="pending">Loading...</div>

    <div v-else-if="error">
      <!-- Keep this minimal; Nuxt error boundary will handle thrown errors -->
      <p>Something went wrong.</p>
    </div>

    <component
      :is="ResolvedComponent"
      v-else-if="ResolvedComponent && resolution"
      :resolution="resolution"
    />

    <div v-else>
      <!-- Fallback for unexpected states -->
      <p>Unable to resolve route.</p>
    </div>
  </div>
</template>
