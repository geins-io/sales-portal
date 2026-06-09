# CMS Page Link by Tag Pattern

## Overview

Some nav links point at a CMS page whose slug is localized and editor-owned
(the Swedish contact page is `kontakt`, the English one is `contact`). Hardcoding
a single path breaks the moment an editor renames the slug or a market uses a
different language. Instead, the storefront resolves these links by a stable
**tag** the editor attaches to the page in Geins Merchant Center, and the CMS
returns the correct localized URL per request.

This complements the menu-driven nav (see `cms-menu.md`): use a menu when the
links are a list the editor curates; use a tag when a single styled control in
code (an icon button, a placed link) must point at one editor-owned page.

## Tag Registry

Tags live in `CMS_TAGS` in `shared/constants/cms.ts` (lowercase, no leading `#`;
`hasPageTag()` normalizes the `#` and casing the editor typed):

| Constant                | Value       | Used by                  |
| ----------------------- | ----------- | ------------------------ |
| `CMS_TAGS.CONTACT_PAGE` | `'contact'` | Topbar "Contact us" link |
| `CMS_TAGS.APPLY_PAGE`   | `'apply'`   | Topbar "Apply" link      |

## Data Flow

```
Geins CMS (page tagged #contact)
  -> /api/cms/page-link?tag=contact   ({ url: string | null })
  -> useCmsPageLink('contact', '/contact-form')   (-> { to })
  -> <NuxtLink :to="contactTo">
```

1. An editor tags the page in Merchant Center (e.g. `#contact`).
2. `getPageLinkByTag({ tag }, event)` (`server/services/cms.ts`) runs
   `cmsPages(includeTags: [tag], ...channelVars)` with the request's channel,
   language, and market from `getRequestChannelVariables`, and returns the first
   matching page's raw `canonicalUrl` (or `null`). `cmsPages` localizes by an
   exact `languageId` match, so each locale gets its own page. Results are cached
   in a short-TTL LRU keyed by `buildCachePrefix(event)::pagelink::<tag>`; a
   confirmed miss is cached as an empty-string sentinel (distinguished from an
   un-cached entry via `cache.has()`) so a missing page does not re-query every
   render. Preview requests bypass the cache.
3. `server/api/cms/page-link.get.ts` validates `tag` with `CmsPageLinkSchema`
   (`^[a-z][a-z0-9-]*$`, max 50) and returns `{ url }`.
4. `useCmsPageLink(tag, fallback)` (`app/composables/useCmsPageLink.ts`) fetches
   the route and turns the raw `canonicalUrl` into an app route through the SAME
   pipeline every other CMS link uses (see URL Handling below).

## URL Handling

The resolved `canonicalUrl` is a raw Geins URL (e.g. `/se/sv/kontakt`, or the
locale-only `/en/contact` form). It is NOT bound directly. It runs through the
same pipeline as the menu nav (`LayoutHeaderNav`):

```
normalizeMenuUrl(canonicalUrl, currentHost)  ->  localePath(path)
```

`normalizeMenuUrl` -> `stripGeinsPrefix` strips both the `/{market}/{locale}/`
and locale-only `/{locale}/` prefixes (and maps Geins type indicators), then
`localePath` re-applies the current market/locale prefix. The composable guards
the normalized path with `isSafeInternalPath` before it reaches `NuxtLink :to`
so an external or protocol-relative URL can never leak into the link sink.

## Fail-Open

The link must never break the surface that renders it. When the resolver returns
`null`, errors, or yields an external / non-internal URL, the composable falls
back to `localePath(fallback)` (the conventional in-app path). So if an editor
deletes or untags the page, the control still renders a sensible link instead of
disappearing or throwing.

## Adding a New Tagged Link

1. Add the tag constant to `CMS_TAGS` in `shared/constants/cms.ts`.
2. In the component, call `useCmsPageLink(CMS_TAGS.YOUR_TAG, '/your-fallback')`
   and bind the returned `to` to the link.
3. Ask the editor to tag the target page (each localized variant gets the same
   tag) in Merchant Center.
