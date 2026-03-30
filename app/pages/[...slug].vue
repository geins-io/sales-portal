<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next';
import { useRouteResolution } from '~/composables/useRouteResolution';
import {
  normalizeSlugToPath,
  stripLocaleMarketPrefix,
} from '#shared/utils/locale-market';

const route = useRoute();

const normalizedPath = computed(() =>
  stripLocaleMarketPrefix(
    normalizeSlugToPath(route.params.slug as string | string[] | undefined),
  ),
);

const {
  data: resolution,
  pending,
  error,
} = await useRouteResolution(normalizedPath);

// Handle 404: throw on SSR, showError on client (avoids navigating to unprefixed /404)
if (resolution.value?.type === 'not-found') {
  if (import.meta.server) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      fatal: true,
    });
  } else {
    showError(createError({ statusCode: 404, statusMessage: 'Not Found' }));
  }
}

// SEO: canonical + hreflang tags based on current locale/market and available alternatives
const { currentMarket, currentLocale, validLocales, localePath } =
  useLocaleMarket();

/**
 * Map short locale codes to BCP-47 hreflang language tags.
 * For most locales the code is used as-is; this map exists
 * to override any that differ (currently none, but extensible).
 */
function getHreflangLang(locale: string): string {
  return locale;
}

const seoLinks = computed(() => {
  const market = currentMarket.value;
  const locale = currentLocale.value;
  const path = normalizedPath.value;
  const pagePath = path === '/' ? '/' : path;

  const links: Array<{ rel: string; href: string; hreflang?: string }> = [];

  // Canonical URL: always includes the locale/market prefix
  const canonicalHref =
    pagePath === '/'
      ? `/${market}/${locale}/`
      : `/${market}/${locale}${pagePath}`;
  links.push({ rel: 'canonical', href: canonicalHref });

  // Hreflang alternates for each available locale in this market
  const localeArray = Array.from(validLocales.value).filter(
    (l): l is string => typeof l === 'string',
  );
  for (const loc of localeArray) {
    const lang = getHreflangLang(loc);
    const hreflang = `${lang}-${market.toUpperCase()}`;
    const href =
      pagePath === '/' ? `/${market}/${loc}/` : `/${market}/${loc}${pagePath}`;
    links.push({ rel: 'alternate', href, hreflang });
  }

  // x-default: use 'en' if available, otherwise the first available locale
  const defaultLocale = validLocales.value.has('en')
    ? 'en'
    : (localeArray[0] ?? locale);
  const xDefaultHref =
    pagePath === '/'
      ? `/${market}/${defaultLocale}/`
      : `/${market}/${defaultLocale}${pagePath}`;
  links.push({ rel: 'alternate', href: xDefaultHref, hreflang: 'x-default' });

  return links;
});

useHead({ link: seoLinks });

// Handle resolution side effects on client-side navigation
watch(
  () => resolution.value,
  (res) => {
    if (res?.type === 'not-found') {
      showError(createError({ statusCode: 404, statusMessage: 'Not Found' }));
      return;
    }
  },
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
      :action-to="localePath('/')"
      data-testid="route-error"
    />

    <component
      :is="ResolvedComponent"
      v-else-if="ResolvedComponent && resolution"
      :key="normalizedPath"
      :resolution="resolution as any"
    />

    <div v-else>
      <!-- Fallback for unexpected states -->
      <p>{{ $t('common.unable_to_resolve_route') }}</p>
    </div>
  </div>
</template>
