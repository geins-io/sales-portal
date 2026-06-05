---
title: Bulletproof URL routing
status: accepted
created: 2026-06-03
author: '@geins'
tags: [routing, i18n, seo]
---

# ADR-019: Bulletproof URL routing

## Context

ADR-015 introduced type-prefixed routing (`/c/`, `/p/`, `/b/`, `/s/`, `/dc/`)
and `shared/utils/route-helpers.ts` as the sole builder of entity paths.
ADR-017 added a narrow inbound resolver that 301-redirects prefix-less entity
URLs hitting the `[...slug].vue` catch-all (stale bookmarks, pasted Geins
canonicals). Two failure classes remained after ADR-017.

**Failure A: category 404 on language switch.** The locale switcher read the
Geins `alternativeUrls` for each entity and used the raw alternate as the
switch target. Geins returns category alternates with its own `/l/` prefix
(e.g. `/se/en/l/category-1`). No app page route owns `/l/`; the catch-all
treated it as a CMS slug, found nothing, and returned a 404. The app routes
categories at `/c/`.

**Failure B: renamed-slug 404 on typed pages.** When a product or category
slug was renamed in Geins, stale in-app links still pointed at the old slug
via the typed `/p/` or `/c/` route. The typed page components called their
Geins data fetch, received a content miss, and threw a hard 404. They never
consulted the resolver, so only the prefix-less catch-all could recover a
renamed slug; a direct `/p/` or `/c/` URL with a stale alias was permanently
broken.

**Why ADR-017 alone was insufficient.** ADR-017's resolver was reached only
by one path: the catch-all CMS miss. Typed pages (`/p/`, `/c/`, `/b/`) had no
recovery path. The locale switcher preserved whatever prefix Geins returned
without normalizing it to an app route. ADR-017 explicitly deferred
negative-caching of resolver misses, leaving a hammered bad URL re-querying
Geins on every request.

## Decision

Four pillars implement a complete routing contract. Each claim is verifiable
in the code at the paths named below.

### Pillar 1: one outbound builder

`shared/utils/route-helpers.ts` is the only place where entity app-paths are
constructed. It exports:

- `categoryPath(canonicalUrl)`, `productPath`, `brandPath`,
  `searchPath`, `discountCampaignPath` for normal navigation (strip Geins
  market/locale, prepend the correct type prefix).
- `buildTypePrefixedPath` (internal) tolerates bare aliases with no leading
  slash and strips any Geins-supplied type prefix before prepending the
  correct app prefix, so `/se/sv/l/category-1` becomes `/c/category-1` and
  not `/c/l/category-1`.
- `alternateEntityPath(url, type)` for the locale switcher: maps a raw Geins
  alternate URL to the app typed route while preserving the alternate's own
  `/{market}/{locale}/` segments (never substituting the current locale). A
  `/l/` category alternate becomes `/c/`; an already-correct `/c/` alternate
  is left unchanged; an unsafe or unroutable input returns `null`.

`app/composables/useLocaleAlternates.ts` routes every alternate through
`alternateEntityPath`, so Failure A cannot recur.

Three guardrails prevent raw entity-URL literals from bypassing the builders:

1. An ESLint `no-restricted-syntax` rule in `eslint.config.mjs` (scoped to
   `app/**`) flags string and template literals containing `/p/`, `/c/`, or
   `/b/` passed to `localePath()`, `navigateTo()`, `router.push()`, or
   `router.replace()`, with the message directing agents to the route helpers.
2. A hard-block rule in `.mint/hard-blocks.md` makes the same constraint
   explicit for agentic code generation.
3. A static-scan test at `tests/unit/lint/entity-url-literals.test.ts`
   enforces this at test time in addition to lint time.
4. Route-helper invariant tests at `tests/unit/route-helpers-invariants.test.ts`
   assert the key shape-transformation properties of the helpers.

### Pillar 2: one cached resolver, two tiers

`server/api/resolve-url.get.ts` is a `defineCachedEventHandler` (SWR,
`maxAge: 60`, `staleMaxAge: 300`). Its cache key is `{host}::{normalizedPath}`
(lower-cased, trailing-slash stripped) so two tenants sharing an alias never
collide. It returns a normalized shape:
`{ type, canonicalAppPath }` (typed hit), `{ redirect }` (renamed slug via
`urlHistory`), or a `{ notFound: true }` marker. The notFound marker is
returned rather than thrown so Nitro caches the miss for the SWR TTL (a thrown
error is not cached and re-hammers Geins on every scan request). The thin outer
`defineEventHandler` wrapper converts the marker to a real 404 for callers.
This closes the negative-cache follow-up that ADR-017 deferred.

The resolver resolves in the URL's OWN market/locale, not the request default.
It parses the leading `/{market}/{locale}` from its `path` argument
(`parseLocaleMarketPrefix`), validates it against the tenant via
`resolveLocaleMarket`, and sets `event.context.resolvedLocaleMarket` before the
Geins lookups run. Without this the lookups read the request channel context,
which on an `/api/` request falls back to the tenant default locale, so a
non-default-locale alias (an English slug under a Swedish-default tenant) never
resolves and the net 404s for that locale only. Prefix-less paths carry no
market/locale segments, so the default-locale behaviour is preserved.

