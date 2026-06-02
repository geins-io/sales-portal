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
