---
title: CMS-page link routing contract
status: accepted
created: 2026-06-12
author: '@geins'
tags: [routing, cms, i18n, seo]
---

# ADR-021: CMS-page link routing contract

## Context

The sales portal serves CMS pages through the `app/pages/[...slug].vue` catch-all.
Editors assign each page a localized URL alias in Geins Merchant Center: a Swedish
tenant's terms page may live at `/villkor`, its contact page at `/kontakt`, and its
apply-for-account page at `/ansok-om-konto`. The storefront codebase historically
wired these links by hardcoding English semantic slug strings (`/terms`, `/contact`,
`/apply-for-account`, `/contact-form`) directly in topbar navigation, login flow,
and checkout summary components.

Three failure classes followed from that approach.

**Failure A: 404 on localized-slug tenants.** A tenant whose terms page alias is
`/villkor` received a hard 404 whenever the hardcoded `/terms` link was followed,
because no CMS page with that alias existed in their catalog.

**Failure B: stale bookmarks and external links.** A user who bookmarked `/terms`
on a tenant that later renamed the page continued to hit 404 on every visit. No
inbound recovery path existed, so the bookmark was permanently broken.

**Failure C: no prevention.** Three separate reactive fixes (topbar contact/apply,
login apply link, checkout terms link) were applied one at a time as each instance
was discovered. Without a structural guard, each new component that needed a CMS
page link repeated the same hardcoding pattern.

ADR-019 gave the product catalog these guarantees: a sole outbound builder
(`shared/utils/route-helpers.ts`), an inbound resolver for stale and renamed slugs
(`server/services/url-resolver.ts`), and lint guards backed by a static-scan test.
CMS pages were never included in those guarantees. This ADR documents the decisions
that close that gap.

## Decision

Five pillars mirror the ADR-019 structure and together form a complete routing
contract for CMS pages. Each claim is verifiable in the code at the paths named
below.

### Pillar 1: one source of truth

`shared/constants/cms.ts` is the single source of truth for semantic slugs and the
tags that identify their target pages.

`CMS_TAGS` is the tag registry. It maps logical keys to the string values editors
type into the Geins admin tag field (`contact`, `apply`, `terms`). Any code that
needs to refer to a CMS page conceptually refers to a `CMS_TAGS` value, not a URL.

`CMS_SEMANTIC_SLUGS` maps every legacy English slug that has appeared as a hardcoded
link in the wild to its corresponding `CMS_TAGS` value:

```
terms              -> CMS_TAGS.TERMS_PAGE
contact            -> CMS_TAGS.CONTACT_PAGE
contact-form       -> CMS_TAGS.CONTACT_PAGE
apply              -> CMS_TAGS.APPLY_PAGE
apply-for-account  -> CMS_TAGS.APPLY_PAGE
```

`CMS_SEMANTIC_SLUG_KEYS` is the frozen, iterable key list derived from that map.
All lint guards and inbound-recovery logic consume `CMS_SEMANTIC_SLUG_KEYS` as their
allowlist input so every addition to the semantic-slug map propagates automatically
to both protection layers. `cmsTagForSlug(slug)` is the pure lookup function that
strips leading slashes, lowercases, and resolves multi-segment paths by their last
non-empty segment.

### Pillar 2: one outbound builder

`app/composables/useCmsPageLink.ts` exports `useCmsPageLink(tag)`. It is the only
sanctioned way to build a CMS-page link in the app layer.

The composable calls `GET /api/cms/page-link` (`server/api/cms/page-link.get.ts`),
which delegates to `getPageLinkByTag` in `server/services/cms.ts`. That service
looks up the CMS page tagged with the given value, extracts its localized URL alias,
and validates it through `isSafeInternalPath` before returning it. The composable
then pipes the result through `normalizeMenuUrl` (strips the Geins `/{market}/{locale}/`
prefix) and `localePath` (re-applies the current tenant market and locale prefix),
producing a safe in-app path.

The composable returns `{ to, isResolved }`. Consumers must gate rendering on
`isResolved`. An unresolved link, whether caused by a fetch error, a null CMS
response, an external URL, or a path that fails `isSafeInternalPath`, is hidden from
the DOM rather than rendered as an hrefless anchor that would produce invalid HTML
and a broken user experience.

No component may hardcode a CMS slug as a navigation target. All three previously
hardcoded call sites (topbar, login flow, checkout terms) now use `useCmsPageLink`.

### Pillar 3: prevention

Two complementary layers prevent hardcoded CMS slug literals from being introduced.

**Layer A (ESLint, `eslint.config.mjs`).** A `no-restricted-syntax` rule in the
`app/**` scope flags string and template literals whose value matches any of the
five known semantic slugs (`/terms`, `/contact`, `/contact-form`, `/apply`,
`/apply-for-account`) when passed as the first argument to `localePath`,
`navigateTo`, `router.push`, or `router.replace`. The rule message directs the
developer to `useCmsPageLink(CMS_TAGS.X)`. The regex is longest-match first
(`contact-form` before `contact`, `apply-for-account` before `apply`) so alternation
is unambiguous.

**Layer B (static-scan test, `tests/unit/lint/cms-page-link-literals.test.ts`).** A
Vitest-resident static scan walks the entire `app/` tree at test time. It builds an
allowlist of real app routes from the top-level entries of `app/pages/` and flags
any nav-context literal whose first path segment does not appear in that allowlist.
Exclusions cover only the three dev-only showcase pages (`elements.vue`,
`preview-widgets`, `error-test.vue`). A second assertion in the same test file
reads `eslint.config.mjs` at test time and confirms that every entry in
`CMS_SEMANTIC_SLUG_KEYS` appears in the ESLint no-restricted-syntax selectors,
keeping Layer A and Layer B in lockstep with the slug map in `shared/constants/cms.ts`.