The resolver is reached by exactly two tiers:

**Tier 1 (wrong-shape global middleware).** `app/middleware/resolve-url.global.ts`
fires on both SSR render and every client navigation. A fast path-shape guard
runs before any network call: it checks that the path matches
`/{market}/{locale}/{prefix}/...` and that the prefix is one of the two
wrong-shape values (`l`, `dc`). Paths with correct typed prefixes (`c`, `p`,
`b`, `s`) are skipped without any I/O; prefix-less and unknown-prefix paths
are left to the catch-all. When the guard engages, the middleware calls the
cached resolver and issues `navigateTo(..., { redirectCode: 301, replace: true
})` with query and hash preserved. On a terminal miss it calls
`abortNavigation(createError({ statusCode: 404 }))` rather than redirecting to
another miss. The middleware runs after `locale-market.global.ts` and never
touches the locale cookie, `setLocale`, or any i18n side effects.

**Tier 2 (content-miss recovery).** `app/composables/useEntityUrlRecovery.ts`
exports `recoverEntityUrl(path)`. It is called by `ProductDetails.vue` and
`ProductList.vue` on a content miss (Failure B), and by `[...slug].vue` on a
CMS miss. It uses `useFetch` (which auto-forwards cookie and host on page-level
loads). On a `canonicalAppPath` hit it 301-redirects unless the target equals
the incoming path (loop guard), in which case it throws a 404. On a `redirect`
hit (renamed slug: a bare Geins `urlHistory.newUrl`) it re-applies the current
locale prefix via `localePath` before redirecting. On a fetch error or a 404
response it throws a fatal 404.

**Invariant: recovery composables must restore Nuxt context after an await.**
Unlike a page `setup` function, an `await` inside an extracted composable drops
the Nuxt instance. Any code that calls `navigateTo` (which internally calls
`useRouter` and `useNuxtApp`) after an async boundary will throw "A composable
that requires access to the Nuxt instance was called outside of a plugin, Nuxt
hook, Nuxt middleware, or Vue setup function" and the page error boundary will
swallow it, producing an empty 200 instead of the intended 301.

`recoverEntityUrl` handles this by capturing `const nuxtApp = useNuxtApp()`
before the `useFetch` await, then wrapping every post-await `navigateTo` in
`nuxtApp.runWithContext(() => navigateTo(...))`. `createError` is a plain h3
utility that carries no Nuxt instance requirement, so it is called unwrapped.

Route middleware does NOT need `runWithContext`; the middleware runner restores
the Nuxt context automatically before invoking each middleware function. This
invariant applies only to composables that contain their own `await` and then
call a composable (such as `navigateTo`) that requires a live Nuxt instance.

Both tiers validate their redirect targets with `isSafeInternalPath` from
`shared/utils/redirect.ts` before calling `navigateTo`. An off-origin,
protocol-relative, or absolute target is treated as a terminal miss (404), not
a redirect. `buildTypePrefixedPath` unconditionally prepends a `/`-rooted type
prefix, so a `canonicalAppPath` built by the resolver is same-origin by
construction; the `isSafeInternalPath` check is a defense-in-depth layer on
top of that invariant. This also retroactively hardens the inbound recovery
from ADR-017.

### Pillar 3: real 301 over history.replaceState

`ProductDetails.vue` and `ProductList.vue` previously called
`history.replaceState` to silently correct the address bar when the loaded
entity's `canonicalUrl` differed from the current path. That approach produced
no crawlable 301, risked hydration mismatches, and was invisible to the
resolver. Both components now issue `navigateTo(routable, { redirectCode: 301,
replace: true })` instead.

A `samePrefix` guard checks that the first two segments (`/{market}/{locale}`)
of the raw Geins canonical match those of the current path before redirecting.
This suppresses the redirect when a locale fallback returned a canonical in a
different locale, preventing the router from silently switching the user's
locale.

**Refinement: the `ProductList.vue` canonical 301 fires server-side only.**
The redirect decision is factored into the pure
`canonicalListRedirectTarget()` helper in `route-helpers.ts`, and the listing
page only calls `navigateTo` when `import.meta.server`. On a client-side SPA
navigation a `navigateTo({ replace: true })` re-ran the non-awaited product and
filter `useFetch` calls mid-navigation; under that burst the Geins-backed list
endpoints intermittently returned 503 and the errored response blanked the grid
until a manual reload. A hard load or crawler hit still issues the real 301
server-side, and `rel=canonical` still points at the canonical, so SEO is
unaffected; the client simply renders the valid clicked URL without the racing
redirect. `ProductDetails.vue` still issues its canonical 301 on both passes
(single awaited fetch, no list burst); apply the same server-only gate there if
the same symptom appears.

### Pillar 4: per-locale hreflang from real slugs

