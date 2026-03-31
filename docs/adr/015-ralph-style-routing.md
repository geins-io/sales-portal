---
title: Type-prefixed routing
status: accepted
created: 2026-03-30
tags: [routing, urls, seo]
---

# ADR-015: Type-prefixed routing

## Context

The sales portal previously used a server-side route resolution system to determine whether a URL path pointed to a product, category, brand, or CMS page. This involved:

1. A `/api/resolve-route` endpoint that queried the Geins API to classify each URL
2. A `server/services/routes.ts` service that maintained cached category and brand maps
3. A client-side `useRouteResolution` composable with its own LRU cache
4. A single `[...slug].vue` catch-all page that dispatched to the correct component

This approach had drawbacks:

- Every navigation required an extra API round-trip to classify the URL
- The route resolution service fetched all categories/brands to build lookup maps
- Cache invalidation was complex (tenant-aware, time-based TTLs)
- URLs were ambiguous without visual type indicators

A simpler approach uses URL type prefixes that encode the content type directly in the path.

## Decision

Adopt type-prefixed URLs:

| Prefix | Content Type      | Example                          |
| ------ | ----------------- | -------------------------------- |
| `/c/`  | Category PLP      | `/se/sv/c/material/epoxy`        |
| `/p/`  | Product PDP       | `/se/sv/p/material/product-name` |
| `/b/`  | Brand PLP         | `/se/sv/b/atlas-copco`           |
| `/s/`  | Search            | `/se/sv/s/search+query`          |
| `/dc/` | Discount Campaign | `/se/sv/dc/summer-sale`          |
| `/l/`  | Generic List      | `/se/sv/l/some-list`             |
| (none) | CMS Content       | `/se/sv/about-us`                |

Route path constants are defined in `shared/constants/route-paths.ts`. Link generation helpers in `shared/utils/route-helpers.ts` strip Geins market/locale prefixes from API canonical URLs and prepend the appropriate type prefix.

The `shared/utils/menu.ts` `stripGeinsPrefix` function maps Geins type indicators (`/l/` -> `/c/`, `/p/` -> `/p/`, `/b/` -> `/b/`) to our route prefixes, so all CMS menu links automatically use the new URL structure.

The `[...slug].vue` catch-all now handles only CMS content pages. Dedicated page files handle typed routes:

- `app/pages/c/[...category].vue`
- `app/pages/p/[...alias].vue`
- `app/pages/b/[...brand].vue`
- `app/pages/s/[query].vue`

## Consequences

**Positive:**

- No route resolution API calls needed - the URL prefix tells us the content type
- Faster navigation (eliminates the resolve-route round-trip)
- Simpler codebase (removed ~300 lines of route resolution infrastructure)
- URLs are self-describing and deterministic
- Category/brand maps no longer need to be fetched and cached

**Negative:**

- Old bookmarked URLs without type prefixes will 404 (backward compat redirects needed later)
- The Geins API returns canonical URLs without our type prefixes, so link generation must add them
- CMS menu items use Geins-style type indicators (`/l/` for categories) that differ from ours (`/c/`), requiring mapping in `stripGeinsPrefix`

**Removed:**

- `server/api/resolve-route.get.ts`
- `server/services/routes.ts`
- `app/composables/useRouteResolution.ts`
- `app/components/pages/Content.vue` (inlined into catch-all)
