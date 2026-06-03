# Coding Conventions

Standards and patterns for this codebase. Read before contributing.

## Quick Rules

| Do                                                         | Don't                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| Use `useFetch` for API calls in components                 | Create wrapper composables                              |
| Use `@vueuse/core` for utilities                           | Write custom debounce/storage/etc                       |
| Use Pinia for UI state only                                | Put server data in Pinia                                |
| Pass `event` to `useRuntimeConfig(event)` in server routes | Call `useRuntimeConfig()` without event                 |
| Keep changes minimal and focused                           | Add features beyond what was asked                      |
| Build entity URLs with route-helpers + `localePath()`      | Put a raw Geins canonical in an href or the address bar |

## Files

- [Composables](composables.md) - When and how to create composables
- [Runtime Config](runtime-config.md) - Environment variables and config
- [Error Handling](error-handling.md) - Error patterns for client and server
- [Icons](icons.md) - Static vs dynamic icon names, client bundle rules
- [API Clients](api-clients.md) - useFetch vs internalFetch vs $api, SSR cookie forwarding

## URL invariant

Every navigable category, product, brand, search, and discount URL MUST be type-prefixed (`/c/`, `/p/`, `/b/`, `/s/`, `/dc/`). Build the path with `categoryPath` / `productPath` / `brandPath` / `searchPath` / `discountCampaignPath` from `shared/utils/route-helpers.ts`, then wrap it with `localePath()`. Never write a raw Geins canonical (which is prefix-less) into an href, `navigateTo`, or `history.replaceState`; normalize it through a route helper first. See [ADR-015](../adr/015-type-prefixed-routing.md) for the routing scheme and [ADR-017](../adr/017-entity-url-safety-net.md) for the inbound 404-miss resolver that recovers prefix-less URLs.

For language-switch alternates, use `alternateEntityPath(url, type)` from the same module. It maps a raw Geins alternate (which may carry the `/l/` list prefix for categories) to the correct app typed route while preserving the alternate's own market and locale. Never pass a raw `alternativeUrls` entry directly to `localePath` or `navigateTo`.

### Inbound URL resolution

Inbound URLs that do not match a typed app route are recovered by a single cached resolver (`/api/resolve-url`), reached by two tiers:

1. **Wrong-shape global middleware** (`app/middleware/resolve-url.global.ts`): fires on both SSR and SPA navigation. Engages only on definitively-wrong path shapes that have no page route (`/l/`, `/dc/`). Issues a real 301 to the canonical app path; aborts with a 404 on a terminal miss. Never touches locale cookies or i18n state.
2. **Content-miss recovery** (`app/composables/useEntityUrlRecovery.ts`): called by `ProductDetails.vue`, `ProductList.vue`, and `[...slug].vue` when their primary content fetch misses. Issues a real 301 to the canonical or a fatal 404.

Always use `navigateTo(..., { redirectCode: 301 })` for canonical corrections; never use `history.replaceState`. When the loaded entity's canonical differs from the current URL, check `samePrefix` first to avoid silently switching the user's locale. See [ADR-018](../adr/018-bulletproof-routing.md) for the full contract.
