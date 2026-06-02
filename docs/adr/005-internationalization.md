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

### Product Language Fallback

Geins's `product(alias:, languageId:)` returns `null` when a product is not published in the requested language channel. Translating the name and texts in the admin is not sufficient on its own; the product entity must also be activated for that channel. To keep PDPs usable on language switch, `getProduct()` in `server/services/products.ts` retries with the tenant's default `languageId` whenever the first query returns `null` and the requested locale differs from the SDK default. The PDP renders with default-language content rather than 404-ing.

If both locales return `null` the product is genuinely missing and we throw `NOT_FOUND`. The route then sets `Cache-Control: no-store` on the response so a freshly-published product does not stay 404 at the CDN for the regular `s-maxage` window.

Per-language alias resolution (e.g. canonical EN alias differs from SV alias for the same product) is not handled by the storefront. It depends on a Geins schema addition. Until then, language switches preserve the current alias and rely on the fallback above.

### Language Switch Preserves the Alias

The `LocaleSwitcher` component builds its `<a href>` from `getCleanPath()`, so switching language on a PDP or PLP keeps the same alias (e.g. `/se/sv/p/foo` → `/se/en/p/foo`) instead of dropping the user to the homepage of the new locale. The destination page re-fetches against the new locale; if Geins serves a different per-language canonical URL, the PDP / PLP `replaceState`s to that canonical URL after hydration. This mirrors the ralph-storefront pattern (`MixProductPage.js` does the same swap).

The `replaceState` is gated on the `/{market}/{locale}/` prefix matching: a cross-locale canonical (which the locale fallback returns when the requested locale has no data) must **not** rewrite the URL, because that would yank the user out of the locale they asked for.

`switchMarket` keeps the previous home-redirect behavior on dynamic routes because markets often have entirely different catalogs and the current alias is unlikely to resolve in the new market.
