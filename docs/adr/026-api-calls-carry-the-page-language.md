---
title: API calls carry the language of the page that makes them
status: accepted
created: 2026-11-12
author: '@geins'
tags: [i18n, locale, api, ssr]
---

# ADR-026: API calls carry the language of the page that makes them

## Context

API routes are not page paths, so middleware 00 never resolves their locale
from a URL. They read the `locale` cookie instead, which fails in three ways:

- During SSR the page's internal API calls forward the cookie the browser
  sent, which still holds the previous page's language; middleware 00 sets
  the new one only on the response. The first page after a language switch
  shows the previous language.
- The browser caches an API answer by its URL. With no language in the URL, a
  cached answer in one language is served on a page in another.
- One cookie is shared by every tab, so a tab in another language changes what
  this tab's API calls answer.

## Decision

The page URL comes first for the language, as it already does for the page
itself and the client middlewares. Every call to our own `/api` routes carries
the locale of the page that makes it as `?locale=`:

- SSR: middleware 00 wraps the page request's `event.$fetch`, which `useFetch`,
  `internalFetch` and `useRequestFetch` use. A page without a prefix sends the
  tenant's default locale.
- Browser: one plugin, registered first, adds the locale from
  `window.location` to every same-origin `/api/` fetch.

`getRequestLocale` reads, in order: the page request's own URL, the locale the
calling page sends (checked against the tenant's locales, or its shape when the
tenant has none), the cookie, the tenant default. A call that names its own
locale keeps it.

The market is not carried. It binds the currency and the buyer's market
([ADR-020](020-buyer-market-selection.md)), so `getRequestMarket` reads it as
before: an explicit `?market=`, the cookie, the tenant default.

## Consequences

- An API answer follows the language of the page that asked, on the first
  load after a switch and in every tab. Browser-cached answers are cached per
  language, because the language is in the URL.
- New calls need nothing; the transport adds the locale.
- The cookie only decides the language for a request no page made.
- Every browser `/api/` URL now carries `?locale=`. Anything that matches an
  API URL exactly, such as an e2e intercept, must match its pathname instead;
  `tests/e2e` does this through one helper, and a lint rule rejects a literal
  `/api/` URL there.
- The browser hook replaces the global `fetch` for same-origin `/api/` URLs
  only. `localeQuery` stays where a `useFetch` must refetch on an in-app
  language change, since the locale the transport adds is not part of the
  fetch key.