### Pillar 4: inbound recovery

`server/services/url-resolver.ts` (`resolveEntityUrl`) adds CMS-page recovery as
Step 0, before the product/category/brand entity lookups.

When the `[...slug].vue` catch-all misses its CMS lookup and calls the resolver,
the resolver first passes the inbound alias through `cmsTagForSlug`. If the alias is
one of the five known semantic slugs, the resolver calls `getPageLinkByTag` to
fetch the merchant's localized CMS page URL for that tag. If the returned localized
path differs from the inbound path (comparing both after stripping their
market/locale prefix via `stripLocaleMarketPrefix`), the resolver returns
`{ redirect: localizedPath }`, which the catch-all converts to a real 301 response.

Three invariants are enforced structurally and cannot regress independently.

**No-redirect-when-page-exists.** If the tenant's CMS page alias is literally
`terms` (an exact match for the inbound slug), the CMS lookup in the catch-all
succeeds before the resolver is called. The resolver's Step 0 is never reached for
live matching pages.

**Loop guard.** If the localized path after stripping prefixes equals the inbound
path after stripping prefixes, the resolver treats the result as a non-match and
falls through to the entity lookups. This prevents a redirect to the same URL in
cases where the tenant's localized alias happens to be the same English string.

**Open-redirect guard.** `getPageLinkByTag` validates the URL via
`isSafeInternalPath` internally. The resolver also re-validates the returned link
before emitting the redirect, as a defence-in-depth boundary, so the resolver never
emits an off-origin 301 regardless of what the CMS service returns.

### Pillar 5: locale switching

`app/composables/useLocaleMarket.ts` maintains a `staticRoutes` set of route names
that use the same path across all locales (cart, checkout, login, and so on).
CMS pages are dynamic routes: a slug resolved in Swedish (`/villkor`) is not valid
in English (the English alias may be `/terms` or any editor-chosen string). They are
explicitly excluded from `staticRoutes` so that a locale or market switch re-resolves
via the Geins API rather than carrying the current-locale slug into the switched
locale URL. The comment in `useLocaleMarket.ts` records this invariant inline and
names the specific former entries (`contact`, `apply-for-account`) that were removed
when this was made explicit.

## Consequences

**Positive:**

- Localized CMS pages no longer 404 when a stale bookmark, an external link, or a
  search-engine index entry carries a legacy English semantic slug. The inbound 301
  recovery maps `terms` to `/villkor`, `contact` to `/kontakt`, and so on per the
  merchant's current admin configuration.
- Editors can rename CMS page aliases freely per market without touching code. The
  outbound builder fetches the current alias at request time through the Geins API.
- The forbidden slug set is defined once in `shared/constants/cms.ts` and flows
  automatically to the ESLint rule, the static-scan test, and the inbound resolver.
  Adding a new semantic slug requires a single entry in `CMS_SEMANTIC_SLUGS`.
- Unresolved links are hidden rather than rendered as broken anchors, so a
  misconfigured tenant shows no link rather than a dead one.
- Locale and market switching re-resolves CMS page slugs via the API, preventing
  wrong-locale slug carry-over.

**Trade-off.** A reserved English semantic slug (`terms`, `contact`, etc.) cannot be
used as an unrelated CMS page alias on a tenant that also has a tagged page for that
concept, without producing a redirect loop. This is acceptable: the semantic slugs
are a small, stable set representing universal storefront concepts, and tenant editors
who need a non-default alias simply choose a different string.


## Known limitations of the static guard

The static guard (Layer A ESLint + Layer B scan) can reliably catch hardcoded
CMS page links only when they appear as recognized literal forms in the source.
Four forms are outside its reach and must be caught through code review:

**Runtime string concatenation.** An expression such as `'/' + slug` or
`\`/\${page}\`` is not a static literal and is invisible to the selectors.

**Variable indirection.** A pattern like `const path = '/terms'; localePath(path)`
passes the slug through a variable; the ESLint selectors see only the identifier,
not the string it holds at runtime.

**Aliased helpers.** If a developer imports or renames a helper, for example
`const lp = localePath; lp('/terms')`, the callee name is no longer
`localePath` and the selector does not match.

**Cross-line split calls.** When the function call and its argument span multiple
source lines, the line-level Layer B regex does not match (Layer A handles this
because ESLint operates on the AST, not lines).

The guarantee provided by the guard is: no hardcoded CMS slug in a recognized
literal form ships undetected. The inbound 301 recovery (Pillar 4) is the
request-time backstop for the known semantic slugs (`terms`, `contact`,
`contact-form`, `apply`, `apply-for-account`). For the unstaticable forms
above, reviewers should reject them in code review and refer authors to
`useCmsPageLink(CMS_TAGS.X)`.

## Relationship to prior ADRs

- Extends [ADR-019](019-bulletproof-routing.md): CMS pages now have the same
  prevention, outbound-builder, and inbound-recovery guarantees as the product
  catalog. The structural pattern (sole builder, lint guard, static-scan test, 301
  recovery via the catch-all miss path, loop guard, open-redirect guard,
  `runWithContext` after async boundaries) is identical; only the resolver logic and
  the builder composable differ.
- Extends [ADR-017](017-entity-url-safety-net.md): the CMS-slug Step 0 in
  `resolveEntityUrl` reuses the same inbound safety-net architecture that ADR-017
  established for entity URLs, extending it to the CMS surface.
- Extends [ADR-015](015-type-prefixed-routing.md) by closing the coverage gap: the
  type-prefixed routing contract for entity URLs now has a parallel contract for CMS
  pages, including a sole builder and a prevention layer with the same lint-guard
  pattern.
