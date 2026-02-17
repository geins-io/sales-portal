/**
 * CDN-ready cache headers for page routes.
 * Azure Front Door caches per-host via Vary header,
 * serves stale for 10min while revalidating.
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

  setHeader(event, 'Vary', 'host, accept-encoding');
  setHeader(
    event,
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=600',
  );
});
