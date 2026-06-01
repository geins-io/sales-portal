import {
  getPreviewCookie,
  getStoreSettingsPreviewCookie,
} from '../utils/cookies';

/**
 * CDN-ready cache headers for page routes.
 * Azure Front Door caches per-host via Vary header,
 * serves stale for 10min while revalidating.
 *
 * Preview requests (CMS preview or store-settings preview) must never be
 * cached at the CDN. Their HTML is rendered against unpublished overlays
 * that would otherwise leak to every other visitor sharing the host.
 */
export default defineEventHandler((event) => {
  const path = event.path || '';

  if (
    path.startsWith('/api/') ||
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt')
  ) {
    return;
  }

  const query = getQuery(event);
  const isPreview =
    query.preview === '1' ||
    getStoreSettingsPreviewCookie(event) ||
    getPreviewCookie(event);

  if (isPreview) {
    setHeader(event, 'Cache-Control', 'private, no-store');
    return;
  }

  setHeader(event, 'Vary', 'host, accept-encoding');
  setHeader(
    event,
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=600',
  );
});