`app/composables/useSeoLinks.ts` accepts an optional `localeOverrides` map
(`Record<string, string>`, reactive or static). When PDP/PLP pages feed it
from `useLocaleAlternates().alternates` (which has already been mapped through
`alternateEntityPath`), the emitted hreflang links point at the real localized
slug for each locale rather than a naive same-slug prefix swap that may 404 in
another locale. Single-arg callers (pages without locale alternates) are
unaffected; hreflang falls back to the naive prefix swap for those locales.
`@nuxtjs/i18n`'s `setI18nParams` is not used for alternate derivation because
it has known alternate-desync bugs in the version in use.

**Reactive SEO locale and `<html lang>` priority (`app/plugins/tenant-seo.ts`).**
Plugins execute before route middleware. With `@nuxtjs/i18n` strategy
`no_prefix` and programmatic `setLocale`, the active locale is not set until
the `locale-market.global.ts` middleware runs. A locale value captured once at
plugin setup therefore freezes to the default (`sv`) on SSR, so hard loads of
non-default-locale pages (e.g. `/se/en/`) would emit `html lang="sv-SE"` and
`og:locale=sv_SE` regardless of the actual URL locale.

`tenant-seo` reads the locale as a Vue `computed` that references
`i18n.locale`. Because unhead evaluates getter functions at render time (after
middleware has set the locale), `og:locale`, schema.org `inLanguage`, and
`<html lang>` all reflect the render-time URL locale rather than the
plugin-setup-time default. The page content and i18n strings were already
rendered in the correct locale; this addition fixes only the SEO and
accessibility attributes.

The `<html lang>` value is the locale's BCP-47 `language` field (`en` maps to
`en`, `sv` maps to `sv-SE`), read from `i18n.locales` rather than hardcoded,
keeping the plugin in lockstep with the i18n config.

**`tagPriority: 1000` on the `<html lang>` entry is load-bearing and must not
be removed.** `nuxt-seo-utils` (shipped by `@nuxtjs/seo`) registers its own
`htmlAttrs.lang` with `tagPriority: 'low'`. In unhead's htmlAttrs merge,
`'low'` (weight 102) counterintuitively beats the default priority (weight 100)
and would overwrite the reactive `lang` computed above. The explicit numeric
priority 1000 deterministically wins the merge. The `lang` entry is kept in a
separate `useHead` call from the title/meta entry so the high numeric priority
does not affect the weight of those tags.

## Consequences

**Positive:**

- **Faster.** The path-shape guard in the global middleware makes the common
  case (already-correct typed path) zero-cost. The SWR cache absorbs crawler
  bursts and repeated navigations; the negative-cache marker means a bad URL
  runs at most one Geins round-trip per `staleMaxAge` window.
- **Crawler-correct.** A real 301 or 404 is issued on document load. The
  correct `rel=canonical` and per-locale hreflang are emitted from the real
  localized slugs. `<html lang>`, `og:locale`, and schema.org `inLanguage` are
  now correct on hard-loaded non-default-locale pages (reactive computed in
  `tenant-seo`; the high `tagPriority` wins the unhead merge). SPA navigations
  produce a soft Vue Router transition, not a crawler-grade status code, which
  is acceptable because crawlers do not execute in-app link clicks and every
  page still emits the correct canonical.
- **Loop-safe.** Three independent loop guards: the path-shape guard no-ops on
  already-correct shapes; both tiers compare the resolved target against the
  incoming path and 404 on equality; the global middleware uses 404 rather than
  redirect on a terminal miss.
- **Hydration-safe.** Real `navigateTo` with `redirectCode: 301` produces one
  clean render on the destination page; there is no address-bar rewrite during
  an ongoing SSR render.
- **Open-redirect-safe.** `isSafeInternalPath` validation at every
  `navigateTo` call site plus the same-origin-by-construction invariant of
  `buildTypePrefixedPath` mean a malicious or malformed target from a Geins
  API response cannot produce an off-origin redirect.

**Invariant: any composable that calls `navigateTo` after an `await` must
capture `useNuxtApp()` before that await and wrap each post-await `navigateTo`
in `nuxtApp.runWithContext(...)`.** Violation produces a swallowed error and an
empty 200 page instead of a 301. Route middleware is exempt (the runner
restores context automatically). See Pillar 2 for the full explanation.

**Trade-off.** SPA navigations redirected by the global middleware are soft
Vue Router transitions, not HTTP 301 responses. This is acceptable: crawlers
hit the SSR path, and every rendered page emits the correct `rel=canonical`
regardless of how the user arrived.

**Relationship to prior ADRs:**

- Extends [ADR-015](015-type-prefixed-routing.md) by adding `alternateEntityPath`
  to the route-helper contract, guardrails against hand-built entity-URL
  literals, and the two-tier inbound recovery path.
- Extends [ADR-017](017-entity-url-safety-net.md) by closing its explicitly-deferred
  negative-cache follow-up (via the `{ notFound: true }` SWR-cached marker),
  expanding resolver reach to the typed PDP/PLP pages (Tier 2), and adding the
  wrong-shape global middleware (Tier 1). ADR-017 remains valid; this ADR
  describes the full contract built on top of it.
