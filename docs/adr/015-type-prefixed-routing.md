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

- `categoryPath(canonicalUrl)` — prepends `/c`
- `productPath(canonicalUrl)` — prepends `/p`
- `brandPath(canonicalUrl)` — prepends `/b`
- `searchPath(query)` — prepends `/s`
- `discountCampaignPath(canonicalUrl)` — prepends `/dc`

All generated paths must then be wrapped with `localePath()` to add the `/{market}/{locale}/` prefix.

### CMS menu mapping

The `shared/utils/menu.ts` `stripGeinsPrefix` function maps Geins type indicators (`/l/` for categories, `/p/` for products, `/b/` for brands) to our route prefixes. The `addCategoryPrefix()` utility detects category-type menu items (by children or type) and prepends `/c/` to normalized URLs.

### Alias extraction

Page files use `.pop()` on the catch-all params array to extract the entity alias (the last segment). Earlier segments represent the parent path and are available for breadcrumbs and SEO.

## Backward Compatibility

A server middleware (`server/middleware/legacy-route-redirect.ts`) provides 301 redirects for old bare URLs:

- `/se/sv/material` redirects to `/se/sv/c/material`
- `/se/sv/material/epoxy` redirects to `/se/sv/c/material/epoxy`
- `/se/sv/material/epoxy/product-name` redirects to `/se/sv/c/material/epoxy/product-name`

The middleware skips:

- Non-GET requests
- API and Nuxt internal paths (`/api/`, `/_nuxt/`, `/__nuxt`)
- Paths that already have a type prefix (`/c/`, `/p/`, `/b/`, `/l/`, `/s/`, `/dc/`)
- Known static routes (cart, checkout, login, portal, etc.)
- The homepage (no path after market/locale)

Unknown bare paths default to `/c/` because the catch-all `[...slug].vue` handles CMS pages (which have no prefix), and CMS pages are served by their slug. If a `/c/` redirect results in a 404, the old URL was invalid. Products that came through old bare URLs will also redirect to `/c/` — the correct product URL is `/p/`.

## Consequences

**Positive:**

- No route resolution API calls needed — the URL prefix tells us the content type
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
