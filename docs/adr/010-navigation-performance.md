---
title: Navigation performance optimizations
status: accepted
created: 2026-02-16
tags: [performance, navigation, caching]
---

# ADR-010: Navigation Performance Optimizations

## Context

Client-side navigation was slower than necessary due to sequential data fetching:

1. **Auth initialization was sequential** — `fetchUser()` only ran in middleware (after all plugins completed), meaning tenant loading and auth checks happened one after the other
2. **No route prefetching** — navigating to dynamic `[...slug]` pages always waited for a `/api/resolve-route` API round-trip
3. **No SSR caching for static pages** — pages with no data fetching (`/`, `/login`, `/portal`, `/portal/login`) were fully re-rendered on every request

## Decision

### 1. Parallel auth initialization

Add a client-only plugin (`auth-init.client.ts`) that fires `fetchUser()` early without awaiting. Deduplicate concurrent `fetchUser()` calls via a module-scoped promise so middleware safely awaits the already-in-flight request.

**Why module-scoped instead of Pinia state:** Promises are not serializable and should not be in reactive state. A module-level variable is the standard pattern for in-flight request deduplication.

### 2. Client-side route resolution cache with prefetch

Add a `Map<string, RouteResolution>` cache to `useRouteResolution` and export a `prefetchRouteResolution(path)` function. Components call it on link hover or intersection to pre-warm the cache.

**Why a plain Map instead of LRU:** Client sessions visit a limited number of routes. Memory pressure is negligible. The server already has an LRU cache (1000 entries, 5-min TTL) for its side.

### 3. SWR route rules for static pages

Add `routeRules` in `nuxt.config.ts` with 5-minute SWR for static pages. Nitro serves the stale HTML immediately and revalidates in the background. Cache key includes the host, providing multi-tenant isolation.

## Consequences

**Good:**

- Auth check starts ~50-150ms earlier on protected routes (parallel with tenant loading)
- Dynamic page navigation is near-instant after hover prefetch
- Static pages serve from SWR cache on repeat visits (sub-millisecond response)

**Neutral:**

- Client-side route cache lives for the SPA session (cleared on full reload)
- SWR means static pages can show up to 5-minute-stale content (acceptable for these pages)

**Bad:**

- Module-scoped `_fetchPromise` in auth store requires care in tests (must account for shared state between test runs — cleared via `finally` block)
- Route cache is not invalidated on CMS content changes (acceptable since route _types_ rarely change; content is fetched separately)
