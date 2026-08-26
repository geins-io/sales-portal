---
title: Type-prefixed routing
status: accepted
created: 2026-03-30
updated: 2026-08-26
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

Adopt type-prefixed URLs where a single-letter (or two-letter) prefix after the `/{market}/{locale}/` segment identifies the content type:

| Prefix | Content Type      | Page File                       | Example                          |
| ------ | ----------------- | ------------------------------- | -------------------------------- |
| `/c/`  | Category PLP      | `app/pages/c/[...category].vue` | `/se/sv/c/material/epoxy`        |
| `/p/`  | Product PDP       | `app/pages/p/[...alias].vue`    | `/se/sv/p/material/product-name` |
| `/b/`  | Brand PLP         | `app/pages/b/[...brand].vue`    | `/se/sv/b/atlas-copco`           |
| `/s/`  | Search            | `app/pages/s/[query].vue`       | `/se/sv/s/search+query`          |
| `/dc/` | Discount Campaign | (future)                        | `/se/sv/dc/summer-sale`          |
| `/l/`  | Generic List      | (future)                        | `/se/sv/l/some-list`             |
| (none) | CMS Content       | `app/pages/[...slug].vue`       | `/se/sv/about-us`                |

### Route path constants

Defined in `shared/constants/route-paths.ts`:

```typescript
export const ROUTE_PATHS = {
  category: '/c',
  product: '/p',
  brand: '/b',
  list: '/l',
  search: '/s',
  discountCampaign: '/dc',
} as const;
```

### Link generation

The Geins API returns canonical URLs without type prefixes. Helper functions in `shared/utils/route-helpers.ts` strip the Geins market/locale prefix and prepend the correct type prefix:

- `categoryPath(canonicalUrl)` prepends `/c`
- `productPath(canonicalUrl)` prepends `/p`
- `brandPath(canonicalUrl)` prepends `/b`
- `searchPath(query)` prepends `/s`
- `discountCampaignPath(canonicalUrl)` prepends `/dc`

All generated paths must then be wrapped with `localePath()` to add the `/{market}/{locale}/` prefix.

### CMS menu mapping

The `shared/utils/menu.ts` `stripGeinsPrefix` function maps Geins type indicators (`/l/` for categories, `/p/` for products, `/b/` for brands) to our route prefixes. The `addCategoryPrefix()` utility detects category-type menu items (by children or type) and prepends `/c/` to normalized URLs.

### Alias extraction

Page files use `.pop()` on the catch-all params array to extract the entity alias (the last segment). Earlier segments represent the parent path and are available for breadcrumbs and SEO.

## Backward Compatibility

Old bare URLs without a type prefix still resolve — see _Update: 404-miss resolver_ below. Rather
than assuming `/c/`, the resolver looks the alias up against product, category and brand and
redirects to whichever matches.

## Consequences

**Positive:**

- No route resolution API calls needed. The URL prefix tells us the content type
- Faster navigation (eliminates the resolve-route round-trip)
- Simpler codebase (removed ~300 lines of route resolution infrastructure)
- URLs are self-describing and deterministic
- Category/brand maps no longer need to be fetched and cached
- Nested category paths work naturally (`/c/parent/child/grandchild`)
- Old bookmarked URLs are preserved via 301 redirects

**Negative:**

- The Geins API returns canonical URLs without our type prefixes, so link generation must add them
- CMS menu items use Geins-style type indicators (`/l/` for categories) that differ from ours (`/c/`), requiring mapping in `stripGeinsPrefix` and `addCategoryPrefix`

**Removed:**

- `server/api/resolve-route.get.ts`
- `server/services/routes.ts`
- `app/composables/useRouteResolution.ts`
- `app/components/pages/Content.vue` (inlined into catch-all)

## Update: 404-miss resolver (ADR-017)

[ADR-017](017-entity-url-safety-net.md) later added a narrow resolver that 301-redirects prefix-less entity URLs (stale bookmarks, shared links, search-engine results, pasted Geins canonicals, renamed slugs) to their typed route. This is not a revival of the per-navigation route resolver removed above. It runs only when the catch-all CMS lookup has already missed, as a 404 recovery step. In-app navigation still goes straight to a typed route with no resolution round-trip.
