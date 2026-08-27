---
title: CMS Caching Strategy
status: accepted
created: 2026-03-31
updated: 2026-08-27
tags: [caching, cms, performance]
---

# ADR-014: CMS Caching Strategy

## Context

The sales-portal is a multi-tenant, multi-locale storefront. CMS content (menus, content areas,
pages) varies by tenant, locale, and market. When a user switches locale or market, stale cached
content from the previous locale could be served if cache TTLs are too long.

We observed 5-minute LRU cache TTLs causing content mismatch after locale switches — English
content continuing to serve Swedish widgets for several minutes.

## Decision

Cache CMS content in-process with a short TTL, and keep CMS API responses out of shared caches
entirely.

### Layer 1: Server LRU cache (60 seconds)

- In-process `LRUCache` in `server/services/cms.ts`
- TTL: 60 seconds (`CACHE_TTL_MS = 60_000`)
- Cache keys include tenant hostname, locale, and market (`buildCachePrefix()`)
- Menus (`max: 200`), content areas (`max: 500`), resolved page links (`max: 300`)
- Pages are not cached (they may be personalized by customer type or preview mode)

### Layer 2: CMS API responses are private

CMS endpoints set `private, no-cache`, and `private, no-store` when a customer type is resolved.
No `Vary` header is set; `tests/server/api/cms/cms-cache-headers.test.ts` asserts its absence
deliberately.

Keeping CMS responses out of any shared cache means the locale/market dimension in the Layer 1
key is the only thing that has to be right. The `public, s-maxage=60` headers elsewhere in the
app apply to page HTML (ADR-010) and the product endpoints, not to CMS.

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
- CMS content is never served from a shared cache, so a cross-tenant or cross-locale mix-up at
  that layer is impossible by construction
- Preview mode bypasses all caching layers
- Keys are `hostname::locale::market::…`, so the key space grows multiplicatively with tenant
  count and a few hundred tenants would exceed the caps above. Whether that degrades the hit rate
  in practice is untested — the 60-second TTL limits the live working set to recently active
  tenants — so the caps are worth revisiting as tenant count grows
- These TTLs and caps are tuned by reasoning rather than by measured hit rate
- Tenant config caching is covered by ADR-009; page HTML by ADR-010. `/api/resolve-url` has its
  own SWR handler cache, which caches misses deliberately so a scanner cannot re-hammer Geins
