---
title: Internationalization with @nuxtjs/i18n
status: accepted
created: 2026-02-09
author: '@AliHalaki'
tags: [i18n, nuxt, vue-i18n]
---

# ADR-005: Internationalization with @nuxtjs/i18n

## Context

The sales portal is a multi-tenant B2B storefront that needs to support multiple languages. Two distinct locale layers exist:

1. **UI locale** — button labels, error messages, navigation text (resolved via `$t()`)
2. **API/content locale** — product names, CMS content, categories from Geins GraphQL (`languageId` variable)

Both layers must stay in sync: when a user switches language, the UI translations _and_ the API queries should reflect the new locale.

The tenant config already has `locale` and `multiLanguage` fields, but neither is wired up. Most pages are stubs, making this the right time to lay the foundation so all future components use `$t()` from day one.

## Decision

### Library: `@nuxtjs/i18n` v9+

- SSR-aware — translations resolve server-side, HTML arrives fully translated (no FOUC)
- Wraps `vue-i18n`; recommended by vue-i18n docs for Nuxt projects
- Lazy-loading, automatic `<html lang>`, cookie persistence, SEO composables
- Geins Studio uses it — ecosystem consistency

### Routing strategy: `no_prefix`

Language is a **per-tenant / per-user preference**, not a URL segment. URLs like `/products/pipe-fitting` stay the same regardless of locale. This keeps SEO simple and aligns with the B2B portal model where a tenant picks a default language.

URL prefix routing (`prefix_and_default`) can be added later if needed for multi-region SEO.

### Translation format

- **JSON files** in `app/locales/`, lazy-loaded per locale
- **snake_case** keys, **nested by domain**: `auth.login_failed`, `cart.add_to_cart`
- **Named interpolation**: `"welcome_back": "Welcome back, {name}!"`
- Matches conventions used by Geins Studio

### Tenant integration

- Locale synced from tenant config via `app/plugins/i18n-locale.ts`
- Available locales exposed from config API for language switcher UI
- Locale preference stored in `locale` cookie (works for anonymous + authenticated)

### SDK / API sync

- `getChannelVariables()` accepts optional `localeOverride` and `marketOverride` parameters
- `getRequestChannelVariables(sdk, event)` composes `getChannelVariables` with request-level locale and market cookies — all GraphQL services now use this to automatically pipe user preferences
- Server-side API routes read locale from `locale` cookie via `getRequestLocale()` and market from `market` cookie via `getRequestMarket()`

## Consequences

### Positive

- All future components use `$t()` from day one — no hardcoded strings to retrofit
- SSR renders translated HTML — good for SEO and perceived performance
- Lazy loading keeps bundle size minimal (only active locale loaded)
- Tenant-driven locale list means each merchant controls available languages
- SDK query sync ensures API content matches UI language

### Negative

- Every user-visible string must have a translation key — small overhead per component
- Adding a new locale requires translating all keys (mitigated by lazy loading — only active locale affects bundle)
- `no_prefix` means no locale in URL — search engines can't crawl different language versions via URL alone (acceptable for B2B portal behind auth)

### CMS Language Fallback

CMS widget areas and menus may only exist for one language. The CMS service layer retries without `languageId` when content is missing, falling back to the SDK's default locale. This prevents blank pages when CMS content hasn't been localized. CMS pages do **not** fall back — they have language-specific aliases (e.g. `om-oss` vs `about-us`) and a missing page for a locale is a genuine 404.

### Alias Language Fallback

Geins's per-language alias queries (`product`, `categoryByAlias`, `brandByAlias`, `discountCampaignByAlias`) return `null` when the entity is not published in the requested language. Translating the name and texts in the admin is not sufficient on its own; the entity must also be activated for that channel.

To keep PDPs and PLPs usable on language switch, `server/services/_locale-fallback.ts` exposes `resolveWithLocaleFallback`. It runs the query once with the requested `languageId`, and retries with the tenant's default `languageId` when the first call returns `null` and the locales differ. Every alias-resolving service composes this helper (do not reimplement it inline). Add a new caller by passing `{queryPath, variables: {alias}, serviceName}`.

