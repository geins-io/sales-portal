<script setup lang="ts">
/**
 * Product route (PDP)
 *
 * Matches: /{market}/{locale}/p/{...alias}
 * The last segment of the catch-all is the product alias. Earlier segments are
 * the category path and are deliberately NOT read: the 301 to the canonical is
 * skipped when the canonical crosses locales, so they can be stale.
 * Breadcrumbs come from the product's own canonicalUrl instead, resolved in
 * /api/products/[alias].
 *
 * No resolve-route API call needed — the /p/ prefix tells us it's a product.
 *
 * The route loads the product once and owns everything about the URL — the 301
 * to the canonical, the recovery of a renamed slug. What renders it is chosen
 * from the product's type: every product type has its own page component, and
 * a third type is one more branch here, never a condition inside a page.
 */
import type { DetailProduct } from '#shared/types/commerce';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next';
import { productPath as buildProductPath } from '#shared/utils/route-helpers';
import { recoverEntityUrl } from '~/composables/useEntityUrlRecovery';

const route = useRoute();

const productAlias = computed(() => {
  const raw = route.params.alias;
  const segments = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '');
});

const { localeQuery, localePath } = useLocaleMarket();

const {
  data: product,
  error,
  status,
} = await useFetch<DetailProduct>(() => `/api/products/${productAlias.value}`, {
  query: localeQuery,
  dedupe: 'defer',
});

// On a content miss (missing product or fetch error) the old slug may be a
// renamed/old product that should 301 to its canonical instead of 404ing
// (Problem B). recoverEntityUrl consults the resolver, 301s to the canonical
// (or a urlHistory redirect), and throws a fatal 404 only on a terminal miss.
// Kept in the setup await position so the redirect/404 carries a real SSR
// status before render. Without this, crawlers would index phantom URLs.
if (error.value || !product.value?.productId) {
  await recoverEntityUrl(route.path);
}

const isLoading = computed(() => status.value === 'pending');

// When the loaded product's canonicalUrl differs from the URL the user is
// on, issue a real 301 to the canonical. Geins returns prefix-less
// canonicals (e.g. /se/sv/material/grenror/grenror-150-150-88) that 404 on
// refresh, so we normalize the canonical to the ROUTABLE /p/ form via the
// route helper rather than redirecting to the raw value. navigateTo is
// SSR-safe and crawler-grade (a single clean render at the final URL with no
// hydration risk), so this replaces the former client-only
// history.replaceState. Only fires when the canonical stays in the same
// /market/locale/ prefix; a fallback that crossed locales (server served
// default-language content on a missing-translation request) must not yank the
// user back out of the locale they asked for, so samePrefix is checked on the
// RAW canonical before normalizing. No-op when the routable target equals the
// current path (loop guard).
{
  const canonical = product.value?.canonicalUrl;
  const path = route.path;
  if (
    canonical &&
    typeof canonical === 'string' &&
    samePrefix(canonical, path)
  ) {
    const routable = localePath(buildProductPath(canonical));
    if (routable !== path) {
      await navigateTo(routable, { redirectCode: 301, replace: true });
    }
  }
}

// Returns true when both paths share the same /market/locale/ prefix, or
// when either is too short to have one. Used to suppress the canonical 301
// when a locale fallback returned a canonicalUrl in a different locale.
function samePrefix(a: string, b: string): boolean {
  const aSeg = a.split('/').slice(1, 3);
  const bSeg = b.split('/').slice(1, 3);
  if (aSeg.length < 2 || bSeg.length < 2) return true;
  return aSeg[0] === bSeg[0] && aSeg[1] === bSeg[1];
}

const { canAccess } = useFeatureAccess();

// A computed, not a value settled during setup: `canAccess` reads the auth
// store, which `plugins/auth-init.ts` has resolved before this page renders on
// the server and keeps resolving on the client. A buyer who signs in moves the
// page to the configurator without a reload.
const pageType = computed(() =>
  resolveProductPageType(product.value, canAccess('configurator')),
);
</script>

<template>
  <ProductDetailsSkeleton
    v-if="isLoading && !product"
    data-testid="pdp-loading"
  />

  <EmptyState
    v-else-if="error"
    :icon="AlertTriangleIcon"
    :title="$t('product.failed_to_load')"
    :description="$t('common.something_went_wrong')"
    action-label="Home"
    :action-to="localePath('/')"
    data-testid="pdp-error"
  />

  <ConfiguratorProduct
    v-else-if="product && pageType === 'configurable'"
    :product="product"
    :alias="productAlias"
  />

  <ProductDetails
    v-else-if="product"
    :product="product"
    :alias="productAlias"
  />
</template>
