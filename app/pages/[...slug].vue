<script setup lang="ts">
/**
 * CMS Content Catch-All Page
 *
 * Matches any URL not handled by type-prefixed routes (/c/, /p/, /b/, /s/)
 * or named pages (cart, checkout, login, etc.).
 *
 * This is always the LAST matched route due to Vue Router's catch-all priority.
 */
import { computed } from 'vue';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next';
import {
  normalizeSlugToPath,
  stripLocaleMarketPrefix,
} from '#shared/utils/locale-market';
import { hasPageTag } from '#shared/utils/cms-tags';
import {
  categoryPath,
  productPath,
  brandPath,
} from '#shared/utils/route-helpers';
import type { ContentPageType } from '#shared/types/cms';
import { CMS_MENUS, CMS_TAGS } from '#shared/constants/cms';

const route = useRoute();

const normalizedPath = computed(() =>
  stripLocaleMarketPrefix(
    normalizeSlugToPath(route.params.slug as string | string[] | undefined),
  ),
);

// Extract the page slug (last segment of the path)
const pageSlug = computed(() => {
  const path = normalizedPath.value;
  if (path === '/') return '/';
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '/';
});

const { localePath, localeQuery } = useLocaleMarket();

const {
  data: page,
  error,
  status,
} = await useFetch<ContentPageType>(() => `/api/cms/page/${pageSlug.value}`, {
  query: localeQuery,
  dedupe: 'defer',
});

/** Maps a resolver entity `type` to its locale-free type-prefixed path builder. */
const pathBuilders = {
  product: productPath,
  category: categoryPath,
  brand: brandPath,
} as const;

type ResolvedEntityUrl =
  | { type: keyof typeof pathBuilders; canonicalUrl: string }
  | { redirect: string }
  | null;

function throwNotFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    fatal: true,
  });
}

/**
 * Normalize a `urlHistory` redirect target (a renamed slug) to a routable,
 * locale-prefixed path. The history record carries a bare url with no entity
 * type, so we only re-apply the current locale prefix; a renamed slug is a
 * different path than the current one, so this cannot loop. Returns null when
 * the target would equal the current path (defensive against a self-referential
 * history record), forcing a 404.
 */
function normalizeRedirect(newUrl: string): string | null {
  const target = localePath(stripLocaleMarketPrefix(newUrl));
  return target && target !== route.path ? target : null;
}

// Propagate HTTP 404 when the CMS page doesn't exist, but first run the inbound
// resolver: a prefix-less entity canonical (pasted Geins url, stale bookmark) or
// a renamed slug should 301-redirect to its typed route instead of 404ing. The
// resolver fetch is gated behind the CMS miss so CMS hits never trigger it.
const cmsMissed =
  Boolean(error.value) ||
  (!page.value?.id && !page.value?.containers?.length);

if (cmsMissed) {
  // useFetch auto-forwards cookie + host for page-level loads, so the resolver
  // sees the same tenant/auth context during SSR (see app/utils/internal-fetch.ts).
  const { data: resolved, error: resolveError } =
    await useFetch<ResolvedEntityUrl>('/api/resolve-url', {
      query: { path: route.path },
      dedupe: 'defer',
    });

  const r = resolveError.value ? null : resolved.value;

  if (r && 'type' in r && r.canonicalUrl) {
    const build = pathBuilders[r.type];
    const target = localePath(build(r.canonicalUrl));
    if (target !== route.path) {
      // SSR-safe: navigateTo with redirectCode works in setup during SSR
      // (proven by app/pages/search.vue). No client-only guard.
      await navigateTo(target, { redirectCode: 301, replace: true });
    } else {
      throwNotFound();
    }
  } else if (r && 'redirect' in r && r.redirect) {
    const target = normalizeRedirect(r.redirect);
    if (target) {
      await navigateTo(target, { redirectCode: 301, replace: true });
    } else {
      throwNotFound();
    }
  } else {
    throwNotFound();
  }
}

// SEO: canonical + hreflang tags
const { seoLinks } = useSeoLinks(normalizedPath);

useSeoMeta({
  ogUrl: () => seoLinks.value.find((l) => l.rel === 'canonical')?.href ?? '',
});

// Page head meta from CMS
useHead(
  computed(() => {
    if (!page.value) return {};
    return {
      title: page.value.meta?.title || page.value.title || '',
      meta: [
        ...(page.value.meta?.description
          ? [{ name: 'description', content: page.value.meta.description }]
          : []),
      ],
    };
  }),
);

// Pages tagged with `CMS_TAGS.SIDEBAR_MENU` render the
// `CMS_MENUS.SIDEBAR_FALLBACK` menu as a sidebar nav. Geins serializes
// admin tags as `#menu` so the inline tag check has to go through
// `hasPageTag` to normalize the prefix; see `shared/utils/cms-tags.ts`.
const sidebarFallbackMenu = useCmsMenu(CMS_MENUS.SIDEBAR_FALLBACK);
const hasSidebar = computed(() =>
  hasPageTag(page.value, CMS_TAGS.SIDEBAR_MENU),
);
const sidebarMenuId = computed<string | null>(
  () => sidebarFallbackMenu.value?.menuLocationId ?? null,
);
</script>

<template>
  <div>
    <!-- Loading skeleton -->
    <div
      v-if="status === 'pending'"
      class="mx-auto max-w-7xl px-4 py-8 lg:px-6"
      data-testid="route-loading"
    >
      <div class="flex flex-col gap-4">
        <Skeleton class="h-8 w-1/3" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-5/6" />
        <Skeleton class="h-4 w-2/3" />
      </div>
    </div>

    <!-- Error state -->
    <EmptyState
      v-else-if="error"
      :icon="AlertTriangleIcon"
      :title="$t('common.something_went_wrong')"
      :description="$t('common.unable_to_resolve_route')"
      action-label="Home"
      :action-to="localePath('/')"
      data-testid="route-error"
    />

    <!-- Sidebar layout: page tagged with 'menu' in CMS -->
    <div
      v-else-if="hasSidebar && page?.containers?.length"
      class="mx-auto max-w-7xl px-4 py-8 lg:px-6"
    >
      <div class="md:flex md:gap-8">
        <ErrorBoundary v-if="sidebarMenuId" section="sidebar-nav">
          <PageSidebarNav
            :menu-location-id="sidebarMenuId"
            class="mb-6 md:mb-0 md:w-56 md:shrink-0"
          />
        </ErrorBoundary>
        <div class="min-w-0 flex-1">
          <ErrorBoundary section="cms-content">
            <CmsWidgetArea :containers="page.containers" />
          </ErrorBoundary>
        </div>
      </div>
    </div>

    <!-- Full-width layout: no sidebar -->
    <div
      v-else-if="page?.containers?.length"
      class="mx-auto max-w-7xl px-4 py-8 lg:px-6"
    >
      <ErrorBoundary section="cms-content">
        <CmsWidgetArea :containers="page.containers" />
      </ErrorBoundary>
    </div>

    <!-- Empty / 404 -->
    <div v-else>
      <p>{{ $t('common.unable_to_resolve_route') }}</p>
    </div>
  </div>
</template>