If both locales return `null` the entity is genuinely missing and the route throws `NOT_FOUND`. Route handlers then set `Cache-Control: no-store` on the 404 response so a freshly-published entity does not stay 404 at the CDN for the regular `s-maxage` window.

Per-language alias resolution (e.g. canonical EN alias differs from SV alias for the same product) is not handled by the storefront. It depends on a Geins schema addition. Until then, language switches preserve the current alias and rely on the fallback above. The client-side `replaceState` in PDP and PLP then swaps the URL to the canonical alias when the resolved entity's `canonicalUrl` stays in the same `/{market}/{locale}/` prefix as the route the user is on.

### Entity-Page Locale Switching via alternativeUrls

Entity URL slugs in Geins are language-specific (product 1335 is `skarkant` in SV, `cutting-edge` in EN; `kategori-1` in SV, `category-1` in EN). Preserving the current slug across a locale switch lands on a slug that does not exist in the target language, and the alias fallback below then renders default-language content under the new prefix, so the switch appears to do nothing.

**Decision:** entity-page locale switching resolves the target-language URL from Geins `alternativeUrls`, superseding the previous "preserve alias and self-correct via canonical `replaceState`" approach for entity pages.

Geins exposes `alternativeUrls { channelId country culture language url }` (`GeinsAlternativeUrlTypeType`) on product and `PageInfo` (category/brand) types, riding along the query the page already makes (no extra round-trip). The `app/composables/useLocaleAlternates.ts` composable maps these entries in three steps before the switcher consumes them:

1. **Market filter:** keep only entries whose URL first segment equals the active market (Geins returns many markets and channels: `se`, `fi`, `dk`, `us`, `gb`, ...).
2. **Culture/language to short code:** map BCP-47 `culture` (e.g. `en-US`) to the short URL locale code (`en`), fall back to `language`, and keep it only when it is one of the tenant's available locales.
3. **Routable-path normalization:** Geins pretty SEO paths often omit the `/p/` `/c/` `/b/` type prefix (e.g. `/se/en/materials/branch-pipes/manifold-150-150-88`), which would 404; inject the entity's type prefix after `/{market}/{locale}/` when absent, and leave it when present (some tenants include it). The publisher supplies the entity type via `setAlternates(entries, { type })`.

The composable is `useState`-backed and clears on every client route change so stale entity URLs never leak into the switcher. PDP and PLP publish via `setAlternates`; `app/components/shared/LocaleSwitcher.vue` consumes via `hrefFor(loc)`.

**Consequences:**

- The `LocaleSwitcher` `localeHref` returns the published alternate when present, else the existing clean-path build `/${market}/${loc}${getCleanPath()}`. Non-entity pages (home, cart, CMS, account) publish no alternates and are unchanged.
- The in-page `history.replaceState` in PDP / PLP narrows to a same-locale canonical tidy-up. It no longer carries the cross-locale switch responsibility; the `samePrefix` / routable-path guard still prevents a cross-locale canonical from rewriting the URL.
- The server-side default-locale fallback in `server/services/_locale-fallback.ts` is retained as the graceful last resort for genuinely untranslated entities and manually-typed `/se/en/<sv-slug>` URLs. There is no 301 redirect.

### Language Switch Preserves the Alias (Non-Entity Pages)

For pages with no published alternates, the `LocaleSwitcher` component builds its `<a href>` from `getCleanPath()`, so switching language keeps the same path under the new `/{market}/{locale}/` prefix (e.g. `/se/sv/cart` to `/se/en/cart`) instead of dropping the user to the homepage of the new locale. The destination page re-fetches against the new locale and the server renders default-language content for anything not translated. This mirrors the ralph-storefront pattern.

On entity pages the alternates flow above takes precedence; the same-locale canonical `replaceState` remains only to tidy the URL within the current locale, gated on the `/{market}/{locale}/` prefix matching so a cross-locale canonical never rewrites the URL.

`switchMarket` keeps the previous home-redirect behavior on dynamic routes because markets often have entirely different catalogs and the current alias is unlikely to resolve in the new market.
