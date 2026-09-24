import { getPreviewCookie } from '../utils/cookies';
import { getSessionToken } from '../utils/session';

/**
 * CDN-ready cache headers for page routes: per-host via Vary, stale for 10min
 * while revalidating. Exempt: non-page paths, preview, and any request with a
 * session token — its HTML carries the buyer's own data. See ADR-010.
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

  // Runs after 00.session, so a request it rotated already counts; an expired
  // one carries the cookie deletions.
  const expired = event.context.session?.status === 'expired';
  if (isPreview || expired || getSessionToken(event)) {
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
