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
- Locale preference stored in `i18n_redirected` cookie (works for anonymous + authenticated)

### SDK / API sync

- `getChannelVariables()` accepts an optional `localeOverride` parameter
- Server-side API routes read locale from `i18n_redirected` cookie via `getRequestLocale()`
- This is opt-in per service — existing services keep working with the tenant default

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
