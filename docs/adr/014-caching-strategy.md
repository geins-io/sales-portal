# ADR-014: CMS Caching Strategy

## Status

Accepted

## Context

The sales-portal is a multi-tenant, multi-locale storefront. CMS content (menus, content areas,
pages) varies by tenant, locale, and market. When a user switches locale or market, stale cached
content from the previous locale could be served if cache TTLs are too long.

We observed 5-minute LRU and HTTP cache TTLs causing content mismatch after locale switches.
The CDN and browser would serve Swedish content for several minutes after switching to English.

## Decision

Adopt a 3-layer caching strategy with short TTLs optimised for multi-locale correctness:

### Layer 1: Server LRU Cache (60 seconds)

- In-process `LRUCache` in `server/services/cms.ts`
- TTL: 60 seconds (`CACHE_TTL_MS = 60_000`)
- Cache keys include tenant hostname, locale, and market (`buildCachePrefix()`)
- Applies to menu and content area responses
- Pages are not cached (they may be personalized by customer type or preview mode)

### Layer 2: HTTP Cache-Control (60 seconds + SWR)

- `s-maxage=60, stale-while-revalidate=120` on public CMS endpoints
- CDN serves stale content for up to 120 seconds while revalidating in background
- Personalized responses (`customerType` set) use `private, no-store`
- `Vary: cookie` ensures locale/market cookie changes bust the CDN cache

### Layer 3: Client-Side useFetch (locale-aware)

- Client-side `useFetch` calls include locale/market in the URL or query parameters
- When locale changes, the URL changes, triggering a fresh fetch
- `dedupe: 'defer'` prevents duplicate in-flight requests

### Locale Switch Behaviour

A full page reload occurs on locale/market switch (handled by the locale middleware). This
naturally clears all client-side cache. The server LRU cache is keyed by locale, so the new
locale hits a different cache entry.

## Consequences

- Content updates propagate within 60 seconds (down from 5 minutes)
- Slightly higher origin load due to shorter cache windows
- Multi-locale content is consistent: no stale cross-locale content after switching
- Personalized content (customer type) is never cached at the HTTP layer
- Preview mode bypasses all caching layers
