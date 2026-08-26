---
title: Navigation performance optimizations
status: accepted
created: 2026-02-16
updated: 2026-08-26
tags: [performance, navigation, caching]
---

# ADR-010: Navigation Performance Optimizations

## Context

Client-side navigation was slower than necessary due to sequential data fetching:

1. **Auth initialization was sequential** — `fetchUser()` only ran in middleware, after all plugins completed, so tenant loading and auth checks happened one after the other.
2. **No SSR caching for pages** — every request re-rendered from scratch, including pages whose output rarely changes.

A third problem, route resolution round-trips for dynamic `[...slug]` pages, was solved differently and is no longer relevant here. See ADR-015: type-prefixed URLs encode the content type in the path, so there is nothing to resolve ahead of time.

## Decision

### 1. Parallel auth initialization

A universal plugin (`app/plugins/auth-init.ts`) starts `fetchUser()` before middleware runs. Concurrent calls are deduplicated via a module-scoped promise, so middleware safely awaits the already-in-flight request.

The two runtimes differ deliberately:

- **Server** — awaits `fetchUser()`. SSR HTML must reflect the real auth state, so blocking here is the point.
- **Client** — fires without awaiting, so hydration is never blocked on the wire.

**Why module-scoped instead of Pinia state:** promises are not serializable and should not live in reactive state. A module-level variable is the standard pattern for in-flight request deduplication.

### 2. CDN cache headers for page routes

`server/middleware/cache-headers.ts` sets caching headers on page routes:

```
Vary: host, accept-encoding
Cache-Control: public, s-maxage=60, stale-while-revalidate=600
```

Azure Front Door caches per host and serves stale content for up to 10 minutes while revalidating in the background. `Vary: host` is what keeps tenants isolated — without it one tenant's HTML could be served to another.

Preview requests are excluded and sent `private, no-store`. Their HTML is rendered against unpublished overlays, which must never reach other visitors sharing the host.

**Why middleware instead of Nitro `routeRules`:** this started as `routeRules` with 5-minute SWR on a fixed list of paths (`/`, `/login`, `/portal`, `/portal/login`). That was replaced on 2026-02-17, the day after this ADR was written, because a static path list does not scale to tenant-specific routes, and because the caching decision needs request context — the preview check depends on a query parameter and a cookie, which `routeRules` cannot see.

## Consequences

**Good:**

- Auth check starts earlier on protected routes, running in parallel with tenant loading rather than after it.
- Page HTML is served from the CDN on repeat visits, with per-tenant isolation.
- Preview traffic is explicitly excluded from caching rather than relying on a path allowlist staying correct.

**Neutral:**

- Cached pages can be up to 60 seconds stale, and up to 10 minutes during background revalidation.
- Caching lives at the CDN layer, so it is invisible in local development.

**Bad:**

- The server-side `await` in auth init adds latency to SSR for the first request of a session. This is deliberate — correct HTML is worth more than a faster wrong one.
- Two places now influence page caching: this middleware and any per-handler `defineCachedEventHandler`. Neither is aware of the other.
