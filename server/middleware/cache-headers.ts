import { getPreviewCookie } from '../utils/cookies';

/**
 * CDN-ready cache headers for page routes.
 * Azure Front Door caches per-host via Vary header,
 * serves stale for 10min while revalidating.
 *
 * Preview requests must never be cached at the CDN. Their HTML is rendered
 * against unpublished overlays that would otherwise leak to every other
 * visitor sharing the host. Store-settings preview is driven purely by
 * ?preview=1 (never a cookie); CMS preview still uses the preview_mode cookie.
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
  const isPreview = query.preview === '1' || getPreviewCookie(event);

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
