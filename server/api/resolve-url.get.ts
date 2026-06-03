import { ResolveUrlSchema } from '../schemas/api-input';
import { resolveEntityUrl } from '../services/url-resolver';

/**
 * Inbound URL resolver endpoint: the 404-miss safety net.
 *
 * Caching behaviour:
 *  - Wrapped in `defineCachedEventHandler` with SWR (stale-while-revalidate).
 *  - Cache key: `{host}::{normalizedPath}` where host is tenant-specific so two
 *    tenants sharing a path never collide. Security note: URL->canonical mapping
 *    is auth-independent (the same URL resolves to the same canonical for all
 *    users), so keying on host+path (not auth token) is safe.
 *  - Trailing-slash policy: the path is lower-cased and trailing slashes are
 *    stripped so `/Se/Sv/Grenror/` and `/se/sv/grenror` share one cache entry.
 *
 * Negative caching:
 *  - When the resolver returns null (no entity found), the handler RETURNS a
 *    `{ notFound: true }` marker instead of throwing. This lets Nitro cache the
 *    miss with the same SWR TTL so a scanner cannot re-hammer Geins on every
 *    request for a missing path. The thin outer wrapper (outside the cache
 *    boundary) converts the marker to a real 404 for callers.
 *  - A thrown error is NOT cached by Nitro; a returned marker IS.
 *
 * Return shape: `{ type, canonicalAppPath }` | `{ redirect }`.
 *  - canonicalAppPath is the full app path WITH /{market}/{locale}/ and the
 *    correct /p/ /c/ /b/ prefix, built by url-resolver via alternateEntityPath.
 *    Callers do not re-normalize.
 *  - redirect is the raw urlHistory newUrl (renamed slug); page callers pass it
 *    through localePath to resolve the locale.
 *
 * SSR self-fetch notes:
 *  - Page-level callers (useFetch in Vue components) automatically forward the
 *    Host and cookie headers, so tenant resolution works correctly.
 *  - Non-page server callers (e.g. event handlers, middleware) must explicitly
 *    forward headers: pass `useRequestHeaders(['cookie', 'host'])` to $fetch or
 *    useFetch. Omitting the Host header breaks tenant resolution silently.
 *
 * The `path` query param is the normalized prefix-less inbound path; the alias
 * is its last non-empty segment.
 *
 * withErrorHandling/404-surfacing runs OUTSIDE the cache boundary on purpose
 * (unlike server/api/config.get.ts): a thrown error is not cached by Nitro, so
 * placing it inside the cached handler would defeat negative-cache entirely.
 */

type ResolverCacheResult =
  | { type: 'product' | 'category' | 'brand'; canonicalAppPath: string }
  | { redirect: string }
  | { notFound: true };

/**
 * Derive the request host for cache key construction.
 * server/plugins/02.tenant-context.ts already 400s on an empty host before
 * this handler runs, so no additional fallback is needed here.
 */
function getResolverHost(event: Parameters<typeof getRequestHost>[0]): string {
  return getRequestHost(event);
}

/**
 * Cached inner handler. Returns a cacheable marker on miss instead of throwing
 * so Nitro stores the negative result for the SWR TTL. A thrown error is NOT
 * cached and would re-hammer Geins on every scan request.
 */
const cachedResolver = defineCachedEventHandler(
  async (event): Promise<ResolverCacheResult> => {
    const { path } = ResolveUrlSchema.parse(getQuery(event));
    const auth = await optionalAuth(event);

    const segments = path.split('/').filter(Boolean);
    const alias = segments[segments.length - 1] ?? '';

    const result = await resolveEntityUrl(
      { path, alias, userToken: auth?.authToken },
      event,
    );

    if (!result) {
      // Negative-cache: return the marker so Nitro caches the miss. Do NOT
      // throw here; a throw is not cached and re-hammers Geins on every request.
      return { notFound: true as const };
    }

    return result;
  },
  {
    swr: true,
    // Short freshness: SWR serves stale + revalidates in background. 60 s
    // absorbs crawler bursts while ensuring a newly published entity resolves
    // within a minute.
    maxAge: 60,
    // staleMaxAge bounds the in-memory negative-cache entry lifetime so a path
    // scanner cannot grow the heap unbounded with entries that never revalidate.
    staleMaxAge: 300,
    getKey: (event) => {
      // Parse path from the query so normalization matches what the handler sees.
      const query = getQuery(event);
      const rawPath = typeof query.path === 'string' ? query.path : '';
      // Normalize: lower-case + strip trailing slash so /Se/Sv/Foo/ and
      // /se/sv/foo share a single cache entry. "Strip trailing slash" is the
      // canonical form (Nuxt routes never have trailing slashes by default).
      const normalizedPath = rawPath.toLowerCase().replace(/\/+$/, '');
      // Include host in the key for tenant isolation: two tenants sharing the
      // same path must not share a cache entry (different canonical targets).
      const host = getResolverHost(event);
      return `${host}::${normalizedPath}`;
    },
  },
);

/**
 * Outer handler: surfaces the notFound marker as a real 404 to callers.
 * This thin layer runs OUTSIDE the cache boundary so the 404 is always
 * raised, while the marker itself remains cached by Nitro for the SWR TTL.
 */
export default defineEventHandler(async (event) => {
  return withErrorHandling(
    async () => {
      const result = await cachedResolver(event);
      if ('notFound' in result) {
        throw createAppError(ErrorCode.NOT_FOUND, 'No entity for URL');
      }
      return result;
    },
    { operation: 'resolve-url.get' },
  );
});
