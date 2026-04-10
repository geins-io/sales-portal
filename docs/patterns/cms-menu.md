# CMS Menu Pattern

## Overview

Navigation menus are fetched from the Geins CMS Menu Builder. Each menu has a "location ID" — a string key that identifies where the menu appears in the layout.

## Menu Locations

Defined in `shared/constants/cms.ts`:

| Constant               | Value      | Used by                              |
| ---------------------- | ---------- | ------------------------------------ |
| `MENU_LOCATION.MAIN`   | `'main'`   | Desktop header nav, mobile nav panel |
| `MENU_LOCATION.FOOTER` | `'footer'` | Footer links                         |

## Data Flow

```
Geins CMS → /api/cms/menu?menuLocationId=main → useMenuData('main') → Component
```

1. Content editor creates/edits menu in Geins Merchant Center
2. Server route `server/api/cms/menu.get.ts` validates input (Zod) and calls `getMenu()` service
3. Service calls SDK with channel variables (locale/market aware)
4. `useMenuData(locationId)` composable wraps `useFetch` with deduplication
5. Component renders using shared utilities from `shared/utils/menu.ts`

## URL Handling

The CMS stores absolute URLs like `https://tenant.example.com/se/sv/l/epoxi`. The `normalizeMenuUrl()` utility strips the tenant hostname, then `stripGeinsPrefix()` removes the market/locale prefix. This handles two URL formats:

- `/{market}/{locale}/path` — e.g. `/se/sv/about-us` → `/about-us`
- `/{locale}/path` — CMS-generated page URLs without market, e.g. `/en/about-us` → `/about-us`

The result is passed to `localePath()` which adds our `/{market}/{locale}/` prefix. External URLs (different host) render as `<a target="_blank">`.

## Adding a New Menu Location

1. Add the constant to `MENU_LOCATION` in `shared/constants/cms.ts`
2. Call `useMenuData(MENU_LOCATION.YOUR_NEW_LOCATION)` in your component
3. Configure the menu in the Geins Merchant Center with the matching location string

## Shared Utilities

All in `shared/utils/menu.ts`:

- `normalizeMenuUrl(url, currentHost)` — relative path for internal, full URL for external
- `stripGeinsPrefix(path)` — removes `/{market}/{locale}/` or `/{locale}/` prefix, maps type indicators (`/l/` → `/c/`)
- `getMenuLabel(item)` — `label || title || ''`
- `getVisibleItems(items)` — filter hidden, sort by order
- `isExternalUrl(url, currentHost)` — true if different host

## CMS Language Behavior

Menu queries pass `languageId` to the Geins API. If the menu has no content for the user's locale, the service retries without `languageId` so the SDK uses its default locale. This ensures menus always render even when content is only created for one language. See `local-docs/CMS-LANGUAGE-MODEL.md` for full details.
